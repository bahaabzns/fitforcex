import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface WorkspaceState {
  id: string | null;
  subdomain: string | null;
}

const initialState: WorkspaceState = {
  id: null,
  subdomain: null
};

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    setWorkspace: (state, action: PayloadAction<{ id: string; subdomain?: string | null }>) => {
      state.id = action.payload.id;
      state.subdomain = action.payload.subdomain ?? state.subdomain;
    },
    clearWorkspace: (state) => {
      state.id = null;
      state.subdomain = null;
    },
    setSubdomain: (state, action: PayloadAction<string | null>) => {
      state.subdomain = action.payload;
    }
  }
});

export const { setWorkspace, clearWorkspace, setSubdomain } = workspaceSlice.actions;
export default workspaceSlice.reducer;
