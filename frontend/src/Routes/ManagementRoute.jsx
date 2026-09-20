import {
  Navigate,
  useLocation,
} from "react-router-dom";

import LoadingSpinner from "../components/LoadingSpinner.jsx";
import useAuth from "../hooks/useAuth.js";
import {
  hasPermission,
} from "../utils/permissions.js";
import {
  isAdminRole,
  isManagementRole,
} from "../utils/roles.js";

export const MANAGEMENT_PERMISSION_RULES = [
  [["/dashboard"], ["dashboard:view"]],

  [[
    "/customers",
    "/customer-follow-ups",
    "/customer-segments",
    "/customer-value",
    "/retention-actions",
    "/retention-predictions",
    "/rebooking-opportunities",
    "/customer-experience-management",
    "/loyalty",
    "/gift-cards",
    "/referrals",
  ], ["customer:read"]],

  [[
    "/appointments",
    "/calendar",
    "/waitlist",
    "/booking-demand",
    "/booking-loss",
  ], ["appointment:read"]],

  [[
    "/revenue-forecast",
    "/reports",
    "/daily-close",
    "/staff-performance",
    "/service-performance",
    "/data-export-audit",
    "/premium-analytics",
  ], ["reports:read"]],

  [[
    "/staff-rota",
    "/staff-management",
  ], ["employee:read"]],

  [["/staff/profile"], [
    "profile:own:read",
    "profile:all:read",
  ]],

  [[
    "/ai",
    "/marketing-attribution",
    "/smart-appointments",
    "/capacity-planning",
    "/dynamic-pricing",
    "/feedback-analytics",
    "/management-copilot",
    "/executive-command-centre",
  ], ["ai:use"]],

  [[
    "/communications",
    "/communication-templates",
    "/communication-campaigns",
    "/scheduled-communications",
    "/message-delivery",
    "/rebooking-campaigns",
    "/notification-centre",
    "/push-notifications",
    "/email-campaigns",
    "/sms-reminders",
    "/whatsapp-booking",
    "/retention-automation",
  ], ["communications:read"]],

  [["/manage/orders"], ["product:read"]],

  [[
    "/suppliers",
    "/purchase-orders",
    "/reorder-recommendations",
    "/inventory-forecasting",
  ], ["inventory:read"]],
];

function matchesPath(
  pathname,
  routePrefix
) {
  return (
    pathname === routePrefix ||
    pathname.startsWith(
      `${routePrefix}/`
    )
  );
}

export function permissionsForManagementPath(
  pathname
) {
  for (const [
    prefixes,
    permissions,
  ] of MANAGEMENT_PERMISSION_RULES) {
    if (
      prefixes.some(
        (prefix) =>
          matchesPath(
            pathname,
            prefix
          )
      )
    ) {
      return permissions;
    }
  }

  return [];
}

export default function ManagementRoute({
  children,
}) {
  const {
    loading,
    isAuthenticated,
    user,
  } = useAuth();

  const location =
    useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (!isManagementRole(user?.role)) {
    return (
      <Navigate
        to="/booking"
        replace
      />
    );
  }

  if (
    isAdminRole(
      user?.role
    )
  ) {
    return children;
  }

  const required =
    permissionsForManagementPath(
      location.pathname
    );

  const authorised =
    required.length > 0 &&
    required.some(
      (permission) =>
        hasPermission(
          user,
          permission
        )
    );

  if (!authorised) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}
