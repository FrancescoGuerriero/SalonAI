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
