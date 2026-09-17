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

  it("renders an accessible recovery interface when a child throws", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      );

      expect(
        screen.getByRole("alert")
      ).toBeInTheDocument();

      expect(
        screen.getByRole("heading", {
          name: "Something went wrong",
        })
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          /The page could not be displayed correctly/
        )
      ).toBeInTheDocument();

      expect(
        screen.getByRole("button", {
          name: "Try again",
        })
      ).toBeEnabled();

      expect(
        screen.getByRole("button", {
          name: "Reload application",
        })
      ).toBeEnabled();

      expect(
        screen.getByRole("link", {
          name: "Return home",
        })
      ).toHaveAttribute("href", "/");

      expect(consoleError).toHaveBeenCalled();
    }
    finally {
      consoleError.mockRestore();
    }
  });
});
