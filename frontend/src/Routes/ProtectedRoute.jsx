import {
  Navigate,
  useLocation
} from "react-router-dom";

import useAuth from "../hooks/useAuth.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

function ProtectedRoute({ children }) {
  const {
    loading,
    isAuthenticated
  } = useAuth();

  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location
        }}
      />
    );
  }

  return children;
}

export default ProtectedRoute;