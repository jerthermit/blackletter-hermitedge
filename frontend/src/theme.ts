// File: frontend/src/theme.ts
import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    accent: Palette['primary'];
    seal: Palette['primary'];
    parchment: Palette['primary'];
  }

  interface PaletteOptions {
    accent?: PaletteOptions['primary'];
    seal?: PaletteOptions['primary'];
    parchment?: PaletteOptions['primary'];
  }
}

const ink = '#17130D';
const inkSoft = '#554B3E';
const paper = '#FFFDF7';
const vellum = '#F8F3E8';
const docket = '#EBE4D6';
const rule = '#DDD2BF';
const ruleStrong = '#17130D';
const seal = '#991B1B';
const sealDeep = '#6F1212';

const noTransition = {
  transition: 'none',
};

const mono =
  '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace';
const sans =
  '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const serif = '"Newsreader", Georgia, "Times New Roman", serif';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: ink,
      light: '#3A3329',
      dark: '#090807',
      contrastText: paper,
    },
    secondary: {
      main: inkSoft,
      light: '#8A7D69',
      dark: '#2C261E',
      contrastText: paper,
    },
    accent: {
      main: seal,
      light: '#F4DED8',
      dark: sealDeep,
      contrastText: paper,
    },
    seal: {
      main: seal,
      light: '#F4DED8',
      dark: sealDeep,
      contrastText: paper,
    },
    parchment: {
      main: vellum,
      light: paper,
      dark: docket,
      contrastText: ink,
    },
    background: {
      default: '#F4F0E8',
      paper,
    },
    text: {
      primary: ink,
      secondary: inkSoft,
      disabled: '#9A8D78',
    },
    divider: rule,
    error: {
      main: seal,
      dark: sealDeep,
      light: '#F4DED8',
      contrastText: paper,
    },
    warning: {
      main: '#92400E',
      dark: '#78350F',
      light: '#FDE68A',
      contrastText: ink,
    },
    success: {
      main: '#166534',
      dark: '#14532D',
      light: '#DCFCE7',
      contrastText: paper,
    },
    info: {
      main: '#1F3A5F',
      dark: '#172B45',
      light: '#DCE7F5',
      contrastText: paper,
    },
  },
  typography: {
    fontFamily: sans,
    htmlFontSize: 16,
    h1: {
      fontFamily: serif,
      fontSize: '5.0625rem',
      fontWeight: 800,
      lineHeight: 0.95,
      letterSpacing: '-0.055em',
      color: ink,
    },
    h2: {
      fontFamily: serif,
      fontSize: '3.375rem',
      fontWeight: 750,
      lineHeight: 0.98,
      letterSpacing: '-0.05em',
      color: ink,
    },
    h3: {
      fontFamily: serif,
      fontSize: '2.25rem',
      fontWeight: 700,
      lineHeight: 1.02,
      letterSpacing: '-0.045em',
      color: ink,
    },
    h4: {
      fontFamily: serif,
      fontSize: '1.5rem',
      fontWeight: 700,
      lineHeight: 1.08,
      letterSpacing: '-0.035em',
      color: ink,
    },
    h5: {
      fontFamily: serif,
      fontSize: '1.125rem',
      fontWeight: 700,
      lineHeight: 1.15,
      letterSpacing: '-0.025em',
      color: ink,
    },
    h6: {
      fontFamily: sans,
      fontSize: '0.875rem',
      fontWeight: 800,
      lineHeight: 1.2,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: ink,
    },
    subtitle1: {
      fontFamily: serif,
      fontSize: '1rem',
      lineHeight: 1.6,
      color: inkSoft,
    },
    subtitle2: {
      fontFamily: mono,
      fontSize: '0.75rem',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '0.03em',
      textTransform: 'uppercase',
      color: inkSoft,
    },
    body1: {
      fontFamily: serif,
      fontSize: '1rem',
      lineHeight: 1.72,
      color: ink,
    },
    body2: {
      fontFamily: sans,
      fontSize: '0.875rem',
      lineHeight: 1.5,
      color: inkSoft,
    },
    button: {
      fontFamily: mono,
      fontSize: '0.7rem',
      fontWeight: 700,
      letterSpacing: '0.045em',
      textTransform: 'uppercase',
    },
    caption: {
      fontFamily: mono,
      fontSize: '0.7rem',
      lineHeight: 1.3,
      letterSpacing: '0.005em',
      color: '#8A7D69',
    },
    overline: {
      fontFamily: mono,
      fontSize: '0.65rem',
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: '0.09em',
      textTransform: 'uppercase',
      color: inkSoft,
    },
  },
  shape: {
    borderRadius: 0,
  },
  shadows: Array(25).fill('none') as [
    'none',
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#F4F0E8',
          color: ink,
        },
      },
    },
    MuiButtonBase: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: noTransition,
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          ...noTransition,
          minHeight: 30,
          padding: '0.4rem 0.65rem',
          borderRadius: 0,
          boxShadow: 'none',
          fontFamily: mono,
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.045em',
          textTransform: 'uppercase',
          '&:hover': {
            boxShadow: 'none',
          },
          '&:focus-visible': {
            outline: 'none',
            boxShadow: `0 0 0 2px ${paper}, 0 0 0 4px ${seal}`,
          },
        },
        containedPrimary: {
          backgroundColor: ink,
          color: paper,
          border: `1px solid ${ink}`,
          '&:hover': {
            backgroundColor: '#090807',
          },
        },
        containedSecondary: {
          backgroundColor: inkSoft,
          color: paper,
          border: `1px solid ${inkSoft}`,
          '&:hover': {
            backgroundColor: '#2C261E',
          },
        },
        containedError: {
          backgroundColor: seal,
          color: paper,
          border: `1px solid ${sealDeep}`,
          '&:hover': {
            backgroundColor: sealDeep,
          },
        },
        outlined: {
          borderColor: ruleStrong,
          color: ink,
          backgroundColor: paper,
          '&:hover': {
            borderColor: ruleStrong,
            backgroundColor: vellum,
          },
        },
        text: {
          color: ink,
          '&:hover': {
            backgroundColor: vellum,
          },
        },
      },
    },
    MuiIconButton: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          ...noTransition,
          borderRadius: 0,
          color: ink,
          '&:hover': {
            backgroundColor: vellum,
          },
          '&:focus-visible': {
            outline: 'none',
            boxShadow: `0 0 0 2px ${paper}, 0 0 0 4px ${seal}`,
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: paper,
          color: ink,
          boxShadow: 'none',
          borderBottom: `1px solid ${ruleStrong}`,
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: '48px !important',
          paddingLeft: '0.75rem',
          paddingRight: '0.75rem',
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
        square: true,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: paper,
          borderRadius: 0,
          boxShadow: 'none',
        },
        outlined: {
          borderColor: ruleStrong,
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
        square: true,
      },
      styleOverrides: {
        root: {
          backgroundColor: paper,
          border: `1px solid ${ruleStrong}`,
          borderRadius: 0,
          boxShadow: 'none',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '0.75rem',
          '&:last-child': {
            paddingBottom: '0.75rem',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          ...noTransition,
          borderRadius: 0,
          backgroundColor: paper,
          color: ink,
          fontFamily: sans,
          '& .MuiOutlinedInput-notchedOutline': {
            ...noTransition,
            borderColor: rule,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: ruleStrong,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: seal,
            borderWidth: 1,
          },
          '&.Mui-focused': {
            boxShadow: `inset 0 -2px 0 ${seal}`,
          },
          '&.Mui-disabled': {
            backgroundColor: docket,
          },
        },
        input: {
          padding: '0.55rem 0.7rem',
          '&::placeholder': {
            color: '#8A7D69',
            opacity: 1,
          },
        },
        multiline: {
          padding: 0,
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          ...noTransition,
          borderRadius: 0,
        },
        input: {
          fontFamily: sans,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: inkSoft,
          fontFamily: mono,
          fontSize: '0.7rem',
          fontWeight: 600,
          letterSpacing: '0.035em',
          textTransform: 'uppercase',
          '&.Mui-focused': {
            color: seal,
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          marginLeft: 0,
          fontFamily: mono,
          fontSize: '0.65rem',
          color: '#8A7D69',
        },
      },
    },
    MuiChip: {
      defaultProps: {
        variant: 'outlined',
      },
      styleOverrides: {
        root: {
          ...noTransition,
          borderRadius: 0,
          borderColor: rule,
          backgroundColor: vellum,
          color: ink,
          fontFamily: mono,
          fontSize: '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.035em',
          textTransform: 'uppercase',
          height: 22,
        },
        label: {
          paddingLeft: '0.45rem',
          paddingRight: '0.45rem',
        },
        icon: {
          marginLeft: '0.4rem',
          marginRight: '-0.2rem',
        },
        colorPrimary: {
          borderColor: ink,
          backgroundColor: ink,
          color: paper,
        },
        colorError: {
          borderColor: sealDeep,
          backgroundColor: seal,
          color: paper,
        },
      },
    },
    MuiList: {
      styleOverrides: {
        root: {
          paddingTop: 0,
          paddingBottom: 0,
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          paddingTop: 0,
          paddingBottom: 0,
        },
      },
    },
    MuiListItemButton: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          ...noTransition,
          borderRadius: 0,
          minHeight: 32,
          padding: '0.35rem 0.5rem',
          borderLeft: '4px solid transparent',
          '&:hover': {
            backgroundColor: vellum,
            borderLeftColor: seal,
          },
          '&.Mui-selected': {
            backgroundColor: paper,
            borderLeftColor: seal,
            outline: `1px solid ${ruleStrong}`,
            outlineOffset: '-1px',
            '&:hover': {
              backgroundColor: vellum,
            },
          },
          '&:focus-visible': {
            outline: 'none',
            boxShadow: `0 0 0 2px ${paper}, 0 0 0 4px ${seal}`,
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: rule,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 2,
          borderRadius: 0,
          backgroundColor: docket,
        },
        bar: {
          borderRadius: 0,
          backgroundColor: ink,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          maxWidth: 280,
          borderRadius: 0,
          backgroundColor: ink,
          color: paper,
          border: `1px solid ${ink}`,
          fontFamily: mono,
          fontSize: '0.7rem',
          lineHeight: 1.4,
          padding: '0.45rem 0.55rem',
        },
        arrow: {
          color: ink,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          boxShadow: 'none',
          border: `1px solid ${ruleStrong}`,
          fontFamily: sans,
          padding: '0.45rem 0.75rem',
        },
        standardError: {
          backgroundColor: '#F4DED8',
          color: sealDeep,
        },
        standardWarning: {
          backgroundColor: '#FDECC8',
          color: '#78350F',
        },
        standardSuccess: {
          backgroundColor: '#E2F3E6',
          color: '#14532D',
        },
        standardInfo: {
          backgroundColor: '#E4ECF6',
          color: '#172B45',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          border: `1px solid ${ruleStrong}`,
          boxShadow: 'none',
          backgroundImage: 'none',
          backgroundColor: paper,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: serif,
          fontSize: '1.5rem',
          fontWeight: 700,
          letterSpacing: '-0.035em',
          padding: '1rem 1rem 0.5rem',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '0.75rem 1rem',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '0.75rem 1rem 1rem',
          borderTop: `1px solid ${rule}`,
        },
      },
    },
  },
});

export default theme;