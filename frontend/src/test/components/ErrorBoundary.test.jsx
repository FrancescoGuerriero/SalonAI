import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ErrorBoundary from "../../components/ErrorBoundary.jsx";

function BrokenComponent() {
  throw new Error("Test component failure");
}

describe("ErrorBoundary", () => {
  it("renders its children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <p>SalonAI content</p>
      </ErrorBoundary>
    );

    expect(
      screen.getByText("SalonAI content")
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", {
        name: "Something went wrong",
      })
    ).not.toBeInTheDocument();
  });

  it("renders the recovery interface when a child throws", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );

    expect(
      screen.getByRole("heading", {
        name: "Something went wrong",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "The page could not be displayed. Your data has not been intentionally changed."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Reload application",
      })
    ).toBeEnabled();

    expect(consoleError).toHaveBeenCalled();
  });
});
