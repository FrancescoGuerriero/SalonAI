const steps = [
  { key: "cart", label: "Cart" },
  { key: "checkout", label: "Checkout" },
  { key: "complete", label: "Complete" },
];

export default function CheckoutProgress({ current = "cart" }) {
  const activeIndex = Math.max(0, steps.findIndex((step) => step.key === current));
  return (
    <nav className="checkout-progress" aria-label="Checkout progress">
      {steps.map((step, index) => {
        const state = index < activeIndex ? "complete" : index === activeIndex ? "current" : "upcoming";
        return (
          <div className={`checkout-progress-step is-${state}`} key={step.key} aria-current={state === "current" ? "step" : undefined}>
            <span>{index + 1}</span><strong>{step.label}</strong>
          </div>
        );
      })}
    </nav>
  );
}
