import {
  createRefreshToken,
  setNoStoreHeaders,
  setRefreshCookie,
} from "../../controllers/authController.js";
import {
  createSocialAuthorization,
  readSocialState,
  resolveSocialIdentity,
  socialFrontendRedirect,
  socialProviderAvailability,
} from "./socialAuthProvider.js";
import {
  resolveSocialCustomer,
} from "./socialAuthService.js";

function provider(value) {
  const normalised =
    String(value || "")
      .trim()
      .toLowerCase();

  if (
    ![
      "google",
      "facebook",
      "microsoft",
      "yahoo",
    ].includes(normalised)
  ) {
    const error = new Error(
      "Unsupported social sign-in provider."
    );
    error.statusCode = 400;
    throw error;
  }

  return normalised;
}

export function providers(
  request,
  response
) {
  return response.json({
    success: true,
    providers:
      socialProviderAvailability(),
  });
}

export function start(
  request,
  response
) {
  const result =
    createSocialAuthorization({
      provider:
        provider(
          request.params.provider
        ),
      returnTo:
        request.body?.returnTo,
    });

  return response.json({
    success: true,
    ...result,
  });
}

export async function callback(
  request,
  response,
  next
) {
  const selectedProvider =
    provider(
      request.params.provider
    );

  let state;

  try {
    state =
      readSocialState(
        request.query.state
      );

    if (
      state.provider !==
      selectedProvider
    ) {
      const mismatch =
        new Error(
          "Social sign-in provider mismatch."
        );
      mismatch.statusCode = 400;
      throw mismatch;
    }

    if (
      request.query.error
    ) {
      return response.redirect(
        socialFrontendRedirect({
          provider:
            selectedProvider,
          status: "cancelled",
          returnTo:
            state.returnTo,
        })
      );
    }

    const identity =
      await resolveSocialIdentity({
        provider:
          selectedProvider,
        code:
          request.query.code,
      });

    const result =
      await resolveSocialCustomer(
        identity
      );

    if (
      result.user.isActive ===
      false
    ) {
      const disabled =
        new Error(
          "This account has been disabled."
        );
      disabled.statusCode = 403;
      disabled.code =
        "ACCOUNT_DISABLED";
      throw disabled;
    }

    result.user.recordLogin();
    await result.user.save();

    setRefreshCookie(
      response,
      createRefreshToken(
        result.user
      )
    );
    setNoStoreHeaders(
      response
    );

    return response.redirect(
      socialFrontendRedirect({
        provider:
          selectedProvider,
        status:
          result.created
            ? "registered"
            : "success",
        returnTo:
          state.returnTo,
      })
    );
  } catch (error) {
    const returnTo =
      state?.returnTo ||
      "";

    if (
      error.statusCode &&
      error.statusCode < 500
    ) {
      return response.redirect(
        socialFrontendRedirect({
          provider:
            selectedProvider,
          status: "error",
          returnTo,
          code:
            error.code ||
            "SOCIAL_SIGN_IN_FAILED",
        })
      );
    }

    return next(error);
  }
}
