import React, { useCallback, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Modal,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useLegalResearch } from './hooks/useLegalResearch';
import Layout from './components/Layout';
import Header from './components/Header';
import AnswerPanel from './components/AnswerPanel';
import CaseList from './components/CaseList';
import EmptyState from './components/EmptyState';

const MIN_CASE_PANE_WIDTH = 280;
const MAX_CASE_PANE_WIDTH = 680;
const DEFAULT_CASE_PANE_WIDTH = 420;

const PANEL_SPRING = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 1.2,
} as const;

const GRIP_SPRING = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
} as const;

const clampPaneWidth = (width: number, workspaceWidth: number) => {
  const maxAllowed = Math.min(MAX_CASE_PANE_WIDTH, workspaceWidth - 420);
  const safeMax = Math.max(MIN_CASE_PANE_WIDTH, maxAllowed);

  return Math.min(Math.max(width, MIN_CASE_PANE_WIDTH), safeMax);
};

const AlertBanner: React.FC<{ message: string }> = ({ message }) => (
  <Alert
    severity="error"
    variant="standard"
    sx={{
      mb: 1,
      borderColor: 'error.dark',
      '& .MuiAlert-message': {
        width: '100%',
        fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
        fontSize: '0.75rem',
        lineHeight: 1.5,
      },
    }}
  >
    {message}
  </Alert>
);

