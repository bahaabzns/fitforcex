// ==============================|| OVERRIDES - APP BAR ||============================== //

export default function AppBar(theme?: any) {
  return {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'transparent' // Let individual AppBar components set their own background via sx prop
        }
      }
    }
  };
}

