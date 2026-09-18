import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PageLoader from "../../components/ui/PageLoader.jsx";

describe("PageLoader", () => {
  it("renders the live route loading state accessibly", () => {
    const { container } = render(<PageLoader />);

    const status = screen.getByRole("status");

    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveAttribute("aria-label", "Loading SalonAI…");
    expect(screen.getByText("Loading SalonAI…")).toBeInTheDocument();
    expect(
      container.querySelector(".page-loader-spinner")
    ).toBeInTheDocument();
  });

  it("supports a custom message and compact presentation", () => {
    render(
      <PageLoader
        message="Loading appointments…"
        compact
      />
    );

    const status = screen.getByRole("status");

    expect(status).toHaveAttribute(
      "aria-label",
      "Loading appointments…"
    );
    expect(status).toHaveClass("page-loader-compact");
    expect(
      screen.getByText("Loading appointments…")
    ).toBeInTheDocument();
  });
});
