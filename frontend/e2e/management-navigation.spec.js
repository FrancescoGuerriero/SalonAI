import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const superAdminUser = {
  _id: "qa-super-admin",
  id: "qa-super-admin",
  name: "QA Super Admin",
  email: "qa-super-admin@salonai.test",
  role: "super_admin",
  isActive: true,
  permissions: [],
  rolePermissions: [],
};

const receptionistUser = {
  _id: "qa-receptionist",
  id: "qa-receptionist",
  name: "QA Receptionist",
  email: "qa-receptionist@salonai.test",
  role: "receptionist",
  isActive: true,
  permissions: ["dashboard:view", "appointment:read"],
  rolePermissions: [],
};

async function mockManagementSession(page, user) {
  await page.addInitScript((sessionUser) => {
    localStorage.setItem("salonai_token", "qa-token");
    localStorage.setItem("salonai_user", JSON.stringify(sessionUser));
    localStorage.removeItem(
      "salonai.managementNavigation.presentation.v1"
    );
    localStorage.removeItem(
      "salonai-management-sidebar-collapsed"
    );
  }, user);

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === "/api/auth/me") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user }),
      });
      return;
    }

    if (
      url.pathname ===
      "/api/app-configuration/features"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ features: {} }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
}

function managementNavigation(page) {
  return page.getByRole("navigation", {
    name: "Management workspaces",
  });
}

test.describe("Stage 1C management HCI acceptance", () => {
  test("Simple and Advanced views work by keyboard, persist after reload and preserve search discoverability", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Desktop management-navigation acceptance runs once in Chromium desktop."
    );

    await mockManagementSession(page, superAdminUser);
    await page.goto("/dashboard");

    const navigation = managementNavigation(page);
    const simple = navigation.getByRole("button", {
      name: "Simple",
    });
    const advanced = navigation.getByRole("button", {
      name: "Advanced",
    });
    const search = navigation.getByRole("searchbox", {
      name: "Search management tasks and tools",
    });

    await expect(navigation).toBeVisible();
    await expect(simple).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(
      navigation.getByText("Appointments", {
        exact: true,
      })
    ).toBeVisible();
    await expect(
      navigation.getByText("Haircare AI", {
        exact: true,
      })
    ).toHaveCount(0);

    await search.fill("Management copilot");

    await expect(
      navigation.getByText("Management copilot", {
        exact: true,
      })
    ).toBeVisible();
    await expect(
      navigation.getByText("Advanced", {
        exact: true,
      }).last()
    ).toBeVisible();

    await search.fill("");

    await simple.focus();
    await expect(simple).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(advanced).toBeFocused();

    const focusStyle = await advanced.evaluate(
      (element) => {
        const style = getComputedStyle(element);
        return {
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
        };
      }
    );

    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(focusStyle.outlineWidth).not.toBe("0px");

    await page.keyboard.press("Enter");

    await expect(advanced).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(
      navigation.getByText("Haircare AI", {
        exact: true,
      })
    ).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem(
            "salonai.managementNavigation.presentation.v1"
          )
        )
      )
      .toBe("advanced");

    await page.reload();

    const navigationAfterReload =
      managementNavigation(page);

    await expect(
      navigationAfterReload.getByRole("button", {
        name: "Advanced",
      })
    ).toHaveAttribute("aria-pressed", "true");

    await expect(
      navigationAfterReload.getByText("Haircare AI", {
        exact: true,
      })
    ).toBeVisible();

    const horizontalOverflow =
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
      );

    expect(horizontalOverflow).toBe(false);
  });

  test("Advanced view never bypasses delegated permissions", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Delegated-permission acceptance runs once in Chromium desktop."
    );

    await mockManagementSession(
      page,
      receptionistUser
    );
    await page.goto("/dashboard");

    const navigation = managementNavigation(page);
    const advanced = navigation.getByRole("button", {
      name: "Advanced",
    });
    const search = navigation.getByRole("searchbox", {
      name: "Search management tasks and tools",
    });

    await expect(navigation).toBeVisible();
    await advanced.click();

    await search.fill("Booking demand");
    await expect(
      navigation.getByText("Booking demand", {
        exact: true,
      })
    ).toBeVisible();

    await search.fill("Haircare AI");
    await expect(
      navigation.getByText("Haircare AI", {
        exact: true,
      })
    ).toHaveCount(0);
    await expect(
      navigation.getByText("Admin overview", {
        exact: true,
      })
    ).toHaveCount(0);

    await expect(
      navigation.getByText(
        "No tasks or tools found",
        { exact: true }
      )
    ).toBeVisible();
  });

  test("management navigation has no serious or critical WCAG violations in the authenticated shell", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Authenticated Axe acceptance runs once in Chromium desktop."
    );

    await mockManagementSession(page, superAdminUser);
    await page.goto("/dashboard");

    const navigation = managementNavigation(page);
    await expect(navigation).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include(".management-navigation")
      .withTags([
        "wcag2a",
        "wcag2aa",
        "wcag21a",
        "wcag21aa",
      ])
      .analyze();

    const seriousViolations =
      results.violations.filter((violation) =>
        ["serious", "critical"].includes(
          violation.impact
        )
      );

    expect(
      seriousViolations,
      JSON.stringify(
        seriousViolations,
        null,
        2
      )
    ).toEqual([]);
  });

  test("mobile management presentation controls stay inside the drawer and meet the project touch target", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chrome",
      "Mobile management-navigation acceptance runs in the mobile project."
    );

    await page.setViewportSize({
      width: 390,
      height: 720,
    });

    await mockManagementSession(page, superAdminUser);
    await page.goto("/dashboard");

    const trigger = page.getByRole("button", {
      name: "Menu",
    });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.getByRole("dialog", {
      name: "Management navigation",
    });
    const navigation = dialog.getByRole(
      "navigation",
      {
        name: "Management workspaces",
      }
    );
    const simple = navigation.getByRole("button", {
      name: "Simple",
    });
    const advanced = navigation.getByRole("button", {
      name: "Advanced",
    });

    await expect(dialog).toBeVisible();
    await expect(simple).toBeVisible();
    await expect(advanced).toBeVisible();

    for (const control of [simple, advanced]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThanOrEqual(
        40
      );
      expect(box.width).toBeGreaterThanOrEqual(
        44
      );
    }

    const [dialogBox, simpleBox, advancedBox] =
      await Promise.all([
        dialog.boundingBox(),
        simple.boundingBox(),
        advanced.boundingBox(),
      ]);

    expect(dialogBox).not.toBeNull();
    expect(simpleBox).not.toBeNull();
    expect(advancedBox).not.toBeNull();

    for (const box of [
      simpleBox,
      advancedBox,
    ]) {
      expect(box.x).toBeGreaterThanOrEqual(
        dialogBox.x
      );
      expect(
        box.x + box.width
      ).toBeLessThanOrEqual(
        dialogBox.x + dialogBox.width + 1
      );
    }

    const horizontalOverflow =
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
      );

    expect(horizontalOverflow).toBe(false);

    await simple.focus();
    await page.keyboard.press("Tab");
    await expect(advanced).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(advanced).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
