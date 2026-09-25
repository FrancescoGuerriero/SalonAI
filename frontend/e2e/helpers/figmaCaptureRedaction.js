const CUSTOMER_SUMMARY_ROUTE = "/ai/customer-summaries";

export async function redactCapturePii(
  page,
  {
    routePath = "",
  } = {}
) {
  return page.evaluate(
    ({
      currentRoute,
      customerSummaryRoute,
    }) => {
      const replacements = new Map();
      const originals = new Set();
      let redactionCount = 0;
      let profileLinksRedacted = 0;

      const normalise = (value) =>
        String(value || "")
          .replace(/\s+/g, " ")
          .trim();

      const register = (
        value,
        replacement
      ) => {
        const original = normalise(value);

        if (
          !original ||
          original.length < 2
        ) {
          return;
        }

        originals.add(original);

        if (
          !replacements.has(original)
        ) {
          replacements.set(
            original,
            replacement
          );
        }
      };

      const emailPattern =
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

      const ukMobilePattern =
        /(?:\+44\s?7\d{3}|07\d{3})[\s.-]?\d{3}[\s.-]?\d{3}/g;

      if (
        currentRoute ===
        customerSummaryRoute
      ) {
        const chooser = [
          ...document.querySelectorAll(
            "aside"
          ),
        ].find((aside) =>
          [
            ...aside.querySelectorAll(
              "h2"
            ),
          ].some(
            (heading) =>
              normalise(
                heading.textContent
              ) ===
              "Choose customer"
          )
        );

        if (chooser) {
          let customerIndex = 0;

          for (
            const button
            of chooser.querySelectorAll(
              "button"
            )
          ) {
            const identityLines =
              button.querySelectorAll(
                "span.min-w-0 > span"
              );

            if (
              identityLines.length < 1
            ) {
              continue;
            }

            customerIndex += 1;

            register(
              identityLines[0]
                .textContent,
              `Customer ${String(
                customerIndex
              ).padStart(2, "0")}`
            );

            if (
              identityLines.length > 1
            ) {
              register(
                identityLines[1]
                  .textContent,
                "contact-redacted@example.invalid"
              );
            }
          }

          const selectedLabel = [
            ...chooser.querySelectorAll(
              "p"
            ),
          ].find(
            (element) =>
              normalise(
                element.textContent
              ) ===
              "Selected customer"
          );

          if (
            selectedLabel
              ?.nextElementSibling
          ) {
            register(
              selectedLabel
                .nextElementSibling
                .textContent,
              "Selected customer"
            );
          }

          for (
            const link
            of chooser.querySelectorAll(
              'a[href*="/customers/"]'
            )
          ) {
            link.setAttribute(
              "href",
              "/customers/redacted"
            );
            profileLinksRedacted += 1;
          }
        }
      }

      for (
        const element
        of document.querySelectorAll(
          "[data-figma-pii]"
        )
      ) {
        const kind =
          element.getAttribute(
            "data-figma-pii"
          ) || "value";

        register(
          element.textContent,
          `[redacted ${kind}]`
        );
      }

      const orderedReplacements = [
        ...replacements.entries(),
      ].sort(
        ([left], [right]) =>
          right.length - left.length
      );

      const redactText = (
        input
      ) => {
        let output = String(
          input || ""
        );

        for (
          const [
            original,
            replacement,
          ]
          of orderedReplacements
        ) {
          if (
            output.includes(
              original
            )
          ) {
            output = output
              .split(original)
              .join(replacement);
          }
        }

        output = output.replace(
          emailPattern,
          "contact-redacted@example.invalid"
        );

        output = output.replace(
          ukMobilePattern,
          "[redacted phone]"
        );

        return output;
      };

      const walker =
        document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT
        );

      const textNodes = [];
      let node;

      while (
        (node =
          walker.nextNode())
      ) {
        const parentName =
          node.parentElement
            ?.tagName
            ?.toLowerCase();

        if (
          parentName === "script" ||
          parentName === "style"
        ) {
          continue;
        }

        textNodes.push(node);
      }

      for (
        const textNode
        of textNodes
      ) {
        const before =
          textNode.nodeValue || "";
        const after =
          redactText(before);

        if (
          after !== before
        ) {
          textNode.nodeValue =
            after;
          redactionCount += 1;
        }
      }

      for (
        const element
        of document.querySelectorAll(
          "input, textarea"
        )
      ) {
        const before =
          element.value || "";
        const after =
          redactText(before);

        if (
          after !== before
        ) {
          element.value = after;
          redactionCount += 1;
        }
      }

      for (
        const element
        of document.querySelectorAll(
          "[aria-label], [title]"
        )
      ) {
        for (
          const attribute
          of [
            "aria-label",
            "title",
          ]
        ) {
          if (
            !element.hasAttribute(
              attribute
            )
          ) {
            continue;
          }

          const before =
            element.getAttribute(
              attribute
            ) || "";
          const after =
            redactText(before);

          if (
            after !== before
          ) {
            element.setAttribute(
              attribute,
              after
            );
            redactionCount += 1;
          }
        }
      }

      const visibleText =
        document.body
          ?.innerText || "";

      const formValues = [
        ...document.querySelectorAll(
          "input, textarea"
        ),
      ]
        .map(
          (element) =>
            element.value || ""
        )
        .join("\n");

      const hrefValues = [
        ...document.querySelectorAll(
          "a[href]"
        ),
      ]
        .map(
          (element) =>
            element.getAttribute(
              "href"
            ) || ""
        )
        .join("\n");

      const searchable = [
        visibleText,
        formValues,
        hrefValues,
      ].join("\n");

      const remainingOriginals = [
        ...originals,
      ].filter(
        (value) =>
          searchable.includes(
            value
          )
      );

      const remainingEmails = (
        visibleText.match(
          emailPattern
        ) || []
      ).filter(
        (value) =>
          !value.endsWith(
            "@example.invalid"
          )
      );

      const remainingUkMobiles =
        visibleText.match(
          ukMobilePattern
        ) || [];

      return {
        enabled: true,
        route: currentRoute,
        discoveredSensitiveValues:
          originals.size,
        replacements:
          redactionCount,
        profileLinksRedacted,
        remainingSensitiveValues:
          remainingOriginals.length,
        remainingEmails:
          remainingEmails.length,
        remainingUkMobiles:
          remainingUkMobiles.length,
      };
    },
    {
      currentRoute:
        routePath ||
        new URL(
          page.url()
        ).pathname,
      customerSummaryRoute:
        CUSTOMER_SUMMARY_ROUTE,
    }
  );
}

export {
  CUSTOMER_SUMMARY_ROUTE,
};
