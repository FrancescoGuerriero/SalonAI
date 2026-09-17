import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './styles/salonTheme.css';
import './styles/customerDashboard.css';
import './styles/staffDashboard.css';
import './styles/adminDashboard.css';
import './styles/appointmentManagement.css';
import './styles/assistantAvailability.css';
import './styles/about.css';
import './styles/customerBookings.css';
import './styles/accessibilityExperience.css';
import './styles/notificationExperience.css';
import './styles/resilienceExperience.css';
import './styles/helpCentre.css';
import './styles/customerSettings.css';
import './styles/shop.css';
import AppErrorBoundary from './components/system/AppErrorBoundary.jsx';
import NetworkStatus from './components/system/NetworkStatus.jsx';
import { FeatureControlProvider } from './context/FeatureControlContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <FeatureControlProvider>
        <NetworkStatus />
        <App />
      </FeatureControlProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
