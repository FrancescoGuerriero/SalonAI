import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import AppErrorBoundary from "./components/system/AppErrorBoundary.jsx";
import NetworkStatus from "./components/system/NetworkStatus.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { BookingProvider } from "./context/BookingContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";

import "./index.css";
import "./commerce.css";
import "./styles/managementExperience.css";
import "./styles/commerceExperience.css";
import "./styles/customerAccount.css";
import "./styles/authExperience.css";
import "./styles/notificationExperience.css";
import "./styles/helpCentre.css";
import "./styles/accessibilityExperience.css";
import "./styles/resilienceExperience.css";
import "./styles/customerSettings.css";
import "./styles/customerExperienceSuite.css";
import "./styles/manageAccount.css";
import "./styles/profileMedia.css";
import "./styles/about.css";
import "./styles/staffProfile.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <CartProvider>
        <BookingProvider>
          <AppErrorBoundary>
            <NetworkStatus />
            <App />
          </AppErrorBoundary>
        </BookingProvider>
      </CartProvider>
    </AuthProvider>
  </React.StrictMode>
);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window.__salonaiInstallPrompt = event;
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // The application remains fully usable online if registration is blocked.
    });
  });
}
