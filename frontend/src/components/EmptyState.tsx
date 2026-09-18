import React from 'react';
import { motion } from 'motion/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import ButtonBase from '@mui/material/ButtonBase';
import Divider from '@mui/material/Divider';

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GavelIcon from '@mui/icons-material/Gavel';
import BalanceIcon from '@mui/icons-material/Balance';

interface EmptyStateProps {
  onSearch?: (query: string) => void;
}

const SAMPLE_QUERIES = [
  {
    title: 'Agency Deference',
    query:
      'Impact of Loper Bright v. Raimondo on Chevron deference in environmental regulations',
    scope: 'precedential authority · administrative law',
    citation: '603 U.S. ___',
    icon: <BalanceIcon sx={{ fontSize: 18 }} />,
  },
  {
    title: 'AI Authorship',
    query:
      'Copyrightability of AI-generated works without human authorship under Thaler v. Perlmutter',
    scope: 'copyright · human authorship',
    citation: '687 F. Supp. 3d 140',
    icon: <AutoAwesomeIcon sx={{ fontSize: 18 }} />,
  },
  {
    title: 'Veil Piercing',
    query:
      'Standards for piercing the corporate veil in Delaware compared with California jurisdictions',
    scope: 'alter ego · corporate liability',
    citation: 'Del. Ch. / Cal. App.',
    icon: <GavelIcon sx={{ fontSize: 18 }} />,
  },
];

const ROW_SPRING = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
} as const;

const DOCKET_SPRING = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 1.2,
} as const;

const EmptyState: React.FC<EmptyStateProps> = ({ onSearch }) => {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1040,
        mx: 'auto',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: '0.82fr 1.18fr',
          },
          border: '1px solid',
          borderColor: 'primary.main',
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            minWidth: 0,
            p: { xs: 2, md: 3 },
            borderRight: {
              xs: 'none',
              lg: '1px solid',
            },
            borderRightColor: 'primary.main',
            borderBottom: {
              xs: '1px solid',
              lg: 'none',
            },
            borderBottomColor: 'primary.main',
            bgcolor: 'parchment.main',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 3,
            position: 'relative',
            overflow: 'hidden',
            minHeight: { xs: 280, md: 344 },
          }}
        >
          <Box
            component={motion.div}
            aria-hidden="true"
            initial={{ opacity: 0, x: 20, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={DOCKET_SPRING}
            sx={{
              position: 'absolute',
              right: { xs: -72, md: -64 },
              bottom: { xs: 28, md: 34 },
              width: { xs: 92, md: 118 },
              height: { xs: 150, md: 188 },
              border: '1px solid',
              borderColor: 'seal.main',
              bgcolor: 'transparent',
              display: { xs: 'none', sm: 'grid' },
              gridTemplateRows: '1fr auto',
              opacity: 0.12,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            <Box
              sx={{
                display: 'grid',
                alignContent: 'center',
                gap: { xs: 1.4, md: 1.8 },
                px: { xs: 2, md: 2.5 },
              }}
            >
              {[0, 1, 2].map((mark) => (
                <Box
                  key={mark}
                  component={motion.span}
                  initial={{ scaleX: 0.3 }}
                  animate={{ scaleX: 1 }}
                  transition={{
                    ...DOCKET_SPRING,
                    delay: mark * 0.08,
                  }}
                  sx={{
                    display: 'block',
                    height: 3,
                    bgcolor: 'seal.main',
                    transformOrigin: 'left center',
                  }}
                />
              ))}
            </Box>

            <Box
              sx={{
                height: { xs: 22, md: 28 },
                borderTop: '1px solid',
                borderColor: 'seal.main',
                bgcolor: 'seal.main',
              }}
            />
          </Box>

          <Box sx={{ position: 'relative', zIndex: 2 }}>
            <Typography
              variant="overline"
              sx={{
                display: 'block',
                color: 'text.secondary',
                mb: 1,
              }}
            >
              Source-Linked Legal Research
            </Typography>

            <Typography
              variant="h2"
              component="h1"
              sx={{
                maxWidth: 500,
                color: 'text.primary',
              }}
            >
              State the issue.
            </Typography>

            <Typography
              variant="body2"
              sx={{
                maxWidth: 460,
                mt: 2,
                color: 'text.secondary',
              }}
            >
              Enter the controlling question, disputed doctrine, citation, or
              holding to begin precedential authority review.
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            minWidth: 0,
            p: { xs: 1, md: 1.25 },
            bgcolor: 'background.paper',
          }}
        >
          <Box
            sx={{
              px: 0.75,
              pb: 0.85,
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Typography
              variant="overline"
              sx={{
                display: 'block',
                color: 'text.secondary',
              }}
            >
              Example Research Inputs
            </Typography>

            <Typography
              variant="caption"
              sx={{
                color: 'text.disabled',
                display: { xs: 'none', sm: 'block' },
              }}
            >
              {SAMPLE_QUERIES.length}
            </Typography>
          </Box>

          <Grid container spacing={0}>
            {SAMPLE_QUERIES.map((item, index) => (
              <Grid size={{ xs: 12 }} key={item.title}>
                <ButtonBase
                  disableRipple
                  onClick={() => onSearch?.(item.query)}
                  sx={{
                    width: '100%',
                    display: 'block',
                    textAlign: 'left',
                    borderTop: index === 0 ? '1px solid' : 0,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: index % 2 === 0 ? 'parchment.main' : 'background.paper',
                    overflow: 'hidden',
                    '&:hover': {
                      bgcolor: 'background.paper',
                      outline: '1px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: '-1px',
                    },
                    '&:hover .query-marker': {
                      bgcolor: 'seal.main',
                      color: 'background.paper',
                    },
                  }}
                >
                  <Box
                    component={motion.div}
                    initial={false}
                    whileHover={{
                      x: 5,
                    }}
                    transition={ROW_SPRING}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '36px minmax(0, 1fr)',
                        sm: '42px 118px minmax(0, 1fr)',
                      },
                      minHeight: 92,
                    }}
                  >
                    <Box
                      className="query-marker"
                      sx={{
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'background.paper',
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        color: 'text.primary',
                      }}
                    >
                      {item.icon}
                    </Box>

                    <Box
                      sx={{
                        display: { xs: 'none', sm: 'block' },
                        px: 1,
                        py: 1,
                        borderRight: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          color: 'text.secondary',
                          fontWeight: 800,
                          lineHeight: 1.2,
                        }}
                      >
                        {item.title}
                      </Typography>

                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          color: 'text.primary',
                          mt: 1,
                          fontWeight: 800,
                          lineHeight: 1.25,
                        }}
                      >
                        {item.citation}
                      </Typography>
                    </Box>

                    <Box sx={{ minWidth: 0, px: 1, py: 1 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          display: { xs: 'block', sm: 'none' },
                          color: 'text.secondary',
                          fontWeight: 800,
                          mb: 0.75,
                        }}
                      >
                        {item.title} · {item.citation}
                      </Typography>

                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.primary',
                          fontWeight: 700,
                          lineHeight: 1.42,
                        }}
                      >
                        “{item.query}”
                      </Typography>

                      <Divider sx={{ my: 0.75 }} />

                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          color: 'text.disabled',
                          lineHeight: 1.3,
                        }}
                      >
                        {item.scope}
                      </Typography>
                    </Box>
                  </Box>
                </ButtonBase>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
    </Box>
  );
};

export default EmptyState;
