import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MerchStoreReputation } from '../src/components/merch/MerchStoreReputation';

jest.mock('../src/theme/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      border: '#999',
      surface: '#fff',
      textPrimary: '#111',
      textSecondary: '#555',
      actionPrimary: '#333',
      actionPrimaryContrast: '#fff',
    },
  }),
}));

describe('MerchStoreReputation', () => {
  it('shows a neutral new-store state without a synthetic number', () => {
    render(<MerchStoreReputation summary={{
      subjectKind: 'store',
      state: 'new_store',
      rating: null,
      commercialReputation: true,
      verifiedReviewCount: 0,
    }} />);

    expect(screen.getByText('REPUTACIÓN COMERCIAL')).toBeTruthy();
    expect(screen.getByText('Tienda nueva')).toBeTruthy();
    expect(screen.queryByText(/★/)).toBeNull();
  });

  it('renders the one-decimal public score and verified count', () => {
    render(<MerchStoreReputation summary={{
      subjectKind: 'store',
      state: 'published',
      rating: 4.24,
      commercialReputation: true,
      verifiedReviewCount: 8,
    }} />);

    expect(screen.getByText('4.2 ★ / 5')).toBeTruthy();
    expect(screen.getByText('8 evaluaciones verificadas')).toBeTruthy();
  });
});
