import { useEffect, useState } from "react";
import { CheckCircle2, WifiOff } from "lucide-react";

export default function NetworkStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    let restoredTimer;

    function handleOffline() {
      clearTimeout(restoredTimer);
      setOnline(false);
      setShowRestored(false);
    }

    function handleOnline() {
      setOnline(true);
      setShowRestored(true);

      restoredTimer = window.setTimeout(() => {
        setShowRestored(false);
      }, 3500);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      clearTimeout(restoredTimer);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!online) {
    return (
      <div className="network-status network-status-offline" role="alert">
        <WifiOff size={18} />
        <span>
          You are offline. Some SalonAI features may be temporarily
          unavailable.
        </span>
      </div>
    );
  }

  if (showRestored) {
    return (
      <div className="network-status network-status-online" role="status">
        <CheckCircle2 size={18} />
        <span>Your internet connection has been restored.</span>
      </div>
    );
  }

  return null;
}
