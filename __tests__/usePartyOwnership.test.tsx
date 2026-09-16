import React from 'react';
import { render } from '@testing-library/react-native';

import { usePartyOwnership } from '../src/hooks/usePartyOwnership';

describe('usePartyOwnership', () => {
  let ownsParty: ((ownerPartyId: string | null | undefined) => boolean) | undefined;

  function Probe({ partyId }: { partyId: string | null }) {
    ownsParty = usePartyOwnership(partyId);
    return null;
  }

  beforeEach(() => {
    ownsParty = undefined;
  });

  it('tracks account changes and fails closed after its screen unmounts', () => {
    const view = render(<Probe partyId="42" />);
    expect(ownsParty?.('42')).toBe(true);
    expect(ownsParty?.('77')).toBe(false);

    view.rerender(<Probe partyId="77" />);
    expect(ownsParty?.('42')).toBe(false);
    expect(ownsParty?.('77')).toBe(true);

    view.unmount();
    expect(ownsParty?.('77')).toBe(false);
  });
});
