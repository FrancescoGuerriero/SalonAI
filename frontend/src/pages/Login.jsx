import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE_URL = "http://localhost:5000/api";

function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: ""
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previousForm) => ({
      ...previousForm,
      [name]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Login failed.");
      }

      if (!data.token) {
        throw new Error("The server did not return an authentication token.");
      }

      localStorage.setItem("token", data.token);
      navigate("/dashboard");
    } catch (requestError) {
      console.error("Login failed:", requestError);
      setError(requestError.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page narrow-page">
      <h1>Login</h1>

      {error && <p className="error-message">{error}</p>}

      <form onSubmit={handleSubmit} className="form">
        <label htmlFor="loginEmail">Email</label>
        <input
          id="loginEmail"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          required
        />

        <label htmlFor="loginPassword">Password</label>
        <input
          id="loginPassword"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <p>
        No account? <Link to="/register">Register</Link>
      </p>
    </main>
  );
}

export default Login;
