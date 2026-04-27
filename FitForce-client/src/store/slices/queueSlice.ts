import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface QueueState {
  submittedCount: number;
}

const initialState: QueueState = {
  submittedCount: 0
};

const queueSlice = createSlice({
  name: 'queue',
  initialState,
  reducers: {
    setSubmittedCount: (state, action: PayloadAction<number>) => {
      state.submittedCount = Math.max(0, action.payload || 0);
    }
  }
});

export const { setSubmittedCount } = queueSlice.actions;
export default queueSlice.reducer;

