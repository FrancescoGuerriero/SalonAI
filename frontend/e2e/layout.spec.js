import { expect, test } from "@playwright/test";

const adminUser = {
  _id: "qa-admin",
  id: "qa-admin",
  name: "QA Administrator",
  email: "qa-admin@salonai.test",
  role: "admin",
  isActive: true,
};

async function mockFeatureControls(page) {
  await page.route("**/api/app-configuration/features*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ features: {} }),
    });
  });
}

test.describe("SalonAI layout regressions", () => {
  test("desktop management sidebar keeps header, navigation and footer separate", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Desktop sidebar regression only applies to the desktop shell."
    );

    await page.setViewportSize({
      width: 1280,
      height: 560,
    });

    await page.addInitScript((user) => {
      localStorage.setItem("salonai_token", "qa-token");
      localStorage.setItem("salonai_user", JSON.stringify(user));
      localStorage.removeItem("salonai-management-sidebar-collapsed");
    }, adminUser);

    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname === "/api/auth/me") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user: adminUser }),
        });
        return;
      }

      if (url.pathname === "/api/app-configuration/features") {
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

    await page.goto("/staff/profile");

    const sidebar = page.locator(".management-sidebar");
    const header = page.locator(".management-sidebar-head");
    const navigation = page.locator(".management-sidebar-scroll");
    const footer = page.locator(".management-sidebar-foot");

    await expect(sidebar).toBeVisible();
    await expect(header).toBeVisible();
    await expect(navigation).toBeVisible();
    await expect(footer).toBeVisible();

    const metrics = await navigation.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));

    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    const boxes = await Promise.all([
      header.boundingBox(),
      navigation.boundingBox(),
      footer.boundingBox(),
      sidebar.boundingBox(),
    ]);

    const [headerBox, navigationBox, footerBox, sidebarBox] = boxes;

    expect(headerBox).not.toBeNull();
    expect(navigationBox).not.toBeNull();
    expect(footerBox).not.toBeNull();
    expect(sidebarBox).not.toBeNull();

    expect(headerBox.y + headerBox.height).toBeLessThanOrEqual(
      navigationBox.y + 1
    );
    expect(navigationBox.y + navigationBox.height).toBeLessThanOrEqual(
      footerBox.y + 1
    );
    expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(
      sidebarBox.y + sidebarBox.height + 1
    );

    const lastLink = navigation.locator(".management-link").last();
    await lastLink.scrollIntoViewIfNeeded();
    await expect(lastLink).toBeVisible();

    const [lastLinkBox, navigationBoxAfterScroll] = await Promise.all([
      lastLink.boundingBox(),
      navigation.boundingBox(),
    ]);

    expect(lastLinkBox.y).toBeGreaterThanOrEqual(
      navigationBoxAfterScroll.y - 1
    );
    expect(lastLinkBox.y + lastLinkBox.height).toBeLessThanOrEqual(
      navigationBoxAfterScroll.y + navigationBoxAfterScroll.height + 1
    );
  });

  test("service metadata and actions align across mixed description lengths", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Desktop row alignment is checked in the desktop project."
    );

    await page.setViewportSize({
      width: 1280,
      height: 900,
    });

    await mockFeatureControls(page);

    await page.route("**/api/services*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            _id: "service-short",
            name: "Cut and finish",
            category: "Hair",
            description: "Clean, polished finish.",
            price: 68,
            duration: 45,
            active: true,
            published: true,
            bookable: true,
          },
          {
            _id: "service-long",
            name: "Colour transformation",
            category: "Colour",
            description:
              "A deliberately longer service description that wraps over several lines so duration, price and the booking action must still sit on the same baseline as the shorter card beside it.",
            price: 150,
            durationEstimated: true,
            active: true,
            published: true,
            bookable: true,
          },
          {
            _id: "service-medium",
            name: "Blow dry",
            category: "Styling",
            description:
              "Professional styling for a smooth and manageable finish.",
            price: 50,
            durationEstimated: true,
            active: true,
            published: true,
            bookable: true,
          },
        ]),
      });
    });

    await page.goto("/services");

    const cards =
      page.locator(
        ".service-card"
      );

    await expect(
      cards
    ).toHaveCount(
      3
    );

    const metaBoxes =
      await Promise.all(
        [0, 1, 2].map(
          (index) =>
            cards
              .nth(index)
              .locator(
                ".customer-card-meta"
              )
              .boundingBox()
        )
      );

    const actionBoxes =
      await Promise.all(
        [0, 1, 2].map(
          (index) =>
            cards
              .nth(index)
              .locator(
                ".customer-card-action"
              )
              .boundingBox()
        )
      );

    for (
      const box of [
        ...metaBoxes,
        ...actionBoxes,
      ]
    ) {
      expect(
        box
      ).not.toBeNull();
    }

    expect(
      Math.max(
        ...metaBoxes.map(
          (box) => box.y
        )
      ) -
        Math.min(
          ...metaBoxes.map(
            (box) => box.y
          )
        )
    ).toBeLessThanOrEqual(
      2
    );

    expect(
      Math.max(
        ...actionBoxes.map(
          (box) => box.y
        )
      ) -
        Math.min(
          ...actionBoxes.map(
            (box) => box.y
          )
        )
    ).toBeLessThanOrEqual(
      2
    );

    const horizontalOverflow =
      await page.evaluate(
        () =>
          document.documentElement
            .scrollWidth >
          document.documentElement
            .clientWidth
      );

    expect(
      horizontalOverflow
    ).toBe(
      false
    );
  });

  test("stylist actions align across a desktop row with mixed biography lengths", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Desktop row alignment is checked in the desktop project."
    );

    await page.setViewportSize({
      width: 1280,
      height: 800,
    });

    await mockFeatureControls(page);

    await page.route("**/api/stylists/public*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stylists: [
            {
              _id: "stylist-short",
              firstName: "Maya",
              lastName: "Stone",
              specialties: ["Colour"],
              biography: "Precision colour specialist.",
              yearsExperience: 6,
              rating: 4.9,
              isActive: true,
            },
            {
              _id: "stylist-long",
              firstName: "Alexandra",
              lastName: "Montgomery-Williams",
              specialties: ["Balayage", "Cutting", "Editorial styling"],
              biography:
                "A much longer professional biography used to verify that meaningful content can wrap naturally without pushing the booking action away from the shared action line across a desktop card row.",
              yearsExperience: 14,
              rating: 4.8,
              isActive: true,
            },
          ],
        }),
      });
    });

    await page.goto("/stylists");

    const cards = page.locator(".stylist-card");
    await expect(cards).toHaveCount(2);

    const firstAction = cards.nth(0).locator(".customer-card-action");
    const secondAction = cards.nth(1).locator(".customer-card-action");

    const [firstBox, secondBox] = await Promise.all([
      firstAction.boundingBox(),
      secondAction.boundingBox(),
    ]);

    expect(Math.abs(firstBox.y - secondBox.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(firstBox.height - secondBox.height)).toBeLessThanOrEqual(2);
  });

  test("shop price and actions align across a desktop row with mixed product copy", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Desktop row alignment is checked in the desktop project."
    );

    await page.setViewportSize({
      width: 1280,
      height: 900,
    });

    await mockFeatureControls(page);

    await page.route("**/api/commerce/products*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              _id: "product-short",
              slug: "shine-oil",
              name: "Shine Oil",
              brand: "SalonAI",
              category: "Finishing",
              description: "Lightweight shine.",
              price: 24,
              stockQuantity: 8,
              active: true,
            },
            {
              _id: "product-long",
              slug: "restorative-hair-treatment",
              name: "Professional Restorative Hair Treatment",
              brand: "SalonAI Professional",
              category: "Treatments",
              collectionName: "Repair and Restore",
              badge: "Salon favourite",
              size: "250 ml",
              description:
                "A deliberately longer customer-facing description that wraps over several lines so the product row can prove that price, stock state and actions remain aligned without hiding meaningful information.",
              price: 38,
              stockQuantity: 5,
              active: true,
            },
          ],
          categories: ["Finishing", "Treatments"],
          brands: ["SalonAI", "SalonAI Professional"],
          collections: ["Repair and Restore"],
        }),
      });
    });

    await page.goto("/shop");

    const cards = page.locator(".commerce-product-card");
    await expect(cards).toHaveCount(2);

    const [firstFooter, secondFooter] = await Promise.all([
      cards.nth(0).locator(".commerce-product-footer").boundingBox(),
      cards.nth(1).locator(".commerce-product-footer").boundingBox(),
    ]);

    expect(Math.abs(firstFooter.y - secondFooter.y)).toBeLessThanOrEqual(2);

    const horizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );

    expect(horizontalOverflow).toBe(false);
  });

  test("public mobile navigation traps focus and restores it to the menu trigger", async ({
    page,
  }) => {
    await page.setViewportSize({
      width: 390,
      height: 844,
    });

    await mockFeatureControls(page);
    await page.goto("/");

    const trigger = page.getByRole("button", {
      name: "Open navigation",
    });

    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.getByRole("dialog", {
      name: "Mobile navigation",
    });
    const close = dialog.getByRole("button", {
      name: "Close navigation",
    });

    await expect(dialog).toBeVisible();
    await expect(close).toBeFocused();

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    const horizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );

    expect(horizontalOverflow).toBe(false);
  });

  test("management mobile drawer traps focus and preserves touch-sized navigation", async ({
    page,
  }) => {
    await page.setViewportSize({
      width: 390,
      height: 720,
    });

    await page.addInitScript((user) => {
      localStorage.setItem("salonai_token", "qa-token");
      localStorage.setItem("salonai_user", JSON.stringify(user));
    }, adminUser);

    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname === "/api/auth/me") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user: adminUser }),
        });
        return;
      }

      if (url.pathname === "/api/app-configuration/features") {
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

    await page.goto("/staff/profile");

    const trigger = page.getByRole("button", {
      name: "Menu",
    });
    await trigger.click();

    const dialog = page.getByRole("dialog", {
      name: "Management navigation",
    });
    const close = dialog.getByRole("button", {
      name: "Close management navigation",
    });

    await expect(dialog).toBeVisible();
    await expect(close).toBeFocused();

    const firstLink = dialog.locator(".management-link").first();
    const linkBox = await firstLink.boundingBox();

    expect(linkBox.height).toBeGreaterThanOrEqual(44);

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });


  test("service editor traps focus, closes with Escape and restores the trigger on mobile", async ({
    page,
  }) => {
    const superAdmin = {
      ...adminUser,
      role: "super_admin",
    };

    await page.setViewportSize({
      width: 390,
      height: 720,
    });

    await page.addInitScript((user) => {
      localStorage.setItem("salonai_token", "qa-token");
      localStorage.setItem("salonai_user", JSON.stringify(user));
    }, superAdmin);

    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname === "/api/auth/me") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user: superAdmin }),
        });
        return;
      }

      if (url.pathname === "/api/app-configuration/features") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ features: {} }),
        });
        return;
      }

      if (url.pathname === "/api/services/management") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ services: [] }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.goto("/manage/services");

    const trigger = page.getByRole("button", {
      name: /add service/i,
    });

    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.getByRole("dialog", {
      name: "Add service",
    });
    const close = dialog.getByRole("button", {
      name: "Close service editor",
    });

    await expect(dialog).toBeVisible();
    await expect(close).toBeFocused();

    const dialogBox =
      await dialog.boundingBox();
    const viewport =
      page.viewportSize();

    expect(dialogBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(dialogBox.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox.y).toBeGreaterThanOrEqual(0);
    expect(
      dialogBox.x +
        dialogBox.width
    ).toBeLessThanOrEqual(
      viewport.width
    );
    expect(
      dialogBox.y +
        dialogBox.height
    ).toBeLessThanOrEqual(
      viewport.height
    );

    const scrollBody =
      dialog.locator(
        "form > div"
      ).first();

    const scrollMetrics =
      await scrollBody.evaluate(
        (element) => ({
          clientHeight:
            element.clientHeight,
          scrollHeight:
            element.scrollHeight,
          overflowY:
            getComputedStyle(
              element
            ).overflowY,
        })
      );

    expect(
      scrollMetrics.overflowY
    ).toBe("auto");
    expect(
      scrollMetrics.scrollHeight
    ).toBeGreaterThanOrEqual(
      scrollMetrics.clientHeight
    );

    await expect(
      dialog.getByRole(
        "button",
        {
          name:
            "Create employee",
        }
      )
    ).toBeVisible();

    const horizontalOverflow =
      await page.evaluate(
        () =>
          document
            .documentElement
            .scrollWidth >
          document
            .documentElement
            .clientWidth
      );

    expect(
      horizontalOverflow
    ).toBe(false);

    await page.keyboard.press("Shift+Tab");
    await expect(
      dialog.getByRole("button", {
        name: /create service/i,
      })
    ).toBeFocused();

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.locator("body")).not.toHaveCSS(
      "overflow",
      "hidden"
    );
  });

  test("product editor keeps its close control reachable and restores focus", async ({
    page,
  }) => {
    const superAdmin = {
      ...adminUser,
      role: "super_admin",
    };

    await page.setViewportSize({
      width: 390,
      height: 720,
    });

    await page.addInitScript((user) => {
      localStorage.setItem("salonai_token", "qa-token");
      localStorage.setItem("salonai_user", JSON.stringify(user));
    }, superAdmin);

    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname === "/api/auth/me") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user: superAdmin }),
        });
        return;
      }

      if (url.pathname === "/api/app-configuration/features") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ features: {} }),
        });
        return;
      }

      if (url.pathname === "/api/commerce/inventory/products") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [] }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.goto("/manage/products");

    const trigger = page.getByRole("button", {
      name: /add product/i,
    });

    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.getByRole("dialog", {
      name: "Add product",
    });
    const close = dialog.getByRole("button", {
      name: "Close product editor",
    });

    await expect(dialog).toBeVisible();
    await expect(close).toBeFocused();

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("add employee dialog traps focus and restores the trigger on mobile", async ({
    page,
  }) => {
    const superAdmin = {
      ...adminUser,
      role: "super_admin",
    };

    await page.setViewportSize({
      width: 390,
      height: 720,
    });

    await page.addInitScript((user) => {
      localStorage.setItem("salonai_token", "qa-token");
      localStorage.setItem("salonai_user", JSON.stringify(user));
    }, superAdmin);

    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname === "/api/auth/me") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user: superAdmin }),
        });
        return;
      }

      if (url.pathname === "/api/app-configuration/features") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ features: {} }),
        });
        return;
      }

      if (url.pathname === "/api/auth/admin/staff") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ users: [] }),
        });
        return;
      }

      if (url.pathname === "/api/services/management") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            services: [
              {
                _id: "507f1f77bcf86cd799439011",
                name: "Haircut QA",
                category: "Hair",
                active: true,
              },
            ],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.goto("/admin/employees");

    const trigger = page.getByRole("button", {
      name: "Add employee",
    });

    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.getByRole("dialog", {
      name: "Add employee",
    });
    const close = dialog.getByRole("button", {
      name: "Close",
    });

    await expect(dialog).toBeVisible();
    await expect(close).toBeFocused();

    await page.keyboard.press("Shift+Tab");

    await expect(
      dialog.getByRole("button", {
        name: "Create employee",
      })
    ).toBeFocused();

    const assignServices = dialog
      .locator("label")
      .filter({
        hasText: "Assign services during onboarding",
      });

    await expect(
      assignServices.locator("input")
    ).toBeEnabled();
    await assignServices.click();

    const serviceChoice = dialog
      .locator("label")
      .filter({
        hasText: "Haircut QA",
      })
      .first();

    await expect(serviceChoice).toBeVisible();

    const configureSchedule = dialog
      .locator("label")
      .filter({
        hasText: "Configure schedule during onboarding",
      });

    await configureSchedule.click();

    const mondayChoice = dialog
      .locator("label")
      .filter({
        hasText: "Monday",
      })
      .first();

    const permissionsDetails = dialog
      .locator("details")
      .filter({
        hasText: "Initial access permissions",
      });

    await permissionsDetails
      .locator("summary")
      .click();

    const permissionChoice = permissionsDetails
      .locator("label")
      .filter({
        hasText: "View dashboard",
      })
      .first();

    for (const control of [
      assignServices,
      serviceChoice,
      configureSchedule,
      mondayChoice,
      permissionChoice,
    ]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.locator("body")).not.toHaveCSS(
      "overflow",
      "hidden"
    );
  });

  test("SalonAI Adviser dialog traps focus and restores its launcher", async ({
    page,
  }) => {
    const superAdmin = {
      ...adminUser,
      role: "super_admin",
    };

    await page.setViewportSize({
      width: 390,
      height: 720,
    });

    await page.addInitScript((user) => {
      localStorage.setItem("salonai_token", "qa-token");
      localStorage.setItem("salonai_user", JSON.stringify(user));
    }, superAdmin);

    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname === "/api/auth/me") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user: superAdmin }),
        });
        return;
      }

      if (url.pathname === "/api/app-configuration/features") {
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

    await page.goto("/dashboard");

    const trigger = page.getByRole("button", {
      name: "Ask SalonAI",
    });

    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = page.getByRole("dialog", {
      name: "SalonAI Adviser",
    });
    const close = dialog.getByRole("button", {
      name: "Close SalonAI Adviser",
    });

    await expect(dialog).toBeVisible();
    await expect(close).toBeFocused();

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.locator("body")).not.toHaveCSS(
      "overflow",
      "hidden"
    );
  });

  test("employee Active, Published and Bookable controls remain independent and touch-sized", async ({
    page,
  }, testInfo) => {
    const superAdmin = {
      ...adminUser,
      role: "super_admin",
    };

    await page.setViewportSize({
      width: 390,
      height: 844,
    });

    await page.addInitScript((user) => {
      localStorage.setItem("salonai_token", "qa-token");
      localStorage.setItem("salonai_user", JSON.stringify(user));
    }, superAdmin);

    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname === "/api/auth/me") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user: superAdmin }),
        });
        return;
      }

      if (url.pathname === "/api/app-configuration/features") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ features: {} }),
        });
        return;
      }

      if (url.pathname === "/api/auth/admin/staff") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            users: [
              {
                id: "employee-anna",
                _id: "employee-anna",
                name: "Anna Smith",
                email: "anna@example.test",
                phone: "02000000001",
                role: "stylist",
                isActive: true,
                stylistProfile: {
                  profilePublished: true,
                  acceptsAppointments: false,
                  workingHours: [],
                  services: [],
                },
              },
            ],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.goto("/admin/employees");

    const active = page.getByRole("switch", {
      name: "Active",
    });
    const published = page.getByRole("switch", {
      name: "Published",
    });
    const bookable = page.getByRole("switch", {
      name: "Bookable",
    });

    await expect(active).toHaveAttribute("aria-checked", "true");
    await expect(published).toHaveAttribute("aria-checked", "true");
    await expect(bookable).toHaveAttribute("aria-checked", "false");

    const targetMinimum =
      testInfo.project.name === "mobile-chrome"
        ? 44
        : 24;

    for (const control of [active, published, bookable]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThanOrEqual(targetMinimum);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  });

  test("staff profile publication control remains touch-sized on mobile", async ({
    page,
  }) => {
    const superAdmin = {
      ...adminUser,
      role: "super_admin",
    };

    await page.setViewportSize({
      width: 390,
      height: 844,
    });

    await page.addInitScript((user) => {
      localStorage.setItem("salonai_token", "qa-token");
      localStorage.setItem("salonai_user", JSON.stringify(user));
    }, superAdmin);

    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname === "/api/auth/me") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user: superAdmin }),
        });
        return;
      }

      if (url.pathname === "/api/app-configuration/features") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ features: {} }),
        });
        return;
      }

      if (url.pathname === "/api/auth/admin/staff") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            users: [
              {
                id: "employee-anna",
                name: "Anna Smith",
                email: "anna@example.test",
                role: "stylist",
                stylistProfile: {
                  id: "profile-anna",
                  profilePublished: true,
                },
              },
            ],
          }),
        });
        return;
      }

      if (url.pathname === "/api/stylists/profile-anna") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            _id: "profile-anna",
            firstName: "Anna",
            lastName: "Smith",
            email: "anna@example.test",
            jobTitle: "Senior Stylist",
            profilePublished: true,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.goto("/admin/stylists");

    await expect(
      page.getByRole("heading", {
        name: "Manage the professional profiles clients see.",
      })
    ).toBeVisible();

    const publicationControl = page
      .locator("label")
      .filter({
        hasText: "Published",
      })
      .last();

    await expect(publicationControl).toBeVisible();

    const box = await publicationControl.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);

    const horizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );

    expect(horizontalOverflow).toBe(false);
  });

  test("System Administration feature switches are labelled and touch-sized", async ({
    page,
  }, testInfo) => {
    const superAdmin = {
      ...adminUser,
      role: "super_admin",
    };

    await page.setViewportSize({
      width: 390,
      height: 844,
    });

    await page.addInitScript((user) => {
      localStorage.setItem("salonai_token", "qa-token");
      localStorage.setItem("salonai_user", JSON.stringify(user));
    }, superAdmin);

    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname === "/api/auth/me") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user: superAdmin }),
        });
        return;
      }

      if (url.pathname === "/api/app-configuration/features") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ features: {} }),
        });
        return;
      }

      if (url.pathname === "/api/health/dependencies") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "ok" }),
        });
        return;
      }

      if (url.pathname === "/api/system-administration/settings") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ settings: [] }),
        });
        return;
      }

      if (url.pathname === "/api/system-administration/features") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            features: [
              {
                id: "online-booking",
                label: "Online booking",
                description: "Allow customers to begin online booking.",
                category: "Customer experience",
                enabled: true,
                source: "admin",
                required: false,
              },
            ],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.goto("/admin/system");

    const featureSwitch = page.getByRole("switch", {
      name: "Disable Online booking",
    });

    await expect(featureSwitch).toHaveAttribute(
      "aria-checked",
      "true"
    );

    const box = await featureSwitch.boundingBox();
    expect(box).not.toBeNull();

    const targetMinimum =
      testInfo.project.name === "mobile-chrome"
        ? 44
        : 24;

    expect(box.height).toBeGreaterThanOrEqual(targetMinimum);
    expect(box.width).toBeGreaterThanOrEqual(44);

    const thumb = featureSwitch.locator("span");
    const thumbBox = await thumb.boundingBox();
    expect(thumbBox).not.toBeNull();

    expect(thumbBox.x).toBeGreaterThanOrEqual(box.x);
    expect(
      thumbBox.x + thumbBox.width
    ).toBeLessThanOrEqual(
      box.x + box.width
    );

    const switchCentre =
      box.y + box.height / 2;
    const thumbCentre =
      thumbBox.y + thumbBox.height / 2;

    expect(
      Math.abs(
        switchCentre -
        thumbCentre
      )
    ).toBeLessThanOrEqual(1);

    const horizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );

    expect(horizontalOverflow).toBe(false);
  });

  test("staff role controls remain touch-sized and overflow-free on mobile", async ({
    page,
  }) => {
    const superAdmin = {
      ...adminUser,
      role: "super_admin",
    };

    await page.setViewportSize({
      width: 390,
      height: 844,
    });

    await page.addInitScript((user) => {
      localStorage.setItem("salonai_token", "qa-token");
      localStorage.setItem("salonai_user", JSON.stringify(user));
    }, superAdmin);

    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname === "/api/auth/me") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user: superAdmin }),
        });
        return;
      }

      if (url.pathname === "/api/app-configuration/features") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ features: {} }),
        });
        return;
      }

      if (url.pathname === "/api/staff-roles") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            roles: [
              {
                id: "super_admin",
                key: "super_admin",
                name: "Super Admin",
                description: "Protected system role",
                system: true,
                active: true,
                permissions: [],
              },
              {
                id: "colour-specialist",
                key: "colour_specialist",
                name: "Colour Specialist",
                description: "Custom salon role",
                system: false,
                active: true,
                permissions: ["service:read"],
              },
            ],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.goto("/admin/staff-roles");

    await expect(
      page.getByRole("heading", {
        name: "Staff roles",
      })
    ).toBeVisible();

    const createPermission = page
      .locator("label")
      .filter({
        hasText: "Create salon services",
      })
      .first();

    const customRole = page
      .locator("article")
      .filter({
        hasText: "colour_specialist",
      })
      .first();

    const editPermission = customRole
      .locator("label")
      .filter({
        hasText: "Create salon services",
      })
      .first();

    const activeAssignable = page
      .locator("label")
      .filter({
        hasText: "Active and assignable",
      })
      .first();

    for (const control of [
      createPermission,
      editPermission,
      activeAssignable,
    ]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    const createButton = page.getByRole("button", {
      name: "Create role",
    });
    const createButtonBox =
      await createButton.boundingBox();

    expect(createButtonBox).not.toBeNull();
    expect(createButtonBox.height).toBeGreaterThanOrEqual(44);

    const horizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );

    expect(horizontalOverflow).toBe(false);
  });

});