const BudgetLockdown: React.FC = () => (
  <Modal
    open
    aria-labelledby="budget-lockdown-title"
    aria-describedby="budget-lockdown-description"
    sx={{
      display: 'grid',
      placeItems: 'center',
      p: 2,
      bgcolor: 'rgba(23, 19, 13, 0.72)',
    }}
  >
    <Paper
      square
      sx={{
        width: 'min(100%, 440px)',
        border: '1px solid',
        borderColor: 'error.dark',
        bgcolor: 'background.paper',
        p: 2,
        outline: 'none',
      }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
        >
          <Typography
            id="budget-lockdown-title"
            variant="h4"
            sx={{
              color: 'error.dark',
              lineHeight: 1,
            }}
          >
            Demo Access Paused
          </Typography>

          <Chip
            label="Budget Lock"
            color="error"
            sx={{
              flexShrink: 0,
            }}
          />
        </Stack>

        <Divider />

        <Typography
          id="budget-lockdown-description"
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          The safety budget for this portfolio demo has been reached. To prevent
          accidental billing, all further requests are blocked.
        </Typography>

        <Button
          disabled
          fullWidth
          variant="outlined"
          sx={{
            mt: 0.5,
            justifyContent: 'center',
            color: 'text.disabled',
            borderColor: 'divider',
            bgcolor: 'background.default',
          }}
        >
          Contact Developer to Reset
        </Button>
      </Stack>
    </Paper>
  </Modal>
);

function App() {
  const {
    results,
    analysis,
    isSearching,
    isAnalyzing,
    error,
    isBudgetExceeded,
    searchWithQuery,
    stopSearch,
    currentQuery,
  } = useLegalResearch();

  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [casePaneWidth, setCasePaneWidth] = useState(DEFAULT_CASE_PANE_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  const hasAnalysis = Boolean(analysis);
  const displayedCases =
    analysis?.sources && analysis.sources.length > 0 ? analysis.sources : results;
  const hasResults = displayedCases.length > 0;
  const isLoading = isSearching || isAnalyzing;
  const showEmptyState = !hasResults && !hasAnalysis && !isAnalyzing && !error;
  const showWorkbench = hasResults || hasAnalysis || isAnalyzing || Boolean(error);

  const memoStatus = (() => {
    if (isAnalyzing) {
      return {
        label: 'Drafting',
        color: 'error' as const,
      };
    }

    if (error) {
      return {
        label: 'Error',
        color: 'error' as const,
      };
    }

    if (analysis?.status === 'no_results') {
      return {
        label: 'No Results',
        color: 'default' as const,
      };
    }

    if (analysis?.status === 'data_error') {
      return {
        label: 'Source Limited',
        color: 'default' as const,
      };
    }

    if (hasAnalysis) {
      return {
        label: 'Ready',
        color: 'default' as const,
      };
    }

    return {
      label: 'Idle',
      color: 'default' as const,
    };
  })();

  const handleNewQuery = useCallback(() => {
    stopSearch();
    window.location.reload();
  }, [stopSearch]);

  const handleSplitterPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const workspace = workspaceRef.current;

      if (!workspace) {
        return;
      }

      event.preventDefault();

      const workspaceRect = workspace.getBoundingClientRect();
      setIsResizing(true);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const rawWidth = moveEvent.clientX - workspaceRect.left;
        setCasePaneWidth(clampPaneWidth(rawWidth, workspaceRect.width));
      };

      const handlePointerUp = () => {
        setIsResizing(false);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    []
  );

  const handleSplitterKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!workspaceRef.current) {
        return;
      }

      const workspaceWidth = workspaceRef.current.getBoundingClientRect().width;
      const step = event.shiftKey ? 48 : 24;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setCasePaneWidth((width) => clampPaneWidth(width - step, workspaceWidth));
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setCasePaneWidth((width) => clampPaneWidth(width + step, workspaceWidth));
      }

      if (event.key === 'Home') {
        event.preventDefault();
        setCasePaneWidth(MIN_CASE_PANE_WIDTH);
      }

      if (event.key === 'End') {
        event.preventDefault();
        setCasePaneWidth(clampPaneWidth(MAX_CASE_PANE_WIDTH, workspaceWidth));
      }
    },
    []
  );

  return (
    <Layout loading={isLoading}>
      {isBudgetExceeded && <BudgetLockdown />}

      <Header
        onSearch={searchWithQuery}
        onStop={stopSearch}
        loading={isLoading}
      />

      <Box
        component="main"
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          px: { xs: 1, md: 1.5 },
          py: { xs: 1, md: 1.5 },
          cursor: isResizing ? 'col-resize' : 'auto',
          userSelect: isResizing ? 'none' : 'auto',
        }}
      >
        {showEmptyState && (
          <Paper
            square
            sx={{
              flex: 1,
              minHeight: { xs: 'calc(100vh - 88px)', md: 'calc(100vh - 96px)' },
              display: 'grid',
              placeItems: 'center',
              border: '1px solid',
              borderColor: 'primary.main',
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: 'min(100%, 920px)',
                p: { xs: 2, md: 3 },
              }}
            >
              <EmptyState onSearch={searchWithQuery} />
            </Box>
          </Paper>
        )}

        {showWorkbench && (
          <Box
            ref={workspaceRef}
            component={motion.div}
            initial={{ opacity: 0, y: 10 }}
            animate={{
              opacity: 1,
              y: 0,
              borderColor: isResizing ? '#991B1B' : '#17130D',
            }}
            transition={PANEL_SPRING}
            sx={{
              flex: 1,
              minHeight: { xs: 'calc(100vh - 88px)', md: 'calc(100vh - 96px)' },
              display: 'grid',
              gridTemplateRows: '34px minmax(0, 1fr)',
              border: '1px solid',
              borderColor: isResizing ? 'seal.main' : 'primary.main',
              bgcolor: 'primary.main',
              overflow: 'hidden',
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={1}
              sx={{
                minHeight: 34,
                px: 1,
                borderBottom: '1px solid',
                borderColor: isResizing ? 'seal.main' : 'primary.main',
                bgcolor: 'primary.main',
                color: 'background.paper',
              }}
            >
              <Typography
                variant="caption"
                noWrap
                sx={{
                  color: 'background.paper',
                  fontWeight: 800,
                }}
              >
                {currentQuery || 'Active matter'}
              </Typography>

              <Button
                variant="contained"
                size="small"
                onClick={handleNewQuery}
                disabled={isLoading}
                sx={{
                  minHeight: 24,
                  borderColor: 'background.paper',
                  bgcolor: 'background.paper',
                  color: 'primary.main',
                  '&:hover': {
                    bgcolor: 'parchment.main',
                    color: 'primary.main',
                  },
                  '&.Mui-disabled': {
                    bgcolor: 'divider',
                    color: 'text.disabled',
                  },
                }}
              >
                New Query
              </Button>
            </Stack>

            <Box
              sx={{
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  lg: hasResults
                    ? `${casePaneWidth}px 2px minmax(0, 1fr)`
                    : '1fr',
                },
                bgcolor: 'background.paper',
                overflow: 'hidden',
              }}
            >
              {hasResults && (
                <Box
                  component="aside"
                  aria-label="Citation matrix"
                  sx={{
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: 'parchment.main',
                    borderRight: {
                      xs: 'none',
                      lg: 0,
                    },
                    borderBottom: {
                      xs: '1px solid',
                      lg: 'none',
                    },
                    borderBottomColor: 'primary.main',
                    maxHeight: {
                      xs: 360,
                      lg: 'none',
                    },
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={1}
                    sx={{
                      minHeight: 34,
                      px: 1,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Typography
                      variant="overline"
                      sx={{
                        display: 'block',
                        color: 'text.secondary',
                        lineHeight: 1,
                      }}
                    >
                      Authorities
                    </Typography>

                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.disabled',
                        fontWeight: 800,
                      }}
                    >
                      {displayedCases.length}
                    </Typography>
                  </Stack>

                  <Box
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      overflow: 'auto',
                    }}
                  >
                    <CaseList cases={displayedCases} />
                  </Box>
                </Box>
              )}

              {hasResults && (
                <Box
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize authority pane"
                  aria-valuemin={MIN_CASE_PANE_WIDTH}
                  aria-valuemax={MAX_CASE_PANE_WIDTH}
                  aria-valuenow={casePaneWidth}
                  tabIndex={0}
                  onPointerDown={handleSplitterPointerDown}
                  onKeyDown={handleSplitterKeyDown}
                  className="splitter-rule"
                  sx={{
                    display: { xs: 'none', lg: 'block' },
                    position: 'relative',
                    width: 2,
                    bgcolor: isResizing ? 'seal.main' : 'primary.main',
                    cursor: 'col-resize',
                    outline: 'none',
                    zIndex: 2,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      inset: '0 -14px',
                      cursor: 'col-resize',
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: isResizing ? 24 : 12,
                      height: isResizing ? 112 : 56,
                      border: '1px solid',
                      borderColor: isResizing ? 'seal.main' : 'primary.main',
                      bgcolor: isResizing ? 'seal.main' : 'background.paper',
                      transform: 'translate(-50%, -50%)',
                    },
                    '&:hover': {
                      bgcolor: 'seal.main',
                    },
                    '&:hover::after': {
                      borderColor: 'seal.main',
                    },
                    '&:focus-visible': {
                      boxShadow: (theme) =>
                        `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${theme.palette.seal.main}`,
                    },
                  }}
                >
                  <Box
                    component={motion.span}
                    aria-hidden="true"
                    animate={{
                      opacity: isResizing ? 1 : 0,
                      scaleY: isResizing ? 1 : 0.6,
                    }}
                    transition={GRIP_SPRING}
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: 2,
                      height: 150,
                      bgcolor: 'seal.main',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 3,
                      pointerEvents: 'none',
                    }}
                  />
                </Box>
              )}

              <Box
                component="section"
                aria-label="Legal memorandum reader"
                sx={{
                  minWidth: 0,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: 'background.paper',
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1}
                  sx={{
                    minHeight: 34,
                    px: 1,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Typography
                    variant="overline"
                    sx={{
                      display: 'block',
                      color: 'text.secondary',
                      lineHeight: 1,
                    }}
                  >
                    Memorandum
                  </Typography>

                  <Chip
                    label={memoStatus.label}
                    color={memoStatus.color}
                    sx={{
                      flexShrink: 0,
                      height: 22,
                    }}
                  />
                </Stack>

                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'auto',
                    p: { xs: 1, md: 1.5 },
                    bgcolor: 'background.paper',
                  }}
                >
                  {error && !isAnalyzing && <AlertBanner message={error} />}

                  {(isAnalyzing || hasAnalysis) && (
                    <AnswerPanel
                      analysis={analysis}
                      loading={isAnalyzing}
                      error={error}
                      query={currentQuery}
                    />
                  )}

                  {!isAnalyzing && !hasAnalysis && hasResults && (
                    <Box
                      sx={{
                        minHeight: 240,
                        maxWidth: '75ch',
                        display: 'grid',
                        placeItems: 'center',
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'parchment.main',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.disabled',
                          fontWeight: 800,
                        }}
                      >
                        MEMO PENDING
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Layout>
  );
}

export default App;