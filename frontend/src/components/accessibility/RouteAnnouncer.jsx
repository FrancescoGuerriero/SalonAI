import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

function pageTitle(pathname) {
  if (pathname === "/") return "Home";
  if (pathname.startsWith("/booking")) return "Booking";
  if (pathname.startsWith("/services")) return "Services";
  if (pathname.startsWith("/stylists")) return "Stylists";
  if (pathname.startsWith("/shop")) return "Shop";
  if (pathname.startsWith("/cart")) return "Cart";
  if (pathname.startsWith("/checkout")) return "Checkout";
  if (pathname.startsWith("/orders")) return "Orders";
  if (pathname.startsWith("/account")) return "My account";
  if (pathname.startsWith("/help")) return "Help Centre";
  if (pathname.startsWith("/login")) return "Login";
  if (pathname.startsWith("/register")) return "Register";
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/management")) return "Management";
  return "SalonAI";
}

export default function RouteAnnouncer() {
  const location = useLocation();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const title = pageTitle(location.pathname);
    document.title = `${title} | SalonAI`;
    setMessage(`${title} page loaded`);

    const main = document.getElementById("main-content");
    if (main) {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  return (
    <div className="route-announcer" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
