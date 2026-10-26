import { describe, expect, it } from "vitest";

import pageSource from "../pages/StylistCopilotPage.jsx?raw";
import serviceSource from "../Services/aiStylistCopilotService.js?raw";
import routerSource from "../components/stage4/Stage4WorkspaceRouter.jsx?raw";
import {
  MANAGEMENT_LINKS,
} from "../components/navigation/managementNavigationConfig.js";

describe("Stylist Copilot staff surface", () => {
  it("exposes advisory safety boundaries", () => {
    expect(pageSource).toMatch(/Stylist Copilot/);
    expect(pageSource).toMatch(/advisory only/);
    expect(pageSource).toMatch(/Human review/);
    expect(pageSource).toMatch(/Canonical writes/);
    expect(pageSource).toMatch(/Safety override/);
  });

  it("only requests the canonical appointment-scoped endpoint", () => {
    expect(serviceSource).toMatch(/\/ai\/stylist-copilot\/appointments\//);
    expect(serviceSource).not.toMatch(/customerId=/);
    expect(serviceSource).not.toMatch(/sensitiveContext=/);
  });

  it("is registered as an authorised AI management workspace", () => {
    expect(routerSource).toMatch(/pathname === "\/stylist-copilot"/);
    expect(routerSource).toMatch(/hasPermission\(user, "ai:use"\)/);
    expect(routerSource).toMatch(/isFeatureEnabled\("ai-tools"\)/);
    expect(routerSource).toMatch(/<StylistCopilotPage \/>/);

    const link = MANAGEMENT_LINKS.find(
      (item) => item.to === "/stylist-copilot"
    );
    expect(link).toMatchObject({
      label: "Stylist copilot",
      permission: "ai:use",
      featureId: "ai-tools",
      presentation: "advanced",
    });
  });
});
