import { useState } from "react";

import {
  Link,
  useNavigate
} from "react-router-dom";

import useAuth from "../hooks/useAuth.js";

function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      setLoading(true);

      await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password
      });

      navigate("/login", {
        replace: true,
        state: {
          registrationComplete: true
        }
      });
    } catch (requestError) {
      console.error(
        "Registration failed:",
        requestError
      );

      setError(
        requestError.response?.data?.message ||
        requestError.message ||
        "Registration failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page narrow-page">
      <h1>Create Account</h1>

      {error && (
        <p
          className="error-message"
          role="alert"
        >
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="form"
      >
        <label htmlFor="registerName">
          Full name
        </label>

        <input
          id="registerName"
          name="name"
          type="text"
          value={form.name}
          onChange={handleChange}
          autoComplete="name"
          required
        />

        <label htmlFor="registerEmail">
          Email
        </label>

        <input
          id="registerEmail"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          autoComplete="email"
          required
        />

        <label htmlFor="registerPassword">
          Password
        </label>

        <input
          id="registerPassword"
          name="password"
          type="password"
          minLength={6}
          value={form.password}
          onChange={handleChange}
          autoComplete="new-password"
          required
        />

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Creating account..."
            : "Register"}
        </button>
      </form>

      <p>
        Already registered?{" "}
        <Link to="/login">
          Login
        </Link>
      </p>
    </main>
  );
}

export default Register;