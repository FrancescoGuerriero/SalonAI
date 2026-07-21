import {
  CalendarDays,
  LayoutDashboard,
  MessageCircle,
  Scissors,
  Users,
} from "lucide-react";

import { NavLink } from "react-router-dom";

const navigationItems = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Customers",
    path: "/customers",
    icon: Users,
  },
  {
    label: "Appointments",
    path: "/appointments",
    icon: CalendarDays,
  },
  {
    label: "Communications",
    path: "/communications",
    icon: MessageCircle,
  },
  {
    label: "Manage Services",
    path: "/manage/services",
    icon: Scissors,
  },
];

function getNavigationClass({ isActive }) {
  const baseClasses =
    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition";

  if (isActive) {
    return `${baseClasses} bg-blue-600 text-white shadow-sm`;
  }

  return `${baseClasses} text-gray-600 hover:bg-gray-100 hover:text-gray-900`;
}

export default function ManagementNavigation({
  collapsed = false,
  onNavigate,
  className = "",
}) {
  return (
    <nav
      className={`space-y-1 ${className}`}
      aria-label="Salon management navigation"
    >
      {navigationItems.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            onClick={() => onNavigate?.()}
            className={getNavigationClass}
            title={collapsed ? item.label : undefined}
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={20}
                  className={
                    isActive
                      ? "shrink-0 text-white"
                      : "shrink-0 text-gray-400 transition group-hover:text-gray-700"
                  }
                  aria-hidden="true"
                />

                {!collapsed ? (
                  <span className="truncate">
                    {item.label}
                  </span>
                ) : (
                  <span className="sr-only">
                    {item.label}
                  </span>
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}