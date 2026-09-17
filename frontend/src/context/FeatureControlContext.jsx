import { createContext, useCallback, useEffect, useMemo, useState } from "react";

import API from "../api/axios.js";
import {
  DEFAULT_FEATURE_FLAGS,
  resolveFeatureFlags,
} from "../features/controls/featureDefinitions.js";

export const FeatureControlContext = createContext({
  features: DEFAULT_FEATURE_FLAGS,
  loading: true,
  isFeatureEnabled: (featureId) => DEFAULT_FEATURE_FLAGS[featureId] !== false,
  refreshFeatures: async () => {},
});

export function FeatureControlProvider({ children }) {
  const [features, setFeatures] = useState(DEFAULT_FEATURE_FLAGS);
  const [loading, setLoading] = useState(true);

  const refreshFeatures = useCallback(async () => {
    try {
      const response = await API.get("/app-configuration/features", {
        _skipAuthRefresh: true,
      });
      setFeatures(resolveFeatureFlags(response.data));
    } catch {
      // Backend enforcement remains authoritative if public configuration is unavailable.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFeatures();
  }, [refreshFeatures]);

  const value = useMemo(
    () => ({
      features,
      loading,
      isFeatureEnabled: (featureId) => features[featureId] !== false,
      refreshFeatures,
    }),
    [features, loading, refreshFeatures]
  );

  return (
    <FeatureControlContext.Provider value={value}>
      {children}
    </FeatureControlContext.Provider>
  );
}
