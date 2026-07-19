import {
  BrowserRouter,
  Navigate,
  Route,
  Routes
} from "react-router-dom";

import MainLayout from "./components/MainLayout.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";

import Booking from "./pages/Booking.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Services from "./pages/Services.jsx";
import Stylists from "./pages/Stylists.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
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

          <Route
            path="booking"
            element={
              <ProtectedRoute>
                <Booking />
              </ProtectedRoute>
            }
          />

          <Route
            path="dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;