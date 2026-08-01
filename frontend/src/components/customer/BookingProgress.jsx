import {
  CalendarCheck,
  Check,
  Scissors,
  UserRound,
} from "lucide-react";

const steps = [
  { key: "service", label: "Service", icon: Scissors },
  { key: "stylist", label: "Stylist", icon: UserRound },
  { key: "schedule", label: "Schedule", icon: CalendarCheck },
];

export default function BookingProgress({ currentStep = 1 }) {
  return (
    <nav
      className="booking-progress"
      aria-label="Booking progress"
    >
      <ol>
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const complete = currentStep > stepNumber;
          const active = currentStep === stepNumber;
          const Icon = complete ? Check : step.icon;

          return (
            <li
              key={step.key}
              className={[
                complete ? "is-complete" : "",
                active ? "is-active" : "",
              ].join(" ")}
              aria-current={active ? "step" : undefined}
            >
              <span className="booking-progress-marker">
                <Icon size={18} />
              </span>
              <span className="booking-progress-copy">
                <small>Step {stepNumber}</small>
                <strong>{step.label}</strong>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
