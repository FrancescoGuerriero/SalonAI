import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LoadingSpinner from "../../components/LoadingSpinner.jsx";

describe("LoadingSpinner", () => {
  it("renders the default loading message", () => {
    render(<LoadingSpinner />);

    expect(
      screen.getByText("Loading...")
    ).toBeInTheDocument();
  });

  it("renders a custom loading message", () => {
    render(
      <LoadingSpinner message="Loading appointments..." />
    );

    expect(
      screen.getByText("Loading appointments...")
    ).toBeInTheDocument();
  });
});
