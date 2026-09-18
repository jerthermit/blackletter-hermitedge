// File: frontend/src/components/Footer.tsx
import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const Footer: React.FC = () => {
  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          minHeight: 28,
          px: { xs: 1, md: 1.5 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}
        >
          © 2026 Emman Ermitaño. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
};

export default Footer;