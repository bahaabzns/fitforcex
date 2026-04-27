import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface MessengerState {
  unreadTotal: number;
}

const initialState: MessengerState = {
  unreadTotal: 0
};

const messengerSlice = createSlice({
  name: 'messenger',
  initialState,
  reducers: {
    setUnreadTotal: (state, action: PayloadAction<number>) => {
      state.unreadTotal = Math.max(0, action.payload || 0);
    }
  }
});

export const { setUnreadTotal } = messengerSlice.actions;
export default messengerSlice.reducer;

