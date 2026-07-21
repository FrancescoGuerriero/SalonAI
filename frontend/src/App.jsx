import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import MainLayout from "./components/MainLayout.jsx";

import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import AdminRoute from "./routes/AdminRoute.jsx";

import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Services from "./pages/Services.jsx";
import Stylists from "./pages/Stylists.jsx";
import Booking from "./pages/Booking.jsx";

import DashboardPage from "./pages/DashboardPage.jsx";
import CustomersPage from "./pages/CustomersPage.jsx";
import ServicesPage from "./pages/ServicesPage.jsx";
import AppointmentsPage from "./pages/AppointmentsPage.jsx";
import CommunicationsPage from "./pages/CommunicationsPage.jsx";

import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminServices from "./pages/AdminServices.jsx";
import AdminStylists from "./pages/AdminStylists.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          {/* Public routes */}
          <Route index element={<Home />} />

          <Route
            path="services"
            element={<Services />}
          />

          <Route
            path="stylists"
            element={<Stylists />}
          />

          <Route
            path="login"
            element={<Login />}
          />

          <Route
            path="register"
            element={<Register />}
          />

          {/* Authenticated customer booking */}
          <Route
            path="booking"
            element={
              <ProtectedRoute>
                <Booking />
              </ProtectedRoute>
            }
          />

          {/* Salon management routes */}
          <Route
            path="dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="customers"
            element={
              <ProtectedRoute>
                <CustomersPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="appointments"
            element={
              <ProtectedRoute>
                <AppointmentsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="communications"
            element={
              <ProtectedRoute>
                <CommunicationsPage />
              </ProtectedRoute>
            }
          />

          {/*
            The management services page uses /manage/services
            because /services is already the public services page.
          */}
          <Route
            path="manage/services"
            element={
              <ProtectedRoute>
                <ServicesPage />
              </ProtectedRoute>
            }
          />

          {/* Administrator routes */}
          <Route
            path="admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />

          <Route
            path="admin/services"
            element={
              <AdminRoute>
                <AdminServices />
              </AdminRoute>
            }
          />

          <Route
            path="admin/stylists"
            element={
              <AdminRoute>
                <AdminStylists />
              </AdminRoute>
            }
          />

          {/* Unknown routes */}
          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;