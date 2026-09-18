// File: frontend/src/components/Layout.tsx
import React from 'react';
import { motion } from 'motion/react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LinearProgress from '@mui/material/LinearProgress';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
  loading?: boolean;
}

const SHELL_SPRING = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
} as const;

const Layout: React.FC<LayoutProps> = ({ children, loading = false }) => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        color: 'text.primary',
      }}
    >
      <AppBar
        position="sticky"
        elevation={0}
        color="transparent"
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: loading ? 'seal.main' : 'primary.main',
          boxShadow: 'none',
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        {loading && (
          <LinearProgress
            aria-label="Research request in progress"
            sx={{
              position: 'absolute',
              inset: '0 0 auto 0',
              height: 2,
              bgcolor: 'transparent',
              '& .MuiLinearProgress-bar': {
                bgcolor: 'seal.main',
              },
            }}
          />
        )}

        <Toolbar
          disableGutters
          sx={{
            minHeight: '48px !important',
            px: { xs: 1, md: 1.5 },
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 1,
          }}
        >
          <Box
            component={motion.a}
            href="/"
            aria-label="Return to Blackletter home"
            initial={false}
            animate={{
              x: loading ? 2 : 0,
            }}
            transition={SHELL_SPRING}
            sx={{
              minWidth: 0,
              width: 'fit-content',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: 'inherit',
              textDecoration: 'none',
              '&:hover': {
                color: 'text.primary',
                textDecoration: 'none',
              },
              '&:focus-visible': {
                outline: 'none',
                boxShadow: (theme) =>
                  `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${theme.palette.seal.main}`,
              },
            }}
          >
            <Box
              component="img"
              src="/app-logo.png"
              alt="Blackletter Logo"
              width={30}
              height={30}
              loading="eager"
              sx={{
                width: 30,
                height: 30,
                flexShrink: 0,
                objectFit: 'contain',
                bgcolor: 'transparent',
              }}
            />

            <Typography
              variant="h4"
              noWrap
              sx={{
                lineHeight: 0.92,
                color: 'text.primary',
              }}
            >
              Blackletter
            </Typography>
          </Box>

          <Box
            component={motion.div}
            aria-label="Jurisdiction scope"
            initial={false}
            animate={{
              backgroundColor: loading ? '#F4DED8' : '#F8F3E8',
            }}
            transition={SHELL_SPRING}
            sx={{
              justifySelf: 'end',
              display: 'grid',
              gridTemplateColumns: 'auto auto',
              alignItems: 'center',
              border: '1px solid',
              borderColor: loading ? 'seal.main' : 'primary.main',
              bgcolor: loading ? 'seal.light' : 'parchment.main',
              minHeight: 30,
            }}
          >
            <Box
              sx={{
                height: '100%',
                minWidth: 30,
                display: 'grid',
                placeItems: 'center',
                borderRight: '1px solid',
                borderColor: loading ? 'seal.main' : 'primary.main',
                bgcolor: 'background.paper',
              }}
            >
              <AccountBalanceIcon
                sx={{
                  fontSize: 16,
                  color: loading ? 'seal.dark' : 'text.primary',
                }}
              />
            </Box>

            <Typography
              variant="caption"
              noWrap
              sx={{
                display: 'block',
                px: 1,
                color: loading ? 'seal.dark' : 'text.primary',
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              U.S. CASE LAW
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
        }}
      >
        {children}
      </Box>

      <Footer />
    </Box>
  );
};

export default Layout;
