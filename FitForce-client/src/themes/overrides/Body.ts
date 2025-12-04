// ==============================|| OVERRIDES - BODY ||============================== //

export default function Body(theme: any) {
  return {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFeatureSettings: '"salt"',
          backgroundColor: theme.palette.background.default,
          color: theme.palette.text.primary
        }
      }
    }
  };
}
