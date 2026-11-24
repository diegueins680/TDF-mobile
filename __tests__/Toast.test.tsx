import React from 'react';
import { AccessibilityInfo, Text, TouchableOpacity } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { Toast } from '../src/components/Toast';
import { useToast } from '../src/hooks/useToast';

function Harness() {
  const toast = useToast();
  return (
    <>
      <TouchableOpacity onPress={() => toast.show('Enlace copiado', 1000)}><Text>copy</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => toast.show('   ')}><Text>blank</Text></TouchableOpacity>
      <Toast opacity={toast.opacity} message={toast.message} />
    </>
  );
}

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined).mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders nothing until a message is shown', () => {
    render(<Harness />);
    expect(screen.queryByTestId('toast-message')).toBeNull();
  });

  it('shows the message, announces it, and clears itself', () => {
    render(<Harness />);
    fireEvent.press(screen.getByText('copy'));
    expect(screen.getByTestId('toast-message').props.children).toBe('Enlace copiado');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Enlace copiado');
    act(() => { jest.advanceTimersByTime(1500); });
    expect(screen.queryByTestId('toast-message')).toBeNull();
  });

  it('ignores blank messages', () => {
    render(<Harness />);
    fireEvent.press(screen.getByText('blank'));
    expect(screen.queryByTestId('toast-message')).toBeNull();
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
  });

  it('does not update state after unmount', () => {
    const rendered = render(<Harness />);
    fireEvent.press(screen.getByText('copy'));
    rendered.unmount();
    expect(() => act(() => { jest.advanceTimersByTime(5000); })).not.toThrow();
  });
});
