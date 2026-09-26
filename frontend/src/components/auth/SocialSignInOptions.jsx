import {
  useEffect,
  useState,
} from "react";

import authService from "../../Services/authService.js";

const LABELS = Object.freeze({
  google: "Google",
  facebook: "Facebook",
  microsoft: "Microsoft",
  yahoo: "Yahoo",
});

export default function SocialSignInOptions({
  returnTo = "",
  onError,
  mode = "login",
}) {
  const [
    providers,
    setProviders,
  ] = useState(
    Object.keys(
      LABELS
    ).map(
      (provider) => ({
        provider,
        label:
          LABELS[provider],
        configured: false,
      })
    )
  );
  const [
    working,
    setWorking,
  ] = useState("");
  const [
    providerStatusLoaded,
    setProviderStatusLoaded,
  ] = useState(false);

  useEffect(() => {
    let active = true;

    authService
      .getSocialProviders()
      .then((result) => {
        if (!active) {
          return;
        }

        const available =
          new Map(
            (
              result.providers ||
              []
            ).map(
              (item) => [
                item.provider,
                item,
              ]
            )
          );

        setProviders(
          Object.keys(
            LABELS
          ).map(
            (provider) => ({
              provider,
              label:
                LABELS[
                  provider
                ],
              configured:
                available.get(
                  provider
                )?.configured ===
                true,
            })
          )
        );
        setProviderStatusLoaded(
          true
        );
      })
      .catch(() => {
        // Keep choices visible but unavailable
        // when server configuration cannot be read.
        if (active) {
          setProviderStatusLoaded(
            true
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const configuredCount =
    providers.filter(
      (item) =>
        item.configured
    ).length;

  const actionVerb =
    mode === "register"
      ? "Create account with "
      : "Sign in with ";

  async function begin(
    provider
  ) {
    setWorking(
      provider
    );

    try {
      const result =
        await authService.startSocialLogin(
          provider,
          {
            returnTo,
          }
        );

      if (
        !result.authorizationUrl
      ) {
        throw new Error(
          "The sign-in provider did not return an authorization URL."
        );
      }

      window.location.assign(
        result.authorizationUrl
      );
    } catch (error) {
      setWorking("");

      onError?.(
        error?.response?.data
          ?.message ||
          error?.message ||
          "Connected-account sign-in is unavailable."
      );
    }
  }

  return (
    <section
      className="auth-social"
      aria-label="Connected account sign in"
    >
      <div className="auth-social-grid">
        {providers.map(
          (item) => (
            <button
              key={
                item.provider
              }
              type="button"
              className="auth-social-button"
              disabled={
                !item.configured ||
                Boolean(working)
              }
              title={
                item.configured
                  ? actionVerb +
                    item.label
                  : item.label +
                    " sign-in is not configured yet"
              }
              onClick={() =>
                void begin(
                  item.provider
                )
              }
            >
              <span
                className="auth-social-mark"
                aria-hidden="true"
              >
                {item.label[0]}
              </span>
              <span>
                {working ===
                item.provider
                  ? "Opening " +
                    item.label +
                    "…"
                  : item.configured
                    ? actionVerb +
                      item.label
                    : item.label +
                      " — setup required"}
              </span>
            </button>
          )
        )}
      </div>

      {providerStatusLoaded &&
      configuredCount === 0 ? (
        <p
          className="auth-social-status"
          role="status"
        >
          Social sign-in is not active on this environment yet. You can use email while provider setup is completed.
        </p>
      ) : providerStatusLoaded &&
        configuredCount <
          providers.length ? (
        <p
          className="auth-social-status"
          role="status"
        >
          Available providers are active. Providers marked setup required are waiting for production OAuth configuration.
        </p>
      ) : null}

      <div
        className="auth-divider"
        aria-hidden="true"
      >
        <span>
          or use email
        </span>
      </div>
    </section>
  );
}
