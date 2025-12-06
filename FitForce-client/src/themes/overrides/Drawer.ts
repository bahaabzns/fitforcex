// ==============================|| OVERRIDES - DRAWER ||============================== //

export default function Drawer(theme?: any) {
  return {
    MuiDrawer: {
      styleOverrides: {
        root: {
          '& .MuiDrawer-paper': {
            backgroundImage: 'none',
            // Background will be set by individual drawer components via sx prop
          }
        },
        paper: {
          backgroundImage: 'none',
          // Individual drawer components should set bgcolor via sx prop
          // This ensures theme.palette.background.default is used
        }
      }
    }
  };
}
