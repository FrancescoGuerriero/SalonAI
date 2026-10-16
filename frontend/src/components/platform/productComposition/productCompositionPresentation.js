const CAPABILITY_REASON_COPY = Object.freeze({
  "tenant-manifest": "Selected explicitly for this tenant",
  "vertical-default": "Included by the selected vertical",
  "platform-safety-lock": "Disabled by a platform safety control",
  "not-entitled": "Not available under the current entitlement",
  "feature-flag-disabled": "Temporarily unavailable under rollout control",
  "not-selected": "Not selected in this tenant composition",
});

const APPROVAL_REASON_COPY = Object.freeze({
  "initial-tenant-product-activation": "Initial tenant product activation",
  "tenant-product-change": "Tenant product composition changed",
  "platform-version-upgrade-review": "Platform version upgrade review",
  "deployment-infrastructure-review": "Deployment infrastructure review",
  "experimental-capability": "Experimental capability approval",
});

export function capabilityReasonLabel(reason = "") {
  if (CAPABILITY_REASON_COPY[reason]) {
    return CAPABILITY_REASON_COPY[reason];
  }

  if (String(reason).startsWith("dependency-unavailable:")) {
    const dependency = String(reason).split(":")[1] || "required capability";
    return "Required capability unavailable: " + dependency;
  }

  return String(reason || "Unknown capability state");
}

export function approvalReasonLabel(reason = "") {
  return APPROVAL_REASON_COPY[reason] || String(reason || "Approval required");
}

export function compactFingerprint(value = "") {
  const fingerprint = String(value || "").trim();

  if (fingerprint.length <= 16) {
    return fingerprint;
  }

  return fingerprint.slice(0, 8) + "…" + fingerprint.slice(-8);
}
