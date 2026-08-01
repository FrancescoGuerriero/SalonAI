import { useState } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import {
  Link,
  useNavigate,
} from "react-router-dom";

import AuthShell from "../components/auth/AuthShell.jsx";
import PasswordStrength, {
  isStrongPassword,
} from "../components/auth/PasswordStrength.jsx";
import useAuth from "../hooks/useAuth.js";

function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

    if (form.password !== form.confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    if (!isStrongPassword(form.password)) {
      setError("Please complete all password requirements.");
      return;
    }

    try {
      setLoading(true);

      await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      navigate("/login", {
        replace: true,
        state: {
          registrationComplete: true,
        },
      });
    } catch (requestError) {
      console.error("Registration failed:", requestError);

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
    <AuthShell
      eyebrow="Join SalonAI"
      title="Create your account"
      description="Save bookings, purchases and customer preferences securely."
      footer={
        <p>
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      }
    >
      {error ? (
        <div className="auth-feedback auth-feedback-error" role="alert">
          {error}
        </div>
      ) : null}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="registerName">Full name</label>
        <div className="auth-input">
          <UserRound size={18} aria-hidden="true" />
          <input
            id="registerName"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            autoComplete="name"
            placeholder="Your full name"
            required
          />
        </div>

        <label htmlFor="registerEmail">Email address</label>
        <div className="auth-input">
          <Mail size={18} aria-hidden="true" />
          <input
            id="registerEmail"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </div>

        <label htmlFor="registerPassword">Password</label>
        <div className="auth-input">
          <LockKeyhole size={18} aria-hidden="true" />
          <input
            id="registerPassword"
            name="password"
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
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

        <PasswordStrength password={form.password} />

        <label htmlFor="registerConfirmPassword">Confirm password</label>
        <div className="auth-input">
          <LockKeyhole size={18} aria-hidden="true" />
          <input
            id="registerConfirmPassword"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            value={form.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            required
          />
        </div>

        <button
          className="auth-submit"
          type="submit"
          disabled={loading}
        >
          {loading ? "Creating account…" : "Create account"}
        </button>

        <p className="auth-terms">
          By creating an account, you agree to use SalonAI services responsibly.
        </p>
      </form>
    </AuthShell>
  );
}

export default Register;
