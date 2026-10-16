import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExtensionBoundaryReview } from "../components/platform/tenantInstallation/index.js";

describe("AIIBP governed extension boundary presentation", () => {
  it("renders platform-first classifications and rejects tenant forks as an installation option", () => {
    render(
      <ExtensionBoundaryReview
        requirements={[
          { id: "labels", title: "Custom customer terminology", classification: "configuration", provenance: "tenant override" },
          { id: "membership", title: "Membership freeze workflow", classification: "reusable-module" },
          { id: "clinical", title: "Clinical consent workflow", classification: "vertical-extension" },
          { id: "legacy", title: "Legacy branch import", classification: "governed-tenant-extension" },
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: "Extension boundary review" })).toBeInTheDocument();
    expect(screen.getByText("Existing configuration")).toBeInTheDocument();
    expect(screen.getByText("Reusable module")).toBeInTheDocument();
    expect(screen.getByText("Vertical extension")).toBeInTheDocument();
    expect(screen.getByText("Governed tenant extension")).toBeInTheDocument();
    expect(screen.getByText(/Tenant code fork is not an installation option/i)).toBeInTheDocument();

    expect(screen.getByText("Custom customer terminology").closest("li")).toHaveAttribute(
      "data-extension-classification",
      "configuration"
    );
  });

  it("does not infer architecture when no classified requirements are supplied", () => {
    render(<ExtensionBoundaryReview />);

    expect(screen.getByText("No governed extension requirements were supplied.")).toBeInTheDocument();
  });
});
