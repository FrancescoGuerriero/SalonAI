import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AppErrorBoundary from "../../components/system/AppErrorBoundary.jsx";

let shouldThrow = false;

function RecoverableChild() {
  if (shouldThrow) {
    throw new Error("Test application failure");
  }

  return <p>SalonAI recovered content</p>;
}

describe("AppErrorBoundary", () => {
  it("renders children during normal operation", () => {
    shouldThrow = false;

    render(
      <AppErrorBoundary>
        <RecoverableChild />
      </AppErrorBoundary>
    );

    expect(
      screen.getByText("SalonAI recovered content")
    ).toBeInTheDocument();
  });

  it("shows the live accessible recovery interface after an error", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    shouldThrow = true;

    try {
      render(
        <AppErrorBoundary>
          <RecoverableChild />
        </AppErrorBoundary>
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          name: "Something went wrong",
        })
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
    } finally {
      shouldThrow = false;
      consoleError.mockRestore();
    }
  });

  it("remounts the failed subtree when retrying", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    shouldThrow = true;

    try {
      render(
        <AppErrorBoundary>
          <RecoverableChild />
        </AppErrorBoundary>
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();

      shouldThrow = false;

      fireEvent.click(
        screen.getByRole("button", {
          name: "Try again",
        })
      );

      expect(
        screen.getByText("SalonAI recovered content")
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("alert")
      ).not.toBeInTheDocument();
    } finally {
      shouldThrow = false;
      consoleError.mockRestore();
    }
  });
});
