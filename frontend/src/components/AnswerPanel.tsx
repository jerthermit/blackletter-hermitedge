import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Box,
  Typography,
  Paper,
  Divider,
  Chip,
  CircularProgress,
  Tooltip,
  Button,
  Stack,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SpeedIcon from '@mui/icons-material/Speed';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import GavelIcon from '@mui/icons-material/Gavel';
import GoogleIcon from '@mui/icons-material/Google';
import DataObjectIcon from '@mui/icons-material/DataObject';

import { AnalysisResponse } from '../utils/api';

interface AnswerPanelProps {
  analysis: AnalysisResponse | null;
  loading: boolean;
  error: string | null;
  query?: string;
}

const REVIEW_STEPS = [
  'Locate candidate authorities',
  'Open source records',
  'Review available opinion text',
  'Check usable context',
  'Prepare draft memorandum',
];

const MEMO_SPRING = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 1.2,
} as const;

const isNonMemoStatus = (analysis: AnalysisResponse | null) => {
  return analysis?.status === 'no_results' || analysis?.status === 'data_error';
};

const getReviewStatusLabel = (analysis: AnalysisResponse | null, isStreaming: boolean) => {
  if (isStreaming) return 'Drafting';
  if (analysis?.status === 'no_results') return 'No Results';
  if (analysis?.status === 'data_error') return 'Source Limited';
  return 'Ready';
};

const renderSourceMarkedText = (text: string) => {
  const parts = text.split(/(\[\d+\]|\$\d+)/g);

  return parts.map((part, index) => {
    const bracketMatch = part.match(/^\[(\d+)\]$/);
    const legacyMatch = part.match(/^\$(\d+)$/);
    const sourceId = bracketMatch?.[1] || legacyMatch?.[1];

    if (!sourceId) {
      return <React.Fragment key={index}>{part}</React.Fragment>;
    }

    return (
      <Chip
        key={index}
        label={`Src ${sourceId}`}
        size="small"
        component="span"
        icon={<GavelIcon sx={{ fontSize: '11px !important' }} />}
        sx={{
          height: 22,
          mx: 0.5,
          verticalAlign: 'baseline',
          bgcolor: 'parchment.main',
          borderColor: 'primary.main',
          color: 'text.primary',
          '& .MuiChip-icon': {
            color: 'seal.dark',
          },
        }}
      />
    );
  });
};

