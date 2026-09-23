import {
  Link2,
  Link2Off,
  ShieldCheck,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useSearchParams,
} from "react-router-dom";

import authService from "../../Services/authService.js";

const PROVIDERS = Object.freeze({
  google: "Google",
  facebook: "Facebook",
  microsoft: "Microsoft",
  yahoo: "Yahoo",
});

function message(error) {
  return (
    error?.response?.data
      ?.message ||
    error?.message ||
    "Connected sign-in settings could not be updated."
  );
}

export default function SocialAccountLinks() {
  const [
    searchParams,
  ] = useSearchParams();
  const [
    availability,
    setAvailability,
  ] = useState([]);
  const [
    identities,
    setIdentities,
  ] = useState([]);
  const [
    passwordAuthEnabled,
    setPasswordAuthEnabled,
  ] = useState(true);
  const [
    working,
    setWorking,
  ] = useState("");
  const [
    error,
    setError,
  ] = useState("");

  const load = useCallback(
    async () => {
      setError("");

      try {
        const [
          providerResult,
          linkResult,
        ] =
          await Promise.all([
            authService.getSocialProviders(),
            authService.getSocialLinks(),
          ]);

        setAvailability(
          providerResult.providers ||
            []
        );
        setIdentities(
          linkResult.identities ||
            []
        );
        setPasswordAuthEnabled(
          linkResult.passwordAuthEnabled !==
            false
        );
      } catch (
        requestError
      ) {
        setError(
          message(
            requestError
          )
        );
      }
    },
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const linkedProvider =
    searchParams.get(
      "socialLink"
    );
  const callbackProvider =
    searchParams.get(
      "provider"
    );
  const callbackCode =
    searchParams.get(
      "socialCode"
    ) || "";

  const linkedMap =
    useMemo(
      () =>
        new Map(
          identities.map(
            (identity) => [
              identity.provider,
              identity,
            ]
          )
        ),
      [identities]
    );

  async function connect(
    provider
  ) {
    setWorking(
      "link:" + provider
    );
    setError("");

    try {
      const result =
        await authService.startSocialLink(
          provider
        );

      if (
        !result.authorizationUrl
      ) {
        throw new Error(
          "The provider did not return a connection URL."
        );
      }

      window.location.assign(
        result.authorizationUrl
      );
    } catch (
      requestError
    ) {
      setWorking("");
      setError(
        message(
          requestError
        )
      );
    }
  }

  async function unlink(
    provider
  ) {
    if (
      !window.confirm(
        "Remove " +
          PROVIDERS[provider] +
          " as a SalonAI sign-in method?"
      )
    ) {
      return;
    }

    setWorking(
      "unlink:" + provider
    );
    setError("");

    try {
      await authService.unlinkSocialProvider(
        provider
      );
      await load();
    } catch (
      requestError
    ) {
      setError(
        message(
          requestError
        )
      );
    } finally {
      setWorking("");
    }
  }

  return (
    <section className="manage-account-social">
      <header>
        <ShieldCheck
          size={20}
        />
        <div>
          <h2>
            Connected sign-in accounts
          </h2>
          <p>
            Add Google, Facebook, Microsoft or Yahoo as secure ways to sign in. These connections do not grant calendar, mail or contact access.
          </p>
        </div>
      </header>

      {linkedProvider ===
      "linked" ? (
        <div
          className="manage-account-social-notice"
          role="status"
        >
          {PROVIDERS[
            callbackProvider
          ] ||
            "Provider"}{" "}
          is now linked to your SalonAI account.
        </div>
      ) : null}

      {linkedProvider ===
      "error" ? (
        <div
          className="manage-account-social-error"
          role="alert"
        >
          {callbackCode ===
          "SOCIAL_AUTH_BROWSER_BINDING_FAILED"
            ? "This connection request expired, was already used, or was opened in a different browser session. Start the connection again. Your existing SalonAI sign-in remains unchanged."
            : "The provider could not be linked. Your existing SalonAI sign-in remains unchanged."}
        </div>
      ) : null}

      {error ? (
        <div
          className="manage-account-social-error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <p className="manage-account-social-summary">
        SalonAI password:{" "}
        <strong>
          {passwordAuthEnabled
            ? "Enabled"
            : "Not set"}
        </strong>
        . You must always keep at least one usable sign-in method.
      </p>

      <div className="manage-account-social-grid">
        {Object.keys(
          PROVIDERS
        ).map(
          (provider) => {
            const connected =
              linkedMap.get(
                provider
              );
            const configured =
              availability.find(
                (item) =>
                  item.provider ===
                  provider
              )?.configured ===
              true;

            return (
              <article
                key={provider}
                className="manage-account-social-card"
              >
                <div>
                  <strong>
                    {PROVIDERS[
                      provider
                    ]}
                  </strong>
                  <small>
                    {connected
                      ? connected.email ||
                        "Connected"
                      : configured
                        ? "Available to connect"
                        : "Provider not configured"}
                  </small>
                </div>

                {connected ? (
                  <button
                    type="button"
                    className="app-button"
                    disabled={
                      Boolean(
                        working
                      )
                    }
                    onClick={() =>
                      void unlink(
                        provider
                      )
                    }
                  >
                    <Link2Off
                      size={16}
                    />
                    Unlink
                  </button>
                ) : (
                  <button
                    type="button"
                    className="app-button app-button-primary"
                    disabled={
                      !configured ||
                      Boolean(
                        working
                      )
                    }
                    onClick={() =>
                      void connect(
                        provider
                      )
                    }
                  >
                    <Link2
                      size={16}
                    />
                    Link
                  </button>
                )}
              </article>
            );
          }
        )}
      </div>
    </section>
  );
}
