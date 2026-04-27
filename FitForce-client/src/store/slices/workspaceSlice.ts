import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface WorkspaceSubscription {
  id: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  teamMembersEnabled: boolean;
  package?: {
    id: string;
    name: string;
    teamMembersEnabled: boolean;
    [key: string]: any;
  };
}

export interface WorkspaceState {
  id: string | null;
  subdomain: string | null;
  subscription: WorkspaceSubscription | null;
  subscriptionLoaded: boolean;
}

const initialState: WorkspaceState = {
  id: null,
  subdomain: null,
  subscription: null,
  subscriptionLoaded: false
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
      state.subscription = null;
      state.subscriptionLoaded = false;
    },
    setSubdomain: (state, action: PayloadAction<string | null>) => {
      state.subdomain = action.payload;
    },
    setWorkspaceSubscription: (state, action: PayloadAction<WorkspaceSubscription | null>) => {
      state.subscription = action.payload;
      state.subscriptionLoaded = true;
    }
  }
});

export const { setWorkspace, clearWorkspace, setSubdomain, setWorkspaceSubscription } = workspaceSlice.actions;
export default workspaceSlice.reducer;
