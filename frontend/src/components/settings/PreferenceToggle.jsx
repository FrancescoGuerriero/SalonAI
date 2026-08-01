export default function PreferenceToggle({
  id,
  label,
  description,
  checked,
  onChange,
}) {
  return (
    <label className="preference-toggle" htmlFor={id}>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>

      <span className="preference-switch">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span aria-hidden="true" />
      </span>
    </label>
  );
}
