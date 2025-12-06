// ==============================|| OVERRIDES - DRAWER ||============================== //

export default function Drawer(theme: any) {
  return {
    MuiDrawer: {
      styleOverrides: {
        root: {
          '& .MuiDrawer-paper': {
            backgroundImage: 'none'
          }
        },
        paper: {
          backgroundImage: 'none'
          // Background color is set by MiniDrawerStyled via sx prop using theme.palette.background.default
          // This ensures the drawer uses the correct theme background color
        }
      }
    }
  };
}
