import { Navigate } from "react-router-dom";

import LoadingSpinner from "../components/LoadingSpinner.jsx";
import useAuth from "../hooks/useAuth.js";
import { isSuperAdminRole } from "../utils/roles.js";

export default function AdminRoute({ children }) {
  const {
    loading,
    isAuthenticated,
    user,
  } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isSuperAdminRole(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
