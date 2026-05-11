import { createSlice } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const initialState = {
  mode: 'system', // 'system' | 'light' | 'dark'
};

export const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setThemeMode: (state, action) => {
      state.mode = action.payload;
      AsyncStorage.setItem('themeMode', action.payload).catch(err => 
        console.error('Failed to persist theme:', err)
      );
    },
    loadThemeMode: (state, action) => {
      state.mode = action.payload;
    }
  }
});

export const { setThemeMode, loadThemeMode } = themeSlice.actions;
export default themeSlice.reducer;