const AnswerPanel: React.FC<AnswerPanelProps> = ({
  analysis,
  loading,
  error,
  query,
}) => {
  const isStreaming = analysis?.status === 'streaming';
  const reviewStatusLabel = getReviewStatusLabel(analysis, isStreaming);
  const showAttorneyReviewNotice = Boolean(analysis) && !isNonMemoStatus(analysis);
  const [reviewStep, setReviewStep] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const targetTextRef = useRef('');

  const rawText = analysis?.answer || '';
  let cleanText = rawText.replace(/`{3,}/g, '');
  cleanText = cleanText.split(/\*?\*?CITATIONS?:?/i)[0].replace(/\*\*$/, '').trim();

  useEffect(() => {
    if (loading && !analysis) {
      setReviewStep(0);
      setDisplayedText('');
      targetTextRef.current = '';
    }
  }, [loading, query, analysis]);

  useEffect(() => {
    targetTextRef.current = cleanText;

    if (!isStreaming && cleanText) {
      setDisplayedText(cleanText);
    }
  }, [cleanText, isStreaming]);

  useEffect(() => {
    if (!isStreaming) return;

    let animationFrameId: number;
    let lastUpdateTime = performance.now();

    const tick = (currentTime: number) => {
      if (currentTime - lastUpdateTime > 30) {
        setDisplayedText((prev) => {
          const target = targetTextRef.current;

          if (prev.length < target.length) {
            const diff = target.length - prev.length;
            const charsToAdd = Math.max(1, Math.ceil(diff / 4));

            return target.slice(0, prev.length + charsToAdd);
          }

          return prev;
        });

        lastUpdateTime = currentTime;
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrameId);
  }, [isStreaming]);

  useEffect(() => {
    if (!loading || analysis) return;

    const interval = setInterval(() => {
      setReviewStep((prev) => Math.min(prev + 1, REVIEW_STEPS.length - 1));
    }, 700);

    return () => clearInterval(interval);
  }, [loading, analysis]);

  const textToRender = displayedText
    ? isStreaming
      ? `${displayedText} ▋`
      : displayedText
    : '';

  if (error) {
    return (
      <Paper
        square
        elevation={0}
        sx={{
          maxWidth: '75ch',
          border: '1px solid',
          borderColor: 'error.dark',
          borderLeft: '4px solid',
          borderLeftColor: 'error.dark',
          bgcolor: 'error.light',
          p: { xs: 1.5, md: 2 },
        }}
      >
        <Typography
          variant="h5"
          color="error.dark"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 1,
          }}
        >
          <WarningAmberIcon />
          Unable to Generate Analysis
        </Typography>

        <Typography
          variant="body2"
          sx={{
            color: 'error.dark',
          }}
        >
          {error}
        </Typography>
      </Paper>
    );
  }

  if (!analysis && !loading) return null;

  const latency = analysis?.processing_time_ms
    ? `${(analysis.processing_time_ms / 1000).toFixed(2)}s`
    : '< 1s';

  const handleGoogleSearch = () => {
    if (query) {
      window.open(
        `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
        '_blank'
      );
    }
  };

  const handleCourtListenerSearch = () => {
    if (query) {
      window.open(
        `https://www.courtlistener.com/?q=${encodeURIComponent(
          query
        )}&type=o&order_by=score+desc`,
        '_blank'
      );
    }
  };

  return (
    <Paper
      square
      elevation={0}
      component={motion.article}
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: 1,
        y: 0,
        borderLeftColor: isStreaming ? '#991B1B' : '#17130D',
      }}
      transition={MEMO_SPRING}
      sx={{
        maxWidth: 'min(100%, 980px)',
        border: '1px solid',
        borderColor: 'primary.main',
        borderLeft: '4px solid',
        borderLeftColor: isStreaming ? 'seal.main' : 'primary.main',
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'minmax(0, 1fr) auto',
          },
          borderBottom: '1px solid',
          borderColor: 'primary.main',
          bgcolor: 'parchment.main',
        }}
      >
        <Box sx={{ minWidth: 0, px: 1.25, py: 0.85 }}>
          {query && (
            <Typography
              variant="caption"
              noWrap
              sx={{
                display: 'block',
                color: 'text.secondary',
                maxWidth: { xs: 260, sm: 520, md: 680 },
                fontWeight: 800,
              }}
            >
              {query}
            </Typography>
          )}

          <Typography
            variant="caption"
            noWrap
            sx={{
              display: 'block',
              color: 'text.disabled',
              maxWidth: { xs: 260, sm: 520, md: 680 },
              mt: 0.35,
            }}
          >
            {reviewStatusLabel}
          </Typography>
        </Box>

        <Tooltip title="Elapsed review time" placement="bottom" arrow>
          <Box
            sx={{
              minWidth: { md: 96 },
              px: 1,
              py: 0.8,
              display: 'flex',
              alignItems: 'center',
              gap: 0.65,
              borderTop: {
                xs: '1px solid',
                md: 'none',
              },
              borderTopColor: 'divider',
              borderLeft: {
                md: '1px solid',
              },
              borderLeftColor: 'primary.main',
              bgcolor: 'background.paper',
            }}
          >
            <SpeedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />

            <Typography
              variant="caption"
              sx={{
                color: 'text.primary',
                fontWeight: 800,
              }}
            >
              {latency}
            </Typography>
          </Box>
        </Tooltip>
      </Box>

      <Box sx={{ px: { xs: 1.5, md: 2 }, py: { xs: 1.5, md: 2 } }}>
        {loading && !analysis && (
          <Paper
            square
            variant="outlined"
            sx={{
              maxWidth: '75ch',
              borderColor: 'primary.main',
              bgcolor: 'background.paper',
              mb: 2,
              overflow: 'hidden',
            }}
          >
            <Stack spacing={0} sx={{ p: 0 }}>
              {REVIEW_STEPS.map((step, index) => {
                const isCompleted = index < reviewStep;
                const isCurrent = index === reviewStep;
                const isPending = index > reviewStep;

                if (isPending) return null;

                return (
                  <Box
                    key={step}
                    component={motion.div}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: isCurrent ? 1 : 0.58, x: 0 }}
                    transition={MEMO_SPRING}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '34px minmax(0, 1fr)',
                      alignItems: 'center',
                      borderBottom:
                        index === reviewStep ? 'none' : '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box
                      sx={{
                        minHeight: 34,
                        display: 'grid',
                        placeItems: 'center',
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        bgcolor: isCurrent ? 'parchment.main' : 'background.paper',
                      }}
                    >
                      {isCompleted ? (
                        <CheckCircleOutlineIcon sx={{ fontSize: 17, color: 'success.dark' }} />
                      ) : (
                        <CircularProgress size={15} thickness={5} sx={{ color: 'seal.dark' }} />
                      )}
                    </Box>

                    <Typography
                      variant="caption"
                      sx={{
                        px: 1,
                        py: 0.75,
                        color: isCurrent ? 'text.primary' : 'text.secondary',
                        fontWeight: isCurrent ? 800 : 600,
                      }}
                    >
                      {step}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Paper>
        )}

        <Box
          className="memo-body"
          sx={{
            maxWidth: '75ch',
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <Typography
                  variant="h3"
                  component="h1"
                  sx={{
                    color: 'text.primary',
                    mt: 0.5,
                    mb: 2,
                  }}
                >
                  {children}
                </Typography>
              ),
              h2: ({ children }) => (
                <Box
                  sx={{
                    mt: 3,
                    mb: 1.5,
                    pb: 0.75,
                    borderBottom: '1px solid',
                    borderColor: 'primary.main',
                  }}
                >
                  <Typography
                    variant="h4"
                    component="h2"
                    sx={{
                      color: 'text.primary',
                    }}
                  >
                    {children}
                  </Typography>
                </Box>
              ),
              h3: ({ children }) => (
                <Typography
                  variant="h5"
                  component="h3"
                  sx={{
                    color: 'text.primary',
                    mt: 2,
                    mb: 1,
                  }}
                >
                  {children}
                </Typography>
              ),
              p: ({ children }) => (
                <Typography
                  variant="body1"
                  paragraph
                  sx={{
                    color: 'text.primary',
                    mb: 1.5,
                  }}
                >
                  {React.Children.map(children, (child) => {
                    if (typeof child !== 'string') return child;

                    const hasCursor = child.includes('▋');
                    const cleanChild = child.replace('▋', '');

                    return (
                      <React.Fragment>
                        {renderSourceMarkedText(cleanChild)}

                        {hasCursor && (
                          <Box
                            component="span"
                            sx={{
                              color: 'seal.dark',
                              ml: 0.5,
                              fontFamily:
                                '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
                            }}
                          >
                            ▋
                          </Box>
                        )}
                      </React.Fragment>
                    );
                  })}
                </Typography>
              ),
              strong: ({ children }) => (
                <Box
                  component="strong"
                  sx={{
                    color: 'text.primary',
                    fontWeight: 800,
                  }}
                >
                  {children}
                </Box>
              ),
              em: ({ children }) => (
                <Box
                  component="span"
                  sx={{
                    fontStyle: 'italic',
                    color: 'text.secondary',
                  }}
                >
                  {children}
                </Box>
              ),
              ul: ({ children }) => (
                <Box
                  component="ul"
                  sx={{
                    pl: 2.5,
                    my: 1.5,
                    listStyleType: 'square',
                    '& li': {
                      mb: 0.75,
                      fontFamily: '"Newsreader", Georgia, "Times New Roman", serif',
                      color: 'text.primary',
                      lineHeight: 1.65,
                    },
                    '& li::marker': {
                      color: 'seal.dark',
                    },
                  }}
                >
                  {children}
                </Box>
              ),
              ol: ({ children }) => (
                <Box
                  component="ol"
                  sx={{
                    pl: 2.5,
                    my: 1.5,
                    '& li': {
                      mb: 0.75,
                      fontFamily: '"Newsreader", Georgia, "Times New Roman", serif',
                      color: 'text.primary',
                      lineHeight: 1.65,
                    },
                    '& li::marker': {
                      color: 'seal.dark',
                      fontWeight: 800,
                    },
                  }}
                >
                  {children}
                </Box>
              ),
              li: ({ children }) => (
                <Typography
                  component="li"
                  sx={{
                    fontFamily: '"Newsreader", Georgia, "Times New Roman", serif',
                    fontSize: '1rem',
                    lineHeight: 1.65,
                  }}
                >
                  {children}
                </Typography>
              ),
              blockquote: ({ children }) => (
                <Paper
                  square
                  elevation={0}
                  sx={{
                    borderLeft: '4px solid',
                    borderLeftColor: 'primary.main',
                    borderTop: '1px solid',
                    borderRight: '1px solid',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    pl: 1.5,
                    pr: 1.5,
                    py: 1,
                    my: 2,
                    bgcolor: 'parchment.main',
                    fontStyle: 'italic',
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {children}
                  </Typography>
                </Paper>
              ),
              code: ({ children }) => (
                <Box
                  component="code"
                  sx={{
                    px: 0.5,
                    py: 0.1,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'parchment.main',
                    fontFamily:
                      '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
                    fontSize: '0.875em',
                  }}
                >
                  {children}
                </Box>
              ),
            }}
          >
            {textToRender}
          </ReactMarkdown>
        </Box>

        {!loading && !isStreaming && analysis && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 1.5, borderColor: 'primary.main' }} />

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'minmax(0, 1fr) auto',
                },
                gap: 1.5,
                alignItems: 'start',
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<GoogleIcon />}
                  onClick={handleGoogleSearch}
                  disabled={!query}
                >
                  Scholar
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<GavelIcon />}
                  onClick={handleCourtListenerSearch}
                  disabled={!query}
                >
                  CourtListener
                </Button>
              </Stack>

              {showAttorneyReviewNotice && (
                <Paper
                  square
                  variant="outlined"
                  sx={{
                    maxWidth: { md: 320 },
                    borderColor: 'divider',
                    bgcolor: 'parchment.main',
                  }}
                >
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '34px minmax(0, 1fr)',
                      alignItems: 'stretch',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'grid',
                        placeItems: 'center',
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                      }}
                    >
                      <WarningAmberIcon sx={{ color: 'seal.dark', fontSize: 18 }} />
                    </Box>

                    <Box sx={{ p: 1 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          color: 'text.primary',
                          fontWeight: 800,
                        }}
                      >
                        ATTORNEY REVIEW REQUIRED
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              )}
            </Box>
          </Box>
        )}

        {!textToRender && analysis && (
          <Box
            sx={{
              maxWidth: '75ch',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: 'text.secondary',
            }}
          >
            <DataObjectIcon sx={{ fontSize: 18 }} />
            <Typography variant="caption">No memorandum body returned.</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default AnswerPanel;