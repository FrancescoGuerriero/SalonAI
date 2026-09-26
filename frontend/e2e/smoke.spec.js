import { expect, test } from "@playwright/test";

test.describe("SalonAI public application", () => {
  test("loads the public homepage", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/SalonAI/i);

    await expect(
      page.locator("body")
    ).toBeVisible();

    await expect(
      page.locator("main").first()
    ).toBeVisible();
  });

  test("has no horizontal overflow", async ({ page }) => {
    await page.goto("/");

    const hasHorizontalOverflow =
      await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
        );
      });

    expect(
      hasHorizontalOverflow
    ).toBe(false);
  });


  test("email registration signs the customer in and continues without a second login", async ({
    page,
  }) => {
    const customer = {
      id: "customer-registration-1",
      name: "New Customer",
      email: "new.customer@example.test",
      role: "customer",
      permissions: [],
      rolePermissions: [],
      phone: "",
      profilePhoto: "",
      homeAddress: {
        line1: "",
        line2: "",
        city: "",
        county: "",
        postcode: "",
        country: "United Kingdom",
      },
    };
    let registrationPayload =
      null;

    await page.route(
      "**/api/**",
      async (route) => {
        const url =
          new URL(
            route.request().url()
          );

        if (
          url.pathname ===
          "/api/auth/social/providers"
        ) {
          await route.fulfill({
            status: 200,
            contentType:
              "application/json",
            body: JSON.stringify({
              success: true,
              providers: [
                "google",
                "facebook",
                "microsoft",
                "yahoo",
              ].map(
                (provider) => ({
                  provider,
                  configured: false,
                })
              ),
            }),
          });
          return;
        }

        if (
          url.pathname ===
            "/api/auth/register" &&
          route.request().method() ===
            "POST"
        ) {
          registrationPayload =
            route.request()
              .postDataJSON();

          await route.fulfill({
            status: 201,
            contentType:
              "application/json",
            body: JSON.stringify({
              success: true,
              authenticated: true,
              verificationRequired:
                false,
              token:
                "registration-token",
              message:
                "Account created. You are signed in and ready to continue.",
              user: customer,
            }),
          });
          return;
        }

        if (
          url.pathname ===
          "/api/auth/me"
        ) {
          await route.fulfill({
            status: 200,
            contentType:
              "application/json",
            body: JSON.stringify({
              success: true,
              user: customer,
            }),
          });
          return;
        }

        if (
          url.pathname ===
          "/api/app-configuration/features"
        ) {
          await route.fulfill({
            status: 200,
            contentType:
              "application/json",
            body: JSON.stringify({
              features: {},
            }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType:
            "application/json",
          body:
            JSON.stringify({
              items: [],
              appointments: [],
              orders: [],
            }),
        });
      }
    );

    await page.goto(
      "/register"
    );

    await page
      .getByLabel(
        "Full name"
      )
      .fill(
        "New Customer"
      );
    await page
      .getByLabel(
        "Email address"
      )
      .fill(
        "new.customer@example.test"
      );
    await page
      .getByLabel(
        "Password",
        {
          exact: true,
        }
      )
      .fill(
        "SalonAI2026"
      );

    await page
      .getByRole(
        "button",
        {
          name:
            "Create account and continue",
        }
      )
      .click();

    await expect(
      page
    ).toHaveURL(
      /\/account$/
    );

    expect(
      registrationPayload
    ).toEqual({
      name:
        "New Customer",
      email:
        "new.customer@example.test",
      password:
        "SalonAI2026",
    });

    expect(
      await page.evaluate(
        () =>
          localStorage.getItem(
            "salonai_token"
          )
      )
    ).toBe(
      "registration-token"
    );

    await expect(
      page.locator(
        ".account-eyebrow"
      )
    ).toHaveText(
      "Customer account"
    );
  });

  test("email verification signs the customer in automatically and continues to the account", async ({
    page,
  }) => {
    const customer = {
      id: "customer-verification-1",
      name: "Verified Customer",
      email: "verified.customer@example.test",
      role: "customer",
      permissions: [],
      rolePermissions: [],
      phone: "",
      profilePhoto: "",
      homeAddress: {
        line1: "",
        line2: "",
        city: "",
        county: "",
        postcode: "",
        country: "United Kingdom",
      },
    };
    let verificationPayload =
      null;

    await page.route(
      "**/api/**",
      async (route) => {
        const url =
          new URL(
            route.request().url()
          );

        if (
          url.pathname ===
            "/api/auth/verify-email" &&
          route.request().method() ===
            "POST"
        ) {
          verificationPayload =
            route.request()
              .postDataJSON();

          await route.fulfill({
            status: 200,
            contentType:
              "application/json",
            body: JSON.stringify({
              success: true,
              authenticated: true,
              token:
                "verified-token",
              message:
                "Your email has been verified. You are signed in and ready to continue.",
              user: customer,
            }),
          });
          return;
        }

        if (
          url.pathname ===
          "/api/auth/me"
        ) {
          await route.fulfill({
            status: 200,
            contentType:
              "application/json",
            body: JSON.stringify({
              success: true,
              user: customer,
            }),
          });
          return;
        }

        if (
          url.pathname ===
          "/api/app-configuration/features"
        ) {
          await route.fulfill({
            status: 200,
            contentType:
              "application/json",
            body: JSON.stringify({
              features: {},
            }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType:
            "application/json",
          body:
            JSON.stringify({
              items: [],
              appointments: [],
              orders: [],
            }),
        });
      }
    );

    await page.goto(
      "/login?verify=verification-token"
    );

    await expect(
      page
    ).toHaveURL(
      /\/account$/
    );

    expect(
      verificationPayload
    ).toEqual({
      token:
        "verification-token",
    });

    expect(
      await page.evaluate(
        () =>
          localStorage.getItem(
            "salonai_token"
          )
      )
    ).toBe(
      "verified-token"
    );
  });

});
