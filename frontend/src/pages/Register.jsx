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

    const email = form.email.trim().toLowerCase();

    try {
      setLoading(true);

      const result = await register({
        name: form.name.trim(),
        email,
        password: form.password,
      });

      navigate("/login", {
        replace: true,
        state: {
          registrationComplete: true,
          verificationRequired: Boolean(result?.verificationRequired),
          verificationEmail: result?.user?.email || email,
          registrationMessage: result?.message || "Account created.",
        },
      });
    } catch (requestError) {
      console.error("Registration failed:", requestError);

      const response = requestError.response?.data;

      if (response?.code === "VERIFICATION_EMAIL_UNAVAILABLE") {
        navigate("/login", {
          replace: true,
          state: {
            registrationComplete: true,
            verificationRequired: true,
            verificationEmail: response?.user?.email || email,
            registrationMessage: response?.message,
          },
        });
        return;
      }

      setError(
        response?.message ||
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
      description="Create your secure customer account. When production email activation is enabled, SalonAI will require the verification link sent to your email before first sign-in."
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

        <p className="auth-terms">
          Use an email address you can access. It is used for account activation,
          password recovery and important salon account messages when real email
          delivery is enabled.
        </p>

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
