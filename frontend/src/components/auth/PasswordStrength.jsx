const checks = [
  {
    label: "At least 8 characters",
    test: (password) => password.length >= 8,
  },
  {
    label: "One uppercase letter",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    label: "One lowercase letter",
    test: (password) => /[a-z]/.test(password),
  },
  {
    label: "One number",
    test: (password) => /\d/.test(password),
  },
];

export function isStrongPassword(password) {
  return checks.every((check) => check.test(password));
}

export default function PasswordStrength({ password }) {
  const completed = checks.filter((check) => check.test(password)).length;
  const percentage = (completed / checks.length) * 100;

  return (
    <div className="password-strength" aria-live="polite">
      <div className="password-strength-heading">
        <span>Password strength</span>
        <strong>{completed} of {checks.length}</strong>
      </div>

      <div
        className="password-strength-track"
        role="progressbar"
        aria-label="Password strength"
        aria-valuemin="0"
        aria-valuemax={checks.length}
        aria-valuenow={completed}
      >
        <span style={{ width: `${percentage}%` }} />
      </div>

      <ul>
        {checks.map((check) => {
          const passed = check.test(password);

          return (
            <li className={passed ? "is-complete" : ""} key={check.label}>
              <span aria-hidden="true">{passed ? "✓" : "○"}</span>
              {check.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
