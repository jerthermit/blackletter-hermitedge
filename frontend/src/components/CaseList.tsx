import React from 'react';
import { motion } from 'motion/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import GavelIcon from '@mui/icons-material/Gavel';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SchoolIcon from '@mui/icons-material/School';
import Divider from '@mui/material/Divider';

import { CaseSource } from '../utils/api';

interface CaseListProps {
  cases: CaseSource[];
}

type ParsedCaseContent = {
  courtName?: string;
  displayDate: string;
  displayCitation: string;
  body: string;
  isStructured: boolean;
  isFallbackRecord: boolean;
};

const ROW_SPRING = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
} as const;

const cleanSnippetText = (text: string) => text.replace(/\*\*/g, '').trim();

const parseCaseContent = (c: CaseSource): ParsedCaseContent => {
  const text = c.snippet || '';
  const defaultDate = c.date || 'Unknown Date';
  const defaultCitation = c.citation || 'Unreported';

  const decisionMatch = text.match(/\*\*DECISION FROM ([\s\S]*?)\*\*/);

  if (!decisionMatch) {
    const body = cleanSnippetText(text) || 'No preview available.';

    return {
      displayDate: defaultDate,
      displayCitation: defaultCitation,
      body,
      isStructured: false,
      isFallbackRecord: false,
    };
  }

  const courtName = decisionMatch[1].trim();
  const dateMatch = text.match(/\*\*Date:\*\* ([\s\S]*?) \|/);
  const citationMatch = text.match(/\*\*Citation:\*\* ([\s\S]*?) (?:Full|This|Held|The)/);

  const displayDate = dateMatch ? dateMatch[1].trim() : defaultDate;
  const displayCitation = citationMatch ? citationMatch[1].trim() : defaultCitation;

  let body = text
    .replace(/\*\*DECISION FROM [\s\S]*?\*\*/, '')
    .replace(/\*\*Date:\*\*.*\|\s*\*\*Citation:\*\*.*(\n|$)/, '')
    .replace(/\*\*/g, '')
    .trim();

  const isFallbackRecord =
    body.includes('Full opinion text is available') ||
    body.includes('matches your query');

  if (isFallbackRecord) {
    body = 'Official record retrieved. Full opinion available for review.';
  }

  return {
    courtName,
    displayDate,
    displayCitation,
    body,
    isStructured: true,
    isFallbackRecord,
  };
};

const CaseList: React.FC<CaseListProps> = ({ cases }) => {
  if (!cases || cases.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 0,
      }}
    >
      {cases.map((c, index) => {
        const parsed = parseCaseContent(c);
        const sourceNumber = index + 1;
        const scholarUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(
          `${c.name} ${c.citation}`
        )}`;

        return (
          <Box
            key={c.id}
            component={motion.article}
            initial={false}
            whileHover={{
              x: 4,
            }}
            transition={ROW_SPRING}
            sx={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: '104px minmax(0, 1fr)',
              },
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: index % 2 === 0 ? 'background.paper' : 'parchment.main',
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: '0 auto 0 0',
                width: 4,
                bgcolor: 'transparent',
              },
              '&:hover': {
                outline: '1px solid',
                outlineColor: 'primary.main',
                outlineOffset: '-1px',
                bgcolor: 'background.paper',
              },
              '&:hover::before': {
                bgcolor: 'seal.main',
              },
            }}
          >
            <Box
              sx={{
                px: 0.85,
                py: 0.85,
                borderRight: {
                  xs: 'none',
                  sm: '1px solid',
                },
                borderRightColor: 'divider',
                borderBottom: {
                  xs: '1px solid',
                  sm: 'none',
                },
                borderBottomColor: 'divider',
                bgcolor: 'parchment.main',
              }}
            >
              <Chip
                label={`Src ${sourceNumber}`}
                size="small"
                icon={<GavelIcon sx={{ fontSize: '11px !important' }} />}
                sx={{
                  height: 22,
                  mb: 0.85,
                  bgcolor: 'background.paper',
                  borderColor: 'primary.main',
                  color: 'text.primary',
                  fontWeight: 800,
                  '& .MuiChip-icon': {
                    color: 'seal.dark',
                  },
                }}
              />

              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: 'text.secondary',
                  fontWeight: 800,
                  lineHeight: 1.15,
                }}
              >
                {parsed.displayDate}
              </Typography>

              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: 'text.primary',
                  fontWeight: 800,
                  lineHeight: 1.2,
                  mt: 0.65,
                  wordBreak: 'break-word',
                }}
              >
                {parsed.displayCitation}
              </Typography>

            </Box>

            <Box sx={{ minWidth: 0, px: 0.9, py: 0.85 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="h5"
                  component="h3"
                  sx={{
                    color: 'text.primary',
                    lineHeight: 1.03,
                    mb: 0.5,
                  }}
                >
                  {c.name}
                </Typography>

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.6,
                    flexWrap: 'wrap',
                  }}
                >
                  {parsed.courtName && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        fontWeight: 800,
                      }}
                    >
                      {parsed.courtName}
                    </Typography>
                  )}

                  {!parsed.isStructured && (
                    <>
                      <GavelIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontWeight: 800,
                        }}
                      >
                        {parsed.displayCitation}
                      </Typography>
                    </>
                  )}

                  {!parsed.isStructured && (
                    <>
                      <CalendarTodayIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.disabled',
                        }}
                      >
                        {parsed.displayDate}
                      </Typography>
                    </>
                  )}
                </Box>
              </Box>

              <Typography
                variant="body2"
                sx={{
                  mt: 0.85,
                  color: parsed.isFallbackRecord ? 'text.disabled' : 'text.secondary',
                  fontFamily: '"Newsreader", Georgia, "Times New Roman", serif',
                  fontSize: '0.9rem',
                  lineHeight: 1.45,
                  fontStyle: parsed.isFallbackRecord ? 'italic' : 'normal',
                  display: '-webkit-box',
                  overflow: 'hidden',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 3,
                  borderLeft: '2px solid',
                  borderLeftColor: parsed.isStructured ? 'seal.main' : 'divider',
                  pl: 0.9,
                }}
              >
                {parsed.body.length > 3 && !parsed.body.startsWith('"')
                  ? `"...${parsed.body}..."`
                  : parsed.body}
              </Typography>

              <Divider sx={{ my: 0.85 }} />

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.6,
                  flexWrap: 'wrap',
                }}
              >
                {c.absolute_url && (
                  <Button
                    size="small"
                    variant="contained"
                    endIcon={<ArrowForwardIcon sx={{ fontSize: '15px !important' }} />}
                    href={c.absolute_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      minHeight: 30,
                    }}
                  >
                    Record
                  </Button>
                )}

                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SchoolIcon sx={{ fontSize: '15px !important' }} />}
                    href={scholarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    minHeight: 30,
                  }}
                >
                  Scholar
                </Button>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

export default CaseList;
