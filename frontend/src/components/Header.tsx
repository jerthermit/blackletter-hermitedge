// File: frontend/src/components/Header.tsx
import React, { useState, KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

interface HeaderProps {
  onSearch: (query: string) => void;
  onStop?: () => void;
  loading?: boolean;
}

const COMMAND_SPRING = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
} as const;

const PRESS_SPRING = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 1.2,
} as const;

const Header: React.FC<HeaderProps> = ({
  onSearch,
  onStop,
  loading = false,
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const trimmedQuery = query.trim();
  const canSearch = Boolean(trimmedQuery) && !loading;
  const isActive = isFocused || loading || Boolean(trimmedQuery);

  const handleSearch = () => {
    if (canSearch) {
      onSearch(trimmedQuery);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && canSearch) {
      handleSearch();
    }
  };

  return (
    <Box
      component="header"
      sx={{
        width: '100%',
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: loading ? 'seal.main' : 'primary.main',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '42px minmax(0, 1fr)',
            md: '52px minmax(0, 1fr)',
          },
          alignItems: 'stretch',
          minHeight: { xs: 58, md: 64 },
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <Box
          component={motion.div}
          animate={{
            backgroundColor: isActive ? '#991B1B' : '#17130D',
          }}
          transition={PRESS_SPRING}
          sx={{
            position: 'relative',
            display: 'grid',
            placeItems: 'center',
            borderRight: '1px solid',
            borderColor: 'primary.main',
            bgcolor: isActive ? 'seal.main' : 'primary.main',
            overflow: 'hidden',
          }}
        >
          <Box
            component={motion.div}
            aria-hidden="true"
            animate={{
              width: isActive ? 20 : 14,
              height: isActive ? 38 : 32,
              opacity: isActive ? 1 : 0.78,
            }}
            transition={PRESS_SPRING}
            sx={{
              position: 'relative',
              border: '1px solid',
              borderColor: 'background.paper',
              bgcolor: 'transparent',
              display: 'grid',
              gridTemplateRows: 'repeat(3, 1fr)',
              alignItems: 'center',
              px: '5px',
            }}
          >
            {[0, 1, 2].map((mark) => (
              <Box
                key={mark}
                component={motion.span}
                animate={{
                  scaleX: loading ? [0.25, 1, 0.25] : isActive ? 1 : 0.55,
                  opacity: loading ? [0.45, 1, 0.45] : isActive ? 1 : 0.6,
                }}
                transition={
                  loading
                    ? {
                        duration: 0.85,
                        repeat: Infinity,
                        repeatType: 'loop',
                        delay: mark * 0.12,
                      }
                    : COMMAND_SPRING
                }
                sx={{
                  display: 'block',
                  height: 2,
                  bgcolor: 'background.paper',
                  transformOrigin: 'left center',
                }}
              />
            ))}
          </Box>

          <Box
            component={motion.div}
            aria-hidden="true"
            animate={{
              scaleY: isActive ? 1 : 0.35,
              opacity: isActive ? 1 : 0.45,
            }}
            transition={PRESS_SPRING}
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: 4,
              bgcolor: 'background.paper',
              transformOrigin: 'center',
            }}
          />
        </Box>

        <Box
          sx={{
            minWidth: 0,
            position: 'relative',
            bgcolor: 'background.paper',
          }}
        >
          <Box
            component={motion.div}
            aria-hidden="true"
            animate={{
              scaleX: isActive ? 1 : 0,
              opacity: isActive ? 1 : 0,
            }}
            transition={PRESS_SPRING}
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 3,
              bgcolor: 'seal.main',
              transformOrigin: 'left center',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          />

          <TextField
            fullWidth
            placeholder="Search precedential opinions, doctrines, holdings, or procedural questions..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            variant="outlined"
            autoComplete="off"
            inputProps={{
              'data-form-type': 'other',
              'aria-label': 'Legal research query',
              maxLength: 500,
            }}
            sx={{
              height: '100%',
              '& .MuiOutlinedInput-root': {
                height: '100%',
                minHeight: { xs: 58, md: 64 },
                borderRadius: 0,
                bgcolor: 'background.paper',
                boxShadow: 'none',
                pr: 0.75,
                '& fieldset': {
                  border: 0,
                },
                '&:hover fieldset': {
                  border: 0,
                },
                '&.Mui-focused fieldset': {
                  border: 0,
                },
                '&.Mui-focused': {
                  boxShadow: 'none',
                },
                '& input': {
                  py: 1,
                  pl: 0.5,
                  fontSize: { xs: '0.875rem', md: '1rem' },
                  fontWeight: 750,
                  letterSpacing: '-0.015em',
                },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Box
                    component={motion.span}
                    animate={{
                      x: isFocused ? 2 : 0,
                      color: isActive ? '#6F1212' : '#991B1B',
                    }}
                    transition={COMMAND_SPRING}
                    sx={{
                      display: 'grid',
                      placeItems: 'center',
                      color: isActive ? 'seal.dark' : 'seal.main',
                    }}
                  >
                    <SearchIcon sx={{ fontSize: 20 }} />
                  </Box>
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  {loading ? (
                    <Tooltip title="Stop request" arrow>
                      <span>
                        <IconButton
                          component={motion.button}
                          whileTap={{ y: 1 }}
                          transition={COMMAND_SPRING}
                          onClick={onStop || (() => {})}
                          size="small"
                          aria-label="Stop request"
                          sx={{
                            width: 38,
                            height: 38,
                            color: 'background.paper',
                            border: '1px solid',
                            borderColor: 'seal.dark',
                            bgcolor: 'seal.main',
                            '&:hover': {
                              bgcolor: 'seal.dark',
                            },
                          }}
                        >
                          <StopCircleIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Run search" arrow>
                      <span>
                        <IconButton
                          component={motion.button}
                          whileTap={canSearch ? { y: 2 } : undefined}
                          whileHover={canSearch ? { x: 2 } : undefined}
                          transition={COMMAND_SPRING}
                          onClick={handleSearch}
                          disabled={!trimmedQuery}
                          size="small"
                          aria-label="Run search"
                          sx={{
                            width: 38,
                            height: 38,
                            border: '1px solid',
                            borderColor: trimmedQuery ? 'seal.dark' : 'divider',
                            bgcolor: trimmedQuery ? 'seal.main' : 'parchment.main',
                            color: trimmedQuery ? 'background.paper' : 'text.disabled',
                            position: 'relative',
                            overflow: 'hidden',
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              inset: 4,
                              border: '1px solid',
                              borderColor: trimmedQuery
                                ? 'rgba(255, 253, 247, 0.55)'
                                : 'transparent',
                              pointerEvents: 'none',
                            },
                            '&:hover': {
                              bgcolor: trimmedQuery ? 'seal.dark' : 'parchment.main',
                            },
                            '&.Mui-disabled': {
                              color: 'text.disabled',
                              borderColor: 'divider',
                              bgcolor: 'parchment.main',
                            },
                          }}
                        >
                          <ArrowForwardIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default Header;
