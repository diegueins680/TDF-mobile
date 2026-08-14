import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { AppThemeProvider } from '../src/theme/ThemeProvider';

export function renderWithTheme(ui: ReactElement) {
  return render(ui, { wrapper: AppThemeProvider });
}
