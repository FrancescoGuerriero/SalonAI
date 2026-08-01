import { Navigate } from "react-router-dom";

import LoadingSpinner from "../components/LoadingSpinner.jsx";
import useAuth from "../hooks/useAuth.js";
import { isManagementRole } from "../utils/roles.js";

export default function ManagementRoute({ children }) {
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

  if (!isManagementRole(user?.role)) {
    return <Navigate to="/booking" replace />;
  }

  return children;
}
