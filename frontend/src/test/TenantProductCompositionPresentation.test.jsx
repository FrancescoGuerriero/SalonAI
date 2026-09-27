import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import {
  approvalReasonLabel,
  CapabilityProvenanceCard,
  capabilityReasonLabel,
  compactFingerprint,
  TenantManifestSummary,
  TenantProductActivationReview,
  TenantProductCompositionWorkspace,
  TenantProductUpgradeReview,
} from "../components/platform/productComposition/index.js";

describe("AIIBP tenant product composition presentation", () => {
  it("maps merged #352 capability reasons to operator wording without recomputing state", () => {
    expect(capabilityReasonLabel("tenant-manifest")).toBe(
      "Selected explicitly for this tenant"
    );
    expect(capabilityReasonLabel("vertical-default")).toBe(
      "Included by the selected vertical"
    );
    expect(capabilityReasonLabel("platform-safety-lock")).toBe(
      "Disabled by a platform safety control"
    );
    expect(capabilityReasonLabel("not-entitled")).toBe(
      "Not available under the current entitlement"
    );
    expect(capabilityReasonLabel("feature-flag-disabled")).toBe(
      "Temporarily unavailable under rollout control"
    );
    expect(
      capabilityReasonLabel("dependency-unavailable:inventory")
    ).toBe("Required capability unavailable: inventory");
  });

  it("maps activation approval reason codes from the merged contract", () => {
    expect(
      approvalReasonLabel("initial-tenant-product-activation")
    ).toBe("Initial tenant product activation");
    expect(
      approvalReasonLabel("platform-version-upgrade-review")
    ).toBe("Platform version upgrade review");
    expect(
      approvalReasonLabel("deployment-infrastructure-review")
    ).toBe("Deployment infrastructure review");
  });

  it("compacts deterministic fingerprints for display without altering source data", () => {
    const fingerprint =
      "12345678aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa87654321";

    expect(compactFingerprint(fingerprint)).toBe(
      "12345678…87654321"
    );
  });

  it("renders manifest revision, platform version, deployment profile and fingerprint", () => {
    render(
      <TenantManifestSummary
        verticalLabel="Salon AI"
        manifest={{
          status: "active",
          manifestRevision: "4",
          platformVersion: "3.0.0",
          deploymentProfile: "shared-saas",
          planKey: "standard",
        }}
        manifestHash="12345678aaaaaaaaaaaaaaaa87654321"
      />
    );

    expect(screen.getByText("Salon AI")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("3.0.0")).toBeInTheDocument();
    expect(screen.getByText("Shared SaaS")).toBeInTheDocument();
    expect(screen.getByText(/12345678…87654321/)).toBeInTheDocument();
  });

  it("renders capability enabled state and authoritative provenance", () => {
    render(
      <CapabilityProvenanceCard
        capability={{
          key: "inventory",
          label: "Inventory",
          status: "active",
          enabled: false,
          reason: "not-entitled",
          selectionSource: "tenant-manifest",
          dependencies: ["commerce"],
        }}
      />
    );

    const card = screen.getByText("Inventory").closest("article");

    expect(card).toHaveAttribute(
      "data-capability-enabled",
      "false"
    );
    expect(card).toHaveAttribute(
      "data-capability-reason",
      "not-entitled"
    );
    expect(
      screen.getByText("Not available under the current entitlement")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Source: tenant-manifest")
    ).toBeInTheDocument();
    expect(screen.getByText("commerce")).toBeInTheDocument();
  });

  it("renders dependency-unavailable provenance explicitly", () => {
    render(
      <CapabilityProvenanceCard
        capability={{
          key: "ai-receptionist",
          label: "AI Receptionist",
          enabled: false,
          reason: "dependency-unavailable:communications",
          dependencies: ["communications"],
        }}
      />
    );

    expect(
      screen.getByText(
        "Required capability unavailable: communications"
      )
    ).toBeInTheDocument();
  });

  it("renders a zero-write tenant product upgrade delta and review requirements", () => {
    render(
      <TenantProductUpgradeReview
        plan={{
          fromRevision: "4",
          toRevision: "5",
          writesPerformed: false,
          requiresTenantAcceptance: true,
          requiresInfrastructureReview: false,
          requiresPlatformUpgradeReview: true,
          containsExperimentalCapability: false,
          capabilityTransitions: [
            {
              key: "inventory",
              label: "Inventory",
              status: "active",
              fromEnabled: false,
              toEnabled: true,
              fromReason: "not-selected",
              toReason: "tenant-manifest",
            },
            {
              key: "memberships",
              label: "Memberships",
              status: "active",
              fromEnabled: true,
              toEnabled: false,
              fromReason: "tenant-manifest",
              toReason: "not-entitled",
            },
          ],
          profileChanges: [
            {
              field: "platformVersion",
              from: "3.0.0",
              to: "3.1.0",
            },
          ],
          upgradeFingerprint:
            "aaaaaaaa111111112222222233333333bbbbbbbb",
        }}
      />
    );

    expect(screen.getByText("Revision 4 → 5")).toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("Memberships")).toBeInTheDocument();
    expect(screen.getByText("Tenant acceptance")).toBeInTheDocument();
    expect(
      screen.getByText("Platform upgrade review")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/aaaaaaaa…bbbbbbbb/)
    ).toBeInTheDocument();
  });


  it("assembles manifest, capability provenance and review plans into one accessible workspace", () => {
    render(
      <TenantProductCompositionWorkspace
        manifest={{
          status: "active",
          manifestRevision: "4",
          platformVersion: "3.0.0",
          deploymentProfile: "shared-saas",
        }}
        verticalLabel="Salon AI"
        composition={{
          vertical: {
            label: "Salon AI",
          },
          capabilities: [
            {
              key: "inventory",
              label: "Inventory",
              enabled: true,
              reason: "tenant-manifest",
              status: "active",
            },
            {
              key: "memberships",
              label: "Memberships",
              enabled: false,
              reason: "not-entitled",
              status: "active",
            },
          ],
        }}
        upgradePlan={{
          fromRevision: "4",
          toRevision: "5",
          writesPerformed: false,
          capabilityTransitions: [],
          profileChanges: [],
        }}
      />
    );

    expect(
      screen.getByRole("heading", {
        name: "Tenant product composition",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("Memberships")).toBeInTheDocument();
    expect(screen.getByText("2 capabilities")).toBeInTheDocument();
    expect(screen.getByText("Revision 4 → 5")).toBeInTheDocument();
  });

  it("keeps activation approval hidden unless authoritative permission is supplied", () => {
    render(
      <TenantProductCompositionWorkspace
        manifest={{
          status: "draft",
          manifestRevision: "1",
          deploymentProfile: "shared-saas",
        }}
        composition={{
          capabilities: [],
        }}
        activationPlan={{
          fromRevision: null,
          toRevision: "1",
          approvalRequired: true,
          approvalReasons: ["initial-tenant-product-activation"],
          persistenceOperations: [],
          writesPerformed: false,
        }}
      />
    );

    expect(
      screen.getByText(
        "No effective capability states were supplied for this tenant."
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Approve reviewed plan",
      })
    ).not.toBeInTheDocument();
  });

  it("renders activation approval reasons and persistence intent without implying writes", () => {
    const approve = vi.fn();

    render(
      <TenantProductActivationReview
        plan={{
          fromRevision: "4",
          toRevision: "5",
          approvalRequired: true,
          approvalReasons: [
            "tenant-product-change",
            "platform-version-upgrade-review",
          ],
          persistenceOperations: [
            {
              type: "archive-current-manifest",
              revision: "4",
            },
            {
              type: "activate-candidate-manifest",
              revision: "5",
            },
          ],
          activationFingerprint:
            "aaaaaaaa111111112222222233333333bbbbbbbb",
          writesPerformed: false,
        }}
        canRequestApproval
        onRequestApprove={approve}
      />
    );

    expect(
      screen.getByText("Tenant product composition changed")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Platform version upgrade review")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Archive current manifest")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Activate candidate manifest")
    ).toBeInTheDocument();
    expect(
      screen.getByText("writesPerformed: false")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Approve reviewed plan",
      })
    );

    expect(approve).toHaveBeenCalledTimes(1);
  });

  it("does not expose an approval button without authoritative permission state", () => {
    render(
      <TenantProductActivationReview
        plan={{
          fromRevision: "1",
          toRevision: "2",
          approvalRequired: true,
          approvalReasons: ["tenant-product-change"],
          persistenceOperations: [],
          writesPerformed: false,
        }}
      />
    );

    expect(
      screen.queryByRole("button", {
        name: "Approve reviewed plan",
      })
    ).not.toBeInTheDocument();
  });
});
