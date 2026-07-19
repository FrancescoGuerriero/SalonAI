import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  return (
    <main className="page page-center">
      <h1>Welcome to SalonAI</h1>
      <p>AI-powered hair salon booking platform</p>

      <div className="button-row">
        <button type="button" onClick={() => navigate("/services")}>
          Book Appointment
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={() => navigate("/login")}
        >
          Login
        </button>
      </div>
    </main>
  );
}

export default Home;
