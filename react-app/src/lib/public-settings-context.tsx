import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchPublicSettings,
  type PublicSettingValues,
  type SupplierDisplay,
} from '../api/publicSettings';

interface PublicSettingsContextValue {
  /** How supplier identity may appear on the storefront. */
  supplierDisplay: SupplierDisplay;
  /** True until the first settings request settles. */
  isLoading: boolean;
}

/**
 * `CARD` matches the historical storefront, so it is the safe fallback while
 * the public settings request is in flight or unavailable.
 */
const DEFAULT_VALUE: PublicSettingsContextValue = {
  supplierDisplay: 'CARD',
  isLoading: true,
};

const PublicSettingsContext = createContext<PublicSettingsContextValue>(DEFAULT_VALUE);

export function normalizeSupplierDisplay(value: unknown): SupplierDisplay {
  return value === 'NAME' || value === 'HIDDEN' ? value : 'CARD';
}

function readSettings(settings: PublicSettingValues): SupplierDisplay {
  return normalizeSupplierDisplay(settings.storefront_supplier_display);
}

export function PublicSettingsProvider({ children }: { children: ReactNode }) {
  const [supplierDisplay, setSupplierDisplay] = useState<SupplierDisplay>('CARD');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const response = await fetchPublicSettings();

      if (cancelled) return;

      if (response.success && response.data) {
        setSupplierDisplay(readSettings(response.data.settings));
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ supplierDisplay, isLoading }),
    [supplierDisplay, isLoading],
  );

  return (
    <PublicSettingsContext.Provider value={value}>{children}</PublicSettingsContext.Provider>
  );
}

export function usePublicSettings(): PublicSettingsContextValue {
  return useContext(PublicSettingsContext);
}
