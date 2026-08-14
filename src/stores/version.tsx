import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { VersionInfo } from '@/version';

interface OnlineVersionInfo {
  version: string;
  build: number;
  buildId: string;
  minSupportedVersion: string;
  releaseNotes?: string;
  updateRequired: boolean;
}

interface VersionContextType {
  localVersion: VersionInfo;
  onlineVersion: OnlineVersionInfo | null;
  isChecking: boolean;
  checkError: string | null;
  checkVersion: () => Promise<void>;
  isUpdateAvailable: boolean;
  isUpdateRequired: boolean;
  dismissUpdate: () => void;
  updateDismissed: boolean;
  setUpdateDismissed: (v: boolean) => void;
  lastCheck: number | null;
}

const VersionContext = createContext<VersionContextType | undefined>(undefined);

const STORAGE_KEY = 'fitmanager-version-check';
const DISMISS_KEY = 'fitmanager-update-dismissed';

interface StoredCheck {
  onlineVersion: OnlineVersionInfo;
  timestamp: number;
}

function loadStoredCheck(): StoredCheck | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    return null;
  }
  return null;
}

function loadDismissed(): { version: string; timestamp: number } | null {
  try {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    return null;
  }
  return null;
}

function compareVersions(local: string, online: string): number {
  const localParts = local.split('.').map(Number);
  const onlineParts = online.split('.').map(Number);
  for (let i = 0; i < Math.max(localParts.length, onlineParts.length); i++) {
    const l = localParts[i] || 0;
    const o = onlineParts[i] || 0;
    if (l !== o) return l - o;
  }
  return 0;
}

function isVersionSupported(local: string, minSupported: string): boolean {
  return compareVersions(local, minSupported) >= 0;
}

export function VersionProvider({ children }: { children: ReactNode }) {
  const [localVersion] = useState<VersionInfo>(__VERSION_INFO__);
  const [onlineVersion, setOnlineVersion] = useState<OnlineVersionInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<number | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const storedCheck = useMemo(() => loadStoredCheck(), []);
  const dismissed = useMemo(() => loadDismissed(), []);

  useEffect(() => {
    if (storedCheck && !isChecking) {
      setOnlineVersion(storedCheck.onlineVersion);
      setLastCheck(storedCheck.timestamp);
    }
  }, [storedCheck, isChecking]);

  useEffect(() => {
    if (dismissed && onlineVersion && dismissed.version === onlineVersion.buildId) {
      setUpdateDismissed(true);
    } else if (onlineVersion && dismissed && dismissed.version !== onlineVersion.buildId) {
      setUpdateDismissed(false);
    }
  }, [dismissed, onlineVersion]);

  const checkVersion = useCallback(async () => {
    setIsChecking(true);
    setCheckError(null);
    try {
      const response = await fetch('/version.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('Failed to fetch version');
      const data = await response.json();

      const online: OnlineVersionInfo = {
        version: data.version,
        build: data.build,
        buildId: data.buildId,
        minSupportedVersion: data.minSupportedVersion,
        updateRequired: !isVersionSupported(localVersion.version, data.minSupportedVersion),
      };

      setOnlineVersion(online);
      setLastCheck(Date.now());
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ onlineVersion: online, timestamp: Date.now() }));

      if (online.buildId !== localVersion.buildId) {
        const dismissedStored = loadDismissed();
        if (!dismissedStored || dismissedStored.version !== online.buildId) {
          setUpdateDismissed(false);
        }
      }
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Version check failed');
    } finally {
      setIsChecking(false);
    }
  }, [localVersion.version, localVersion.buildId]);

  useEffect(() => {
    checkVersion();
  }, [checkVersion]);

  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
      if (lastCheck && now - lastCheck > 5 * 60 * 1000) {
        checkVersion();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkVersion, lastCheck]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (lastCheck && now - lastCheck > 30 * 60 * 1000) {
        checkVersion();
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [checkVersion, lastCheck]);

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();
    const timeout = setTimeout(() => {
      checkVersion();
    }, msUntilMidnight);
    return () => clearTimeout(timeout);
  }, [checkVersion]);

  const isUpdateAvailable = onlineVersion !== null && onlineVersion.buildId !== localVersion.buildId;
  const isUpdateRequired = onlineVersion !== null && onlineVersion.updateRequired && !isVersionSupported(localVersion.version, onlineVersion.minSupportedVersion);

  const dismissUpdate = useCallback(() => {
    if (onlineVersion) {
      localStorage.setItem(DISMISS_KEY, JSON.stringify({ version: onlineVersion.buildId, timestamp: Date.now() }));
      setUpdateDismissed(true);
    }
  }, [onlineVersion]);

  const ctxValue = useMemo(() => ({
    localVersion,
    onlineVersion,
    isChecking,
    checkError,
    checkVersion,
    isUpdateAvailable,
    isUpdateRequired,
    dismissUpdate,
    updateDismissed,
    setUpdateDismissed,
    lastCheck,
  }), [
    localVersion,
    onlineVersion,
    isChecking,
    checkError,
    checkVersion,
    isUpdateAvailable,
    isUpdateRequired,
    dismissUpdate,
    updateDismissed,
    lastCheck,
  ]);

  return (
    <VersionContext.Provider value={ctxValue}>
      {children}
    </VersionContext.Provider>
  );
}

export function useVersion(): VersionContextType {
  const ctx = useContext(VersionContext);
  if (!ctx) throw new Error('useVersion must be used within VersionProvider');
  return ctx;
}