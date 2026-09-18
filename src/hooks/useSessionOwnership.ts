import { useCallback, useEffect, useRef } from 'react';

// Capture a particular session occurrence, including A -> B -> A. Keeping the
// predicate in mutation variables also protects callbacks replaced by a rerender.
export function useSessionOwnership(partyId: string | null | undefined, token: string | null | undefined) {
  const session = useRef({ partyId, token });
  const mounted = useRef(true);
  if (session.current.partyId !== partyId || session.current.token !== token) {
    session.current = { partyId, token };
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return useCallback(() => {
    const owner = session.current;
    return () => mounted.current && Boolean(owner.partyId && owner.token?.trim()) && session.current === owner;
  }, []);
}
