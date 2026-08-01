import {
  getAvailableSegments,
  getCustomerSegmentOverview,
  getCustomersBySegment,
  getSegmentSettings,
} from "../services/customerSegmentationService.js";

function parseOptionalNumber(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : undefined;
}

function getSettingsFromQuery(query = {}) {
  return getSegmentSettings({
    newCustomerDays:
      parseOptionalNumber(
        query.newCustomerDays
      ),

    recentVisitDays:
      parseOptionalNumber(
        query.recentVisitDays
      ),

    dormantDays:
      parseOptionalNumber(
        query.dormantDays
      ),

    frequentVisitCount:
      parseOptionalNumber(
        query.frequentVisitCount
      ),

    highValueSpend:
      parseOptionalNumber(
        query.highValueSpend
      ),
  });
}

function normaliseSegment(value) {
  return String(value || "all")
    .trim()
    .toLowerCase();
}

export async function getSegmentOverview(
  request,
  response,
  next
) {
  try {
    const settings =
      getSettingsFromQuery(
        request.query
      );

    const overview =
      await getCustomerSegmentOverview(
        settings
      );

    return response.status(200).json({
      success: true,
      message:
        "Customer segment overview retrieved successfully.",
      segments:
        getAvailableSegments(),
      overview,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getSegmentCustomers(
  request,
  response,
  next
) {
  try {
    const segment = normaliseSegment(
      request.query.segment
    );

    const availableSegments =
      getAvailableSegments();

    if (
      !availableSegments.includes(
        segment
      )
    ) {
      return response.status(400).json({
        success: false,
        message: `Invalid customer segment: ${segment}.`,
        availableSegments,
      });
    }

    const settings =
      getSettingsFromQuery(
        request.query
      );

    const result =
      await getCustomersBySegment({
        segment,
        search:
          request.query.search || "",
        page:
          request.query.page || 1,
        limit:
          request.query.limit || 20,
        sortBy:
          request.query.sortBy ||
          "createdAt",
        sortDirection:
          request.query
            .sortDirection || "desc",
        settings,
      });

    return response.status(200).json({
      success: true,
      message:
        "Segmented customers retrieved successfully.",
      ...result,
      settings,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getSegmentDefinitions(
  request,
  response,
  next
) {
  try {
    const settings =
      getSettingsFromQuery(
        request.query
      );

    const definitions = [
      {
        key: "all",
        name: "All Customers",
        description:
          "All customer records except deleted customers.",
      },
      {
        key: "active",
        name: "Active Customers",
        description:
          "Customers whose account status is active.",
      },
      {
        key: "new",
        name: "New Customers",
        description: `Customers created within the last ${settings.newCustomerDays} days.`,
      },
      {
        key: "recent",
        name: "Recent Visitors",
        description: `Customers who visited within the last ${settings.recentVisitDays} days.`,
      },
      {
        key: "dormant",
        name: "Dormant Customers",
        description: `Customers whose most recent visit was more than ${settings.dormantDays} days ago.`,
      },
      {
        key: "never-visited",
        name: "Never Visited",
        description:
          "Active customers with no recorded visit or zero visits.",
      },
      {
        key: "frequent",
        name: "Frequent Visitors",
        description: `Customers with at least ${settings.frequentVisitCount} recorded visits.`,
      },
      {
        key: "high-value",
        name: "High-Value Customers",
        description: `Customers whose total spending is at least £${settings.highValueSpend}.`,
      },
      {
        key: "email-consent",
        name: "Email Marketing",
        description:
          "Active customers with an email address who consented to email marketing.",
      },
      {
        key: "sms-consent",
        name: "SMS Marketing",
        description:
          "Active customers with a phone number who consented to SMS marketing.",
      },
      {
        key: "archived",
        name: "Archived Customers",
        description:
          "Customers whose account status is archived.",
      },
    ];

    return response.status(200).json({
      success: true,
      message:
        "Customer segment definitions retrieved successfully.",
      definitions,
      settings,
    });
  } catch (error) {
    return next(error);
  }
}