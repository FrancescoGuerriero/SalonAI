import { Navigate } from "react-router-dom";

import authService from "../services/authService.js";

function AdminRoute({ children }) {
  const token = authService.getToken();
  const user = authService.getCurrentUser();

  if (!token || !user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (user.role !== "admin") {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}

export default AdminRoute;