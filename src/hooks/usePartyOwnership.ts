import { useCallback, useEffect, useRef } from 'react';

export function usePartyOwnership(partyId: string | null | undefined) {
  const activePartyIdRef = useRef(partyId);
  activePartyIdRef.current = partyId;

  useEffect(() => () => {
    activePartyIdRef.current = null;
  }, []);

  return useCallback(
    (ownerPartyId: string | null | undefined) => Boolean(ownerPartyId)
      && activePartyIdRef.current === ownerPartyId,
    [],
  );
}
