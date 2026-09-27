function serviceConfigurationError(
  message,
  code = "INVALID_EFFECTIVE_SERVICE_CONFIGURATION",
  statusCode = 400
) {
  const error =
    new Error(
      message
    );
  error.code =
    code;
  error.statusCode =
    statusCode;
  return error;
}

function idText(value) {
  const candidate =
    value &&
    typeof value ===
      "object" &&
    "_id" in value
      ? value._id
      : value;

  return String(
    candidate || ""
  ).trim();
}

function hasOwn(
  value,
  key
) {
  return Boolean(
    value &&
    Object.prototype
      .hasOwnProperty.call(
        value,
        key
      )
  );
}

function booleanValue(
  value,
  fallback
) {
  return typeof value ===
    "boolean"
    ? value
    : fallback;
}

function basePublished(
  service
) {
  return booleanValue(
    service?.published,
    service?.active ===
      true
  );
}

function baseBookable(
  service
) {
  return booleanValue(
    service?.bookable,
    service?.onlineBookable !==
      false
  );
}

function requireOwnedService({
  service,
  businessId,
} = {}) {
  const serviceId =
    idText(
      service?._id
    );
  const serviceBusinessId =
    idText(
      service?.business
    );
  const trustedBusinessId =
    idText(
      businessId
    );

  if (!serviceId) {
    throw serviceConfigurationError(
      "A Service id is required.",
      "SERVICE_ID_REQUIRED"
    );
  }

  if (
    !serviceBusinessId
  ) {
    throw serviceConfigurationError(
      "The Service does not yet have trusted Business ownership.",
      "SERVICE_BUSINESS_OWNERSHIP_REQUIRED",
      409
    );
  }

  if (
    !trustedBusinessId ||
    serviceBusinessId !==
      trustedBusinessId
  ) {
    throw serviceConfigurationError(
      "The requested service was not found.",
      "SERVICE_NOT_FOUND",
      404
    );
  }

  return {
    serviceId,
    businessId:
      serviceBusinessId,
  };
}

function validateOfferingOwnership({
  offering,
  serviceId,
  businessId,
  locationId,
} = {}) {
  if (!offering) {
    return null;
  }

  const offeringBusinessId =
    idText(
      offering.business
    );
  const offeringLocationId =
    idText(
      offering.location
    );
  const offeringServiceId =
    idText(
      offering.service
    );
  const trustedLocationId =
    idText(
      locationId
    );

  if (
    !offeringBusinessId ||
    offeringBusinessId !==
      businessId ||
    !offeringServiceId ||
    offeringServiceId !==
      serviceId ||
    !offeringLocationId ||
    !trustedLocationId ||
    offeringLocationId !==
      trustedLocationId
  ) {
    throw serviceConfigurationError(
      "The requested service offering was not found.",
      "SERVICE_OFFERING_NOT_FOUND",
      404
    );
  }

  return {
    businessId:
      offeringBusinessId,
    locationId:
      offeringLocationId,
    serviceId:
      offeringServiceId,
  };
}

function chooseOverride({
  offering,
  overrideKey,
  baseValue,
} = {}) {
  if (
    offering &&
    hasOwn(
      offering,
      overrideKey
    ) &&
    offering[
      overrideKey
    ] !== undefined &&
    offering[
      overrideKey
    ] !== null
  ) {
    return {
      value:
        offering[
          overrideKey
        ],
      source:
        "location-offering",
    };
  }

  return {
    value:
      baseValue,
    source:
      "base-service",
  };
}

export function resolveEffectiveServiceConfiguration({
  service,
  offering = null,
  businessId,
  locationId = null,
  capabilityAvailable = true,
  allowLocationPublicationEnable =
    false,
} = {}) {
  const ownership =
    requireOwnedService({
      service,
      businessId,
    });

  const offeringOwnership =
    offering
      ? validateOfferingOwnership({
          offering,
          serviceId:
            ownership.serviceId,
          businessId:
            ownership.businessId,
          locationId,
        })
      : null;

  const baseActive =
    service?.active ===
    true;
  const basePublishedValue =
    basePublished(
      service
    );
  const baseBookableValue =
    baseBookable(
      service
    );

  const offeringOperational =
    !offering ||
    (
      String(
        offering.status ||
          "active"
      ) ===
        "active" &&
      offering.available !==
        false
    );

  const price =
    chooseOverride({
      offering,
      overrideKey:
        "priceOverride",
      baseValue:
        service?.price,
    });

  const priceLabel =
    chooseOverride({
      offering,
      overrideKey:
        "priceLabelOverride",
      baseValue:
        service?.priceLabel ||
        "",
    });

  const priceOnConsultation =
    chooseOverride({
      offering,
      overrideKey:
        "priceOnConsultationOverride",
      baseValue:
        service?.priceOnConsultation ===
        true,
    });

  const duration =
    chooseOverride({
      offering,
      overrideKey:
        "durationOverride",
      baseValue:
        service?.duration,
    });

  const durationEstimated =
    chooseOverride({
      offering,
      overrideKey:
        "durationEstimatedOverride",
      baseValue:
        service?.durationEstimated ===
        true,
    });

  const requestedBookable =
    chooseOverride({
      offering,
      overrideKey:
        "bookableOverride",
      baseValue:
        baseBookableValue,
    });

  const publication =
    chooseOverride({
      offering,
      overrideKey:
        "publicationOverride",
      baseValue:
        basePublishedValue,
    });

  const publicationCanEnable =
    allowLocationPublicationEnable ===
      true ||
    basePublishedValue ===
      true ||
    publication.value !==
      true;

  const capabilityEnabled =
    capabilityAvailable ===
    true;

  const available =
    Boolean(
      baseActive &&
      offeringOperational &&
      capabilityEnabled
    );

  const published =
    Boolean(
      available &&
      publicationCanEnable &&
      publication.value ===
        true
    );

  const bookable =
    Boolean(
      available &&
      requestedBookable.value ===
        true
    );

  const stateSource =
    !capabilityEnabled
      ? "platform-capability"
      : !baseActive
        ? "base-service"
        : !offeringOperational
          ? "location-offering"
          : offering
            ? "location-offering"
            : "base-service";

  return Object.freeze({
    serviceId:
      ownership.serviceId,
    businessId:
      ownership.businessId,
    locationId:
      offeringOwnership
        ?.locationId ||
      idText(
        locationId
      ) ||
      null,
    capabilityAvailable:
      capabilityEnabled,
    available,
    published,
    bookable,
    price:
      price.value,
    priceLabel:
      priceLabel.value,
    priceOnConsultation:
      Boolean(
        priceOnConsultation.value
      ),
    duration:
      duration.value,
    durationEstimated:
      Boolean(
        durationEstimated.value
      ),
    provenance:
      Object.freeze({
        available:
          stateSource,
        published:
          !capabilityEnabled
            ? "platform-capability"
            : !available
              ? stateSource
              : publication.source,
        bookable:
          !capabilityEnabled
            ? "platform-capability"
            : !available
              ? stateSource
              : requestedBookable.source,
        price:
          price.source,
        priceLabel:
          priceLabel.source,
        priceOnConsultation:
          priceOnConsultation.source,
        duration:
          duration.source,
        durationEstimated:
          durationEstimated.source,
      }),
  });
}

export default {
  resolveEffectiveServiceConfiguration,
};
