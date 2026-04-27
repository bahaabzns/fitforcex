'use client';

import { ReactNode } from 'react';
import { Grid } from '@mui/material';

type WorkoutMakerDesktopProps = {
  left: ReactNode;
  middle: ReactNode;
  right: ReactNode;
};

export default function WorkoutMakerDesktop({ left, middle, right }: WorkoutMakerDesktopProps) {
  return (
    <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
      <Grid item xs={4}>
        {left}
      </Grid>
      <Grid item xs={4}>
        {middle}
      </Grid>
      <Grid item xs={4}>
        {right}
      </Grid>
    </Grid>
  );
}


