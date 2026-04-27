// ==============================|| OVERRIDES - BODY ||============================== //

export default function Body(theme: any) {
  return {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFeatureSettings: '"salt"',
          backgroundColor: `${theme.palette.background.default} !important`,
          color: `${theme.palette.text.primary} !important`,
          // Ensure body background is always set from theme
          '&[data-dashboard]': {
            backgroundColor: `${theme.palette.background.default} !important`,
            color: `${theme.palette.text.primary} !important`
          }
        },
        html: {
          backgroundColor: `${theme.palette.background.default} !important`,
          // Ensure html background is always set from theme
          '&[data-dashboard]': {
            backgroundColor: `${theme.palette.background.default} !important`
          }
        },
        '#__next': {
          backgroundColor: `${theme.palette.background.default} !important`,
          minHeight: '100vh',
          color: theme.palette.text.primary
        },
        '*': {
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px'
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: theme.palette.background.paper
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: theme.palette.mode === 'dark' 
              ? theme.palette.secondary[700] 
              : theme.palette.secondary[400],
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: theme.palette.mode === 'dark' 
                ? theme.palette.secondary[600] 
                : theme.palette.secondary[500]
            }
          }
        }
      }
    }
  };
}
