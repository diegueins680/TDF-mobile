import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { LegalDisclosure } from '../src/components/LegalDisclosure';

describe('LegalDisclosure', () => {
  it('starts collapsed and announces its expanded state', async () => {
    render(
      <LegalDisclosure title="Política de reembolso" summary="Versión v1">
        <Text>Texto completo</Text>
      </LegalDisclosure>,
    );
    await act(async () => {});

    const toggle = screen.getByRole('button', { name: 'Política de reembolso' });
    expect(toggle.props.accessibilityState).toEqual({ expanded: false });
    expect(screen.getByText('Versión v1')).toBeTruthy();
    expect(screen.getByText('Leer completo')).toBeTruthy();
    expect(screen.queryByText('Texto completo')).toBeNull();

    fireEvent.press(toggle);
    expect(toggle.props.accessibilityState).toEqual({ expanded: true });
    expect(screen.getByText('Texto completo')).toBeTruthy();
    expect(screen.getByText('Ocultar')).toBeTruthy();

    fireEvent.press(toggle);
    expect(screen.queryByText('Texto completo')).toBeNull();
  });

  it('keeps sibling documents independent and supports a distinct spoken name', async () => {
    render(
      <>
        <LegalDisclosure title="Texto del consentimiento" accessibilityLabel="Texto del consentimiento: A">
          <Text>A</Text>
        </LegalDisclosure>
        <LegalDisclosure title="Texto del consentimiento" accessibilityLabel="Texto del consentimiento: B">
          <Text>B</Text>
        </LegalDisclosure>
      </>,
    );
    await act(async () => {});

    fireEvent.press(screen.getByRole('button', { name: 'Texto del consentimiento: A' }));
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.queryByText('B')).toBeNull();
    expect(screen.getByRole('button', { name: 'Texto del consentimiento: B' }).props.accessibilityState).toEqual({ expanded: false });
  });
});
