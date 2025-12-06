// ==============================|| OVERRIDES - PAPER ||============================== //

export default function Paper(theme?: any) {
  return {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none'
          // backgroundColor will be set by theme.palette.background.paper or individual components
        }
      }
    }
  };
}

