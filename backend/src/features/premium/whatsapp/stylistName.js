function compactName(value) {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);
}


function joinedName(
  firstName,
  lastName
) {
  return [
    compactName(firstName),
    compactName(lastName),
  ]
    .filter(Boolean)
    .join(" ");
}


function plainStylist(
  stylist
) {
  if (
    !stylist ||
    typeof stylist !== "object"
  ) {
    return {};
  }

  if (
    typeof stylist.toObject ===
      "function"
  ) {
    try {
      return stylist.toObject({
        virtuals: false,
        getters: false,
      });
    } catch {
      // Fall through to the raw
      // Mongoose document data.
    }
  }

  if (
    stylist._doc &&
    typeof stylist._doc ===
      "object"
  ) {
    return stylist._doc;
  }

  return stylist;
}


export function resolveStylistName(
  stylist
) {
  const plain =
    plainStylist(stylist);

  const candidates = [
    plain?.name,
    plain?.fullName,
    joinedName(
      plain?.firstName,
      plain?.lastName
    ),
    stylist?.name,
    joinedName(
      stylist?.firstName,
      stylist?.lastName
    ),
  ];

  for (
    const candidate of candidates
  ) {
    const name =
      compactName(candidate);

    if (name) {
      return name;
    }
  }

  return "Salon professional";
}


export default resolveStylistName;
