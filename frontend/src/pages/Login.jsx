import { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
} from "lucide-react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import AuthShell from "../components/auth/AuthShell.jsx";
import authService from "../Services/authService.js";
import useAuth from "../hooks/useAuth.js";

function requestMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function LoginForm({
  form,
  setForm,
  showPassword,
  setShowPassword,
  submitting,
  onSubmit,
}) {
  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label htmlFor="loginEmail">Email address</label>
      <div className="auth-input">
        <Mail size={18} aria-hidden="true" />
        <input
          id="loginEmail"
          name="email"
          type="email"
          value={form.email}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              email: event.target.value,
            }))
          }
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </div>

      <div className="auth-label-row">
        <label htmlFor="loginPassword">Password</label>
        <Link to="/login?forgot=1">Forgot password?</Link>
      </div>

      <div className="auth-input">
        <LockKeyhole size={18} aria-hidden="true" />
        <input
          id="loginPassword"
          name="password"
          type={showPassword ? "text" : "password"}
          value={form.password}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              password: event.target.value,
            }))
          }
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

      <button className="auth-submit" type="submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const {
    login,
    loading: authLoading,
    isAuthenticated,
  } = useAuth();

  const resetToken = searchParams.get("resetToken") || "";
  const forgotMode = searchParams.get("forgot") === "1" && !resetToken;
  const resetMode = Boolean(resetToken);

  const [form, setForm] = useState({ email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetForm, setResetForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [developmentResetUrl, setDevelopmentResetUrl] = useState("");

  const redirectPath =
    location.state?.from?.pathname ||
    location.state?.redirectTo ||
    "/dashboard";

  const registrationComplete = Boolean(location.state?.registrationComplete);
  const passwordResetComplete = Boolean(location.state?.passwordResetComplete);

  useEffect(() => {
    if (
      !forgotMode &&
      !resetMode &&
      !authLoading &&
      isAuthenticated
    ) {
      navigate(redirectPath, { replace: true });
    }
  }, [
    authLoading,
    forgotMode,
    isAuthenticated,
    navigate,
    redirectPath,
    resetMode,
  ]);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setNotice("");

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
        requestMessage(
          requestError,
          "Login failed. Check your email and password."
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setDevelopmentResetUrl("");

    try {
      setSubmitting(true);
      const result = await authService.requestPasswordReset(
        forgotEmail.trim().toLowerCase()
      );

      setNotice(
        result?.message ||
          "If an account exists for that email, reset instructions have been prepared."
      );
      setDevelopmentResetUrl(result?.developmentResetUrl || "");
    } catch (requestError) {
      setError(
        requestMessage(
          requestError,
          "Unable to request a password reset right now."
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (resetForm.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (resetForm.password !== resetForm.confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);
      await authService.resetPassword(resetToken, resetForm.password);

      navigate("/login", {
        replace: true,
        state: {
          passwordResetComplete: true,
        },
      });
    } catch (requestError) {
      setError(
        requestMessage(
          requestError,
          "Unable to reset the password. The link may have expired."
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  const title = resetMode
    ? "Choose a new password"
    : forgotMode
      ? "Reset your password"
      : "Welcome back";

  const description = resetMode
    ? "Enter a new password for your SalonAI account."
    : forgotMode
      ? "Enter your email address and we will prepare a secure reset link."
      : "Sign in to continue to your SalonAI account.";

  return (
    <AuthShell
      eyebrow="Customer access"
      title={title}
      description={description}
      footer={
        forgotMode || resetMode ? (
          <p>
            Remembered it? <Link to="/login">Back to sign in</Link>
          </p>
        ) : (
          <p>
            No account yet? <Link to="/register">Create one</Link>
          </p>
        )
      }
    >
      {registrationComplete ? (
        <div className="auth-feedback auth-feedback-success" role="status">
          Your account was created successfully. You can now sign in.
        </div>
      ) : null}

      {passwordResetComplete ? (
        <div className="auth-feedback auth-feedback-success" role="status">
          Your password was reset successfully. Sign in with the new password.
        </div>
      ) : null}

      {notice ? (
        <div className="auth-feedback auth-feedback-success" role="status">
          {notice}
          {developmentResetUrl ? (
            <p>
              <a href={developmentResetUrl}>Open local reset link</a>
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="auth-feedback auth-feedback-error" role="alert">
          {error}
        </div>
      ) : null}

      {forgotMode ? (
        <form className="auth-form" onSubmit={handleForgotPassword}>
          <label htmlFor="forgotEmail">Email address</label>
          <div className="auth-input">
            <Mail size={18} aria-hidden="true" />
            <input
              id="forgotEmail"
              type="email"
              value={forgotEmail}
              onChange={(event) => setForgotEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? "Preparing reset…" : "Send reset link"}
          </button>
        </form>
      ) : resetMode ? (
        <form className="auth-form" onSubmit={handleResetPassword}>
          <label htmlFor="newPassword">New password</label>
          <div className="auth-input">
            <KeyRound size={18} aria-hidden="true" />
            <input
              id="newPassword"
              type={showResetPassword ? "text" : "password"}
              value={resetForm.password}
              onChange={(event) =>
                setResetForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              autoComplete="new-password"
              minLength={8}
              required
            />
            <button
              className="auth-password-toggle"
              type="button"
              onClick={() => setShowResetPassword((visible) => !visible)}
              aria-label={showResetPassword ? "Hide password" : "Show password"}
            >
              {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <label htmlFor="confirmPassword">Confirm new password</label>
          <div className="auth-input">
            <LockKeyhole size={18} aria-hidden="true" />
            <input
              id="confirmPassword"
              type={showResetPassword ? "text" : "password"}
              value={resetForm.confirmPassword}
              onChange={(event) =>
                setResetForm((current) => ({
                  ...current,
                  confirmPassword: event.target.value,
                }))
              }
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? "Resetting password…" : "Reset password"}
          </button>
        </form>
      ) : authLoading ? (
        <div className="auth-loading" role="status">
          Checking your account…
        </div>
      ) : (
        <LoginForm
          form={form}
          setForm={setForm}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          submitting={submitting}
          onSubmit={handleLogin}
        />
      )}
    </AuthShell>
  );
}
