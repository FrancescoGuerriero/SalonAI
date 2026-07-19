import { Outlet } from "react-router-dom";

import Navbar from "./Navbar.jsx";

function MainLayout() {
  return (
    <>
      <Navbar />

      <main className="app-container">
        <Outlet />
      </main>
    </>
  );
}

export default MainLayout;