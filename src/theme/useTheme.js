import { useSelector } from 'react-redux';
import { useColorScheme } from 'react-native';
import { colors } from './colors';

export const useTheme = () => {
  const mode = useSelector(state => state.theme?.mode) || 'system';
  const systemColorScheme = useColorScheme();

  const activeMode = mode === 'system' ? systemColorScheme || 'light' : mode;
  return {
    mode,
    activeMode,
    colors: colors[activeMode] || colors.light,
  };
};
