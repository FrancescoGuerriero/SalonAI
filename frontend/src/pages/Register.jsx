import { useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  RefreshCw,
  UserRound,
} from "lucide-react";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import AuthShell from "../components/auth/AuthShell.jsx";
import SocialSignInOptions from "../components/auth/SocialSignInOptions.jsx";
import PasswordStrength, {
  isStrongPassword,
} from "../components/auth/PasswordStrength.jsx";
import authService from "../Services/authService.js";
import useAuth from "../hooks/useAuth.js";

function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [
    showPassword,
    setShowPassword,
  ] = useState(false);
  const [
    loading,
    setLoading,
  ] = useState(false);
  const [
    error,
    setError,
  ] = useState("");
  const [
    notice,
    setNotice,
  ] = useState("");
  const [
    pendingVerification,
    setPendingVerification,
  ] = useState(null);

  const returnTo =
    location.state
      ?.redirectTo ||
    location.state?.from
      ?.pathname ||
    "/account";

  function handleChange(
    event
  ) {
    const {
      name,
      value,
    } = event.target;

    setForm(
      (currentForm) => ({
        ...currentForm,
        [name]: value,
      })
    );
  }

  async function handleSubmit(
    event
  ) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (
      !isStrongPassword(
        form.password
      )
    ) {
      setError(
        "Please complete all password requirements."
      );
      return;
    }

    const email =
      form.email
        .trim()
        .toLowerCase();

    try {
      setLoading(true);

      const result =
        await register({
          name:
            form.name.trim(),
          email,
          password:
            form.password,
        });

      if (
        result
          ?.verificationRequired
      ) {
        setForm(
          (current) => ({
            ...current,
            password: "",
          })
        );
        setPendingVerification({
          email:
            result?.user
              ?.email ||
            email,
          message:
            result?.message ||
            "Account created. Check your email to continue.",
          emailSent: true,
        });
        return;
      }

      if (
        result?.token &&
        result?.user
      ) {
        navigate(
          returnTo,
          {
            replace: true,
            state: {
              registrationComplete:
                true,
              registrationMessage:
                result?.message ||
                "Welcome to SalonAI.",
            },
          }
        );
        return;
      }

      navigate(
        "/login",
        {
          replace: true,
          state: {
            registrationComplete:
              true,
            verificationEmail:
              result?.user
                ?.email ||
              email,
            registrationMessage:
              result?.message ||
              "Account created. Sign in to continue.",
            redirectTo:
              returnTo,
          },
        }
      );
    } catch (
      requestError
    ) {
      console.error(
        "Registration failed:",
        requestError
      );

      const response =
        requestError
          .response?.data;

      if (
        response?.code ===
        "VERIFICATION_EMAIL_UNAVAILABLE"
      ) {
        setPendingVerification({
          email:
            response?.user
              ?.email ||
            email,
          message:
            response?.message ||
            "Your account was created, but the verification email could not be sent.",
          emailSent: false,
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

  async function resendVerification() {
    if (
      !pendingVerification
        ?.email
    ) {
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const result =
        await authService.resendVerification(
          pendingVerification.email
        );

      setPendingVerification(
        (current) => ({
          ...current,
          emailSent: true,
        })
      );
      setNotice(
        result?.message ||
          "A new verification email has been sent."
      );
    } catch (
      requestError
    ) {
      setError(
        requestError
          ?.response?.data
          ?.message ||
          requestError
            ?.message ||
          "We could not resend the verification email."
      );
    } finally {
      setLoading(false);
    }
  }

  if (
    pendingVerification
  ) {
    return (
      <AuthShell
        eyebrow="Almost there"
        title="Check your email"
        description="Verify your email once and SalonAI will sign you in automatically."
        footer={
          <p>
            Already verified?{" "}
            <Link
              to="/login"
              state={{
                redirectTo:
                  returnTo,
              }}
            >
              Sign in
            </Link>
          </p>
        }
      >
        <div
          className="auth-feedback auth-feedback-success auth-feedback-with-icon"
          role="status"
        >
          <CheckCircle2
            size={20}
            aria-hidden="true"
          />
          <div>
            <strong>
              Account created
            </strong>
            <p>
              {pendingVerification.message}
            </p>
            <p>
              {pendingVerification.emailSent
                ? "Verification link sent to "
                : "Use resend to send the verification link to "}
              <strong>
                {pendingVerification.email}
              </strong>
              .
            </p>
          </div>
        </div>

        {notice ? (
          <div
            className="auth-feedback auth-feedback-success"
            role="status"
          >
            {notice}
          </div>
        ) : null}

        {error ? (
          <div
            className="auth-feedback auth-feedback-error"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <button
          className="auth-submit"
          type="button"
          disabled={loading}
          onClick={
            resendVerification
          }
        >
          <RefreshCw
            size={17}
            aria-hidden="true"
          />
          {loading
            ? "Sending…"
            : "Resend verification email"}
        </button>

        <p className="auth-terms">
          The verification link is single-purpose. After verification you will continue directly to your SalonAI account.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Join SalonAI"
      title="Create your account"
      description="Use a connected account for one-click registration, or create your account with email."
      footer={
        <p>
          Already registered?{" "}
          <Link
            to="/login"
            state={{
              redirectTo:
                returnTo,
            }}
          >
            Sign in
          </Link>
        </p>
      }
    >
      {error ? (
        <div
          className="auth-feedback auth-feedback-error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <SocialSignInOptions
        mode="register"
        returnTo={
          returnTo
        }
        onError={setError}
      />

      <form
        className="auth-form"
        onSubmit={
          handleSubmit
        }
      >
        <label htmlFor="registerName">
          Full name
        </label>
        <div className="auth-input">
          <UserRound
            size={18}
            aria-hidden="true"
          />
          <input
            id="registerName"
            name="name"
            type="text"
            value={form.name}
            onChange={
              handleChange
            }
            autoComplete="name"
            placeholder="Your full name"
            required
            autoFocus
          />
        </div>

        <label htmlFor="registerEmail">
          Email address
        </label>
        <div className="auth-input">
          <Mail
            size={18}
            aria-hidden="true"
          />
          <input
            id="registerEmail"
            name="email"
            type="email"
            value={form.email}
            onChange={
              handleChange
            }
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            required
          />
        </div>

        <label htmlFor="registerPassword">
          Password
        </label>
        <div className="auth-input">
          <LockKeyhole
            size={18}
            aria-hidden="true"
          />
          <input
            id="registerPassword"
            name="password"
            type={
              showPassword
                ? "text"
                : "password"
            }
            value={
              form.password
            }
            onChange={
              handleChange
            }
            autoComplete="new-password"
            required
          />
          <button
            className="auth-password-toggle"
            type="button"
            onClick={() =>
              setShowPassword(
                (visible) =>
                  !visible
              )
            }
            aria-label={
              showPassword
                ? "Hide password"
                : "Show password"
            }
          >
            {showPassword ? (
              <EyeOff
                size={18}
              />
            ) : (
              <Eye
                size={18}
              />
            )}
          </button>
        </div>

        <PasswordStrength
          password={
            form.password
          }
        />

        <button
          className="auth-submit"
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Creating your account…"
            : "Create account and continue"}
        </button>

        <p className="auth-terms">
          By creating an account you acknowledge the{" "}
          <Link to="/privacy">
            Privacy Notice
          </Link>{" "}
          and{" "}
          <Link to="/cookies">
            Cookie &amp; storage notice
          </Link>
          . Marketing remains optional and off by default.
        </p>
      </form>
    </AuthShell>
  );
}

export default Register;
