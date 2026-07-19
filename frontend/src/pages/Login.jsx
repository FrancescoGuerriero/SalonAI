import {
  useEffect,
  useState
} from "react";

import {
  Link,
  useLocation,
  useNavigate
} from "react-router-dom";

import useAuth from "../hooks/useAuth.js";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    login,
    loading: authLoading,
    isAuthenticated
  } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: ""
  });

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  const redirectPath =
    location.state?.from?.pathname ||
    "/dashboard";

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirectPath, {
        replace: true
      });
    }
  }, [
    authLoading,
    isAuthenticated,
    navigate,
    redirectPath
  ]);

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
      setSubmitting(true);

      await login({
        email: form.email.trim().toLowerCase(),
        password: form.password
      });

      navigate(redirectPath, {
        replace: true
      });
    } catch (requestError) {
      console.error("Login failed:", requestError);

      setError(
        requestError.response?.data?.message ||
        requestError.message ||
        "Login failed. Check your email and password."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <main className="page narrow-page">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="page narrow-page">
      <h1>Login</h1>

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
        <label htmlFor="loginEmail">
          Email
        </label>

        <input
          id="loginEmail"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          autoComplete="email"
          required
        />

        <label htmlFor="loginPassword">
          Password
        </label>

        <input
          id="loginPassword"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          autoComplete="current-password"
          required
        />

        <button
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? "Logging in..."
            : "Login"}
        </button>
      </form>

      <p>
        No account?{" "}
        <Link to="/register">
          Register
        </Link>
      </p>
    </main>
  );
}

export default Login;