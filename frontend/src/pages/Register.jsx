import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE_URL = "http://localhost:5000/api";

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
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

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Registration failed.");
      }

      console.log("Account created:", data);
      navigate("/login");
    } catch (requestError) {
      console.error("Registration failed:", requestError);
      setError(requestError.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page narrow-page">
      <h1>Create Account</h1>

      {error && <p className="error-message">{error}</p>}

      <form onSubmit={handleSubmit} className="form">
        <label htmlFor="registerName">Full name</label>
        <input
          id="registerName"
          name="name"
          value={form.name}
          onChange={handleChange}
          required
        />

        <label htmlFor="registerEmail">Email</label>
        <input
          id="registerEmail"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          required
        />

        <label htmlFor="registerPassword">Password</label>
        <input
          id="registerPassword"
          name="password"
          type="password"
          minLength="6"
          value={form.password}
          onChange={handleChange}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Register"}
        </button>
      </form>

      <p>
        Already registered? <Link to="/login">Login</Link>
      </p>
    </main>
  );
}

export default Register;
