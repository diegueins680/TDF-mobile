/**
 * FirstRunProvider.tsx
 *
 * Owns the "is this user new?" derivation used by the
 * `single-feature-onboarding-v1` A/B test. Lives INSIDE AuthProvider so we
 * can observe partyId, but its install-seen snapshot is taken at mount —
 * before we flip the persistent flag — so the read is uncontaminated.
 *
 * Contract (see src/lib/firstRunFlags.ts):
 *   - "new user" iff (fresh install at boot) AND (first signup for partyId).
 *   - Once resolved for a partyId, the decision is persisted under
 *     `tdf-new-user-cohort:<partyId>` so the cohort is sticky across
 *     sessions and we never recompute on subsequent launches.
 */
import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  getIsFreshInstall,
  markInstallSeen,
  resolveNewUserCohort,
} from '../lib/firstRunFlags';
import { useAuth } from './AuthProvider';

type FirstRunContextValue = {
  /** True once the install-seen snapshot has been captured at boot. */
  bootSnapshotReady: boolean;
  /** True once we've resolved the cohort for the active partyId (or there is none). */
  cohortReady: boolean;
  /** Whether the active partyId qualifies as a brand-new user. */
  isNewUser: boolean;
};

const FirstRunContext = createContext<FirstRunContextValue>({
  bootSnapshotReady: false,
  cohortReady: false,
  isNewUser: false,
});

export function FirstRunProvider({ children }: PropsWithChildren) {
  const { partyId } = useAuth();

  // Snapshot freshInstall BEFORE we mark install seen. Use a ref so the
  // value survives re-renders without re-reading AsyncStorage.
  const freshInstallAtBootRef = useRef<boolean | null>(null);
  const [bootSnapshotReady, setBootSnapshotReady] = useState(false);

  const [cohortReady, setCohortReady] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  // Boot-time snapshot: read freshInstall, then flip the persistent flag.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fresh = await getIsFreshInstall();
        if (cancelled) return;
        freshInstallAtBootRef.current = fresh;
        setBootSnapshotReady(true);
      } finally {
        // Always flip the install-seen flag so future launches are not
        // treated as fresh, even if the read above failed.
        await markInstallSeen();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cohort resolution: when we know the partyId and have the boot snapshot,
  // resolve (and persist) the new-user cohort decision once.
  useEffect(() => {
    if (!bootSnapshotReady) return;

    if (!partyId) {
      setCohortReady(false);
      setIsNewUser(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const freshAtBoot = freshInstallAtBootRef.current ?? false;
      const isNew = await resolveNewUserCohort(partyId, freshAtBoot);
      if (cancelled) return;
      setIsNewUser(isNew);
      setCohortReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [bootSnapshotReady, partyId]);

  return (
    <FirstRunContext.Provider value={{ bootSnapshotReady, cohortReady, isNewUser }}>
      {children}
    </FirstRunContext.Provider>
  );
}

export function useFirstRun(): FirstRunContextValue {
  return useContext(FirstRunContext);
}
