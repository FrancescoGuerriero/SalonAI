import { useEffect, useState } from "react";
import { CheckCircle2, WifiOff } from "lucide-react";

function getInitialOnlineState() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export default function NetworkStatus() {
  const [online, setOnline] = useState(getInitialOnlineState);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    let restoredTimer;

    function clearRestoredTimer() {
      if (restoredTimer) {
        window.clearTimeout(restoredTimer);
        restoredTimer = undefined;
      }
    }

    function handleOffline() {
      clearRestoredTimer();
      setOnline(false);
      setShowRestored(false);
    }

    function handleOnline() {
      clearRestoredTimer();
      setOnline(true);
      setShowRestored(true);

      restoredTimer = window.setTimeout(() => {
        setShowRestored(false);
      }, 3500);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      clearRestoredTimer();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!online) {
    return (
      <div
        className="network-status network-status-offline"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        <WifiOff size={18} aria-hidden="true" />
        <span>
          You are offline. Some SalonAI features may be temporarily
          unavailable.
        </span>
      </div>
    );
  }

  if (showRestored) {
    return (
      <div
        className="network-status network-status-online"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <CheckCircle2 size={18} aria-hidden="true" />
        <span>Your internet connection has been restored.</span>
      </div>
    );
  }

  return null;
}
