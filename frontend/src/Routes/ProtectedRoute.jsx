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
    const returnTo = `${location.pathname}${location.search}${location.hash}`;

    return (
      <Navigate
        to="/login"
        replace
        state={{
          // Login/Register historically read state.from.pathname. Keep that
          // contract, but preserve the complete internal route so signed
          // recovery links and other protected deep links survive sign-in.
          from: {
            ...location,
            pathname: returnTo,
            search: "",
            hash: "",
          },
          redirectTo: returnTo,
        }}
      />
    );
  }

  return children;
}

export default ProtectedRoute;
