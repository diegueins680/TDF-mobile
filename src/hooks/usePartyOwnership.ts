import { useCallback, useEffect, useRef } from 'react';
import { getAuthSessionVersion } from '../api/client';

export function usePartyOwnership(partyId: string | null | undefined) {
  const version = getAuthSessionVersion();
  const owner = useRef({ partyId, version, generation: 0 });
  if (owner.current.partyId !== partyId || owner.current.version !== version) {
    owner.current = { partyId, version, generation: owner.current.generation + 1 };
  }
  const generation = owner.current.generation;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return useCallback(
    (ownerPartyId: string | null | undefined) => mounted.current && Boolean(ownerPartyId)
      && owner.current.partyId === ownerPartyId
      && owner.current.generation === generation
      && getAuthSessionVersion() === version,
    [generation, version],
  );
}
