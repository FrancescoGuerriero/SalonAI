import { Outlet } from "react-router-dom";

import Navbar from "./Navbar.jsx";
import "./MainLayout.css";

function MainLayout() {
  return (
    <div className="application-shell">
      <Navbar />

      <main className="application-shell__content">
        <Outlet />
      </main>

      <footer className="application-footer">
        <div className="application-footer__container">
          <p>
            © {new Date().getFullYear()} SalonAI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default MainLayout;