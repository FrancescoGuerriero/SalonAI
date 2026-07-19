import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  function logout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  if (!token) {
    return (
      <main className="page">
        <h1>You are not logged in</h1>
        <button type="button" onClick={() => navigate("/login")}>
          Go to Login
        </button>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Welcome to SalonAI Dashboard</h1>
      <p>You are logged in.</p>

      <div className="button-row">
        <button type="button" onClick={() => navigate("/services")}>
          Book Appointment
        </button>

        <button type="button" className="danger-button" onClick={logout}>
          Logout
        </button>
      </div>
    </main>
  );
}

export default Dashboard;
