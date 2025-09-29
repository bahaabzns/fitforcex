import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { APP_CONFIG } from '@/lib/config';

export interface SettingsState {
  theme: 'light' | 'dark';
  lang: 'en' | 'ar';
}

const initialState: SettingsState = {
  theme: (APP_CONFIG.defaultTheme as 'light' | 'dark') || 'light',
  lang: (APP_CONFIG.defaultLang as 'en' | 'ar') || 'en'
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },
    setLang: (state, action: PayloadAction<'en' | 'ar'>) => {
      state.lang = action.payload;
    }
  }
});

export const { setTheme, setLang } = settingsSlice.actions;
export default settingsSlice.reducer;
