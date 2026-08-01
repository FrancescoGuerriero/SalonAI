import { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import AuthShell from "../components/auth/AuthShell.jsx";
import useAuth from "../hooks/useAuth.js";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    login,
    loading: authLoading,
    isAuthenticated,
  } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const redirectPath =
    location.state?.from?.pathname ||
    location.state?.redirectTo ||
    "/dashboard";

  const registrationComplete =
    Boolean(location.state?.registrationComplete);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirectPath, { replace: true });
    }
  }, [
    authLoading,
    isAuthenticated,
    navigate,
    redirectPath,
  ]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      setSubmitting(true);

      await login({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      navigate(redirectPath, { replace: true });
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

  return (
    <AuthShell
      eyebrow="Customer access"
      title="Welcome back"
      description="Sign in to continue to your SalonAI account."
      footer={
        <p>
          No account yet? <Link to="/register">Create one</Link>
        </p>
      }
    >
      {registrationComplete ? (
        <div className="auth-feedback auth-feedback-success" role="status">
          Your account was created successfully. You can now sign in.
        </div>
      ) : null}

      {error ? (
        <div className="auth-feedback auth-feedback-error" role="alert">
          {error}
        </div>
      ) : null}

      {authLoading ? (
        <div className="auth-loading" role="status">
          Checking your account…
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="loginEmail">Email address</label>
          <div className="auth-input">
            <Mail size={18} aria-hidden="true" />
            <input
              id="loginEmail"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="auth-label-row">
            <label htmlFor="loginPassword">Password</label>
            <span>Use your registered password</span>
          </div>

          <div className="auth-input">
            <LockKeyhole size={18} aria-hidden="true" />
            <input
              id="loginPassword"
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
            <button
              className="auth-password-toggle"
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            className="auth-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export default Login;
