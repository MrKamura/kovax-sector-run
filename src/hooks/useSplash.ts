import { useEffect, useState, useRef, useCallback } from "react";
import { SPLASH_VISIBLE_MS } from "../constants";

export function useSplash(showSplash: boolean): {
  splashFading: boolean;
  splashDismissed: boolean;
  setSplashDismissed: (v: boolean) => void;
  handleSplashFadeEnd: () => void;
} {
  const [splashFading, setSplashFading] = useState(false);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const splashFadeStarted = useRef(false);

  useEffect(() => {
    if (!showSplash || splashFadeStarted.current) return;
    const t = setTimeout(() => {
      splashFadeStarted.current = true;
      setSplashFading(true);
    }, SPLASH_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [showSplash]);

  const handleSplashFadeEnd = useCallback(() => {
    if (splashFading) setSplashDismissed(true);
    splashFadeStarted.current = false;
    setSplashFading(false);
  }, [splashFading]);

  return {
    splashFading,
    splashDismissed,
    setSplashDismissed,
    handleSplashFadeEnd,
  };
}
