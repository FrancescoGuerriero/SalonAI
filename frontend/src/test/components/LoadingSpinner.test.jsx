import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LoadingSpinner from "../../components/LoadingSpinner.jsx";

describe("LoadingSpinner", () => {
  it("renders the default loading state accessibly", () => {
    const { container } = render(<LoadingSpinner />);

    const status = screen.getByRole("status");

    expect(status).toHaveAttribute(
      "aria-live",
      "polite"
    );

    expect(status).toHaveAttribute(
      "aria-busy",
      "true"
    );

    expect(status).toHaveAttribute(
      "aria-label",
      "Loading..."
    );

    expect(
      screen.getByText("Loading...")
    ).toBeInTheDocument();

    expect(
      container.querySelector(".salonai-loading-spinner")
    ).toBeInTheDocument();
  });

  it("renders a custom loading message and accessible label", () => {
    render(
      <LoadingSpinner message="Loading appointments..." />
    );

    expect(
      screen.getByRole("status")
    ).toHaveAttribute(
      "aria-label",
      "Loading appointments..."
    );

    expect(
      screen.getByText("Loading appointments...")
    ).toBeInTheDocument();
  });
});
