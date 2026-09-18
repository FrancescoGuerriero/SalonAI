import User from "../../models/user.js";

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
  socialLinkFrontendRedirect,
  socialProviderAvailability,
} from "./socialAuthProvider.js";
import {
  linkSocialIdentity,
  listLinkedSocialProviders,
  resolveSocialCustomer,
  unlinkSocialIdentity,
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

export async function links(
  request,
  response
) {
  const result =
    await listLinkedSocialProviders(
      request.user._id
    );

  return response.json({
    success: true,
    ...result,
  });
}

export function startLink(
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
        request.body?.returnTo ||
        "/account/manage",
      mode: "link",
      userId:
        request.user._id,
    });

  return response.json({
    success: true,
    ...result,
  });
}

export async function unlink(
  request,
  response
) {
  const result =
    await unlinkSocialIdentity(
      request.user._id,
      provider(
        request.params.provider
      )
    );

  return response.json({
    success: true,
    message:
      "Connected sign-in account removed.",
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
      state.mode === "link"
        ? {
            user:
              await User.findById(
                state.userId
              ),
            created: false,
          }
        : await resolveSocialCustomer(
            identity
          );

    if (
      state.mode === "link"
    ) {
      if (!result.user) {
        const missing =
          new Error(
            "The SalonAI account for this provider link no longer exists."
          );
        missing.statusCode = 404;
        missing.code =
          "SOCIAL_LINK_ACCOUNT_NOT_FOUND";
        throw missing;
      }

      await linkSocialIdentity(
        result.user._id,
        identity
      );

      return response.redirect(
        socialLinkFrontendRedirect({
          provider:
            selectedProvider,
          status: "linked",
          returnTo:
            state.returnTo,
        })
      );
    }

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
      Number(
        error.statusCode || 500
      ) >= 500
    ) {
      console.error(
        "Social sign-in callback failed:",
        error
      );
    }

    return response.redirect(
      state?.mode === "link"
        ? socialLinkFrontendRedirect({
            provider:
              selectedProvider,
            status: "error",
            returnTo,
            code:
              error.code ||
              "SOCIAL_LINK_FAILED",
          })
        : socialFrontendRedirect({
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
}
