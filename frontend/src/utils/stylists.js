function normaliseText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function getStylistName(stylist) {
  const explicitName = normaliseText(
    stylist?.name || stylist?.fullName
  );

  if (explicitName) {
    return explicitName;
  }

  return (
    [stylist?.firstName, stylist?.lastName]
      .map(normaliseText)
      .filter(Boolean)
      .join(" ") || "Salon professional"
  );
}

export function getStylistSpecialties(stylist) {
  const values =
    stylist?.specialties ||
    stylist?.speciality ||
    stylist?.specialty ||
    [];

  if (Array.isArray(values)) {
    return values.map(normaliseText).filter(Boolean);
  }

  return String(values)
    .split(",")
    .map(normaliseText)
    .filter(Boolean);
}

export function getStylistSpecialtyLabel(stylist) {
  return getStylistSpecialties(stylist).join(" · ") || "Hair stylist";
}

export function getStylistBiography(stylist) {
  return (
    normaliseText(stylist?.biography || stylist?.bio) ||
    "Focused on personalised consultations and polished, wearable results."
  );
}

export function getStylistImage(stylist) {
  return normaliseText(
    stylist?.profileImage || stylist?.image || stylist?.avatar
  );
}

export function isStylistActive(stylist) {
  return stylist?.isActive !== false && stylist?.active !== false;
}

export function stylistOffersService(stylist, serviceId) {
  if (!serviceId) {
    return true;
  }

  if (!Array.isArray(stylist?.services) || stylist.services.length === 0) {
    return true;
  }

  const requestedId = String(serviceId);

  return stylist.services.some((service) => {
    const offeredId = service?._id || service;

    return String(offeredId) === requestedId;
  });
}

export function getStylistSearchText(stylist) {
  return [
    getStylistName(stylist),
    ...getStylistSpecialties(stylist),
    getStylistBiography(stylist),
  ]
    .join(" ")
    .toLowerCase();
}
