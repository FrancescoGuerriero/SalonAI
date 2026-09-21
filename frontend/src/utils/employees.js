const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function employeeScheduleForDate(
  employee,
  date = new Date()
) {
  const workingHours =
    employee?.stylistProfile?.workingHours ||
    employee?.workingHours ||
    [];

  const day =
    DAY_NAMES[
      date.getDay()
    ];

  const schedule =
    workingHours.find(
      (item) =>
        item?.day ===
        day
    );

  if (
    !schedule ||
    schedule.available ===
      false
  ) {
    return "Off";
  }

  if (
    !schedule.start ||
    !schedule.end
  ) {
    return "Hours not set";
  }

  return `${schedule.start}–${schedule.end}`;
}

export function employeeServiceNames(
  employee
) {
  const services =
    employee?.stylistProfile?.services ||
    employee?.services ||
    [];

  return services
    .map((service) =>
      typeof service ===
      "string"
        ? service
        : service?.name
    )
    .filter(Boolean);
}



export function employeeDisplayPhoto(
  employee
) {
  return (
    employee?.profilePhoto ||
    employee?.stylistProfile
      ?.profileImage ||
    ""
  );
}

export function employeeManagementPath(
  employee
) {
  if (
    employee?.signInEnabled ===
      false
  ) {
    const profileId =
      employee?.stylistProfile
        ?.id ||
      employee?.profileId;

    return profileId
      ? `/admin/employees/record/${profileId}`
      : "/admin/employees";
  }

  return employee?.id
    ? `/admin/employees/${employee.id}`
    : "/admin/employees";
}
