import mongoose from "mongoose";

import RevenueForecastSnapshot from "./RevenueForecastSnapshot.js";

import {
  generateRevenueForecast,
} from "./revenueForecastService.js";

function readQueryValue(request, key) {
  const value = request.query?.[key];

  return Array.isArray(value)
    ? value[0]
    : value;
}

function clampInteger(
  value,
  minimum,
  maximum,
  fallback
) {
  const parsedValue =
    Number.parseInt(value, 10);

  if (
    !Number.isFinite(parsedValue)
  ) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      parsedValue
    )
  );
}

function normaliseText(value) {
  return String(
    value || ""
  ).trim();
}

function getAuthenticatedUserId(request) {
  return (
    request.user?._id ||
    request.user?.id ||
    null
  );
}

function isValidSnapshotId(
  snapshotId
) {
  return mongoose.isValidObjectId(
    snapshotId
  );
}

async function getRevenueForecast(
  request,
  response
) {
  const forecast =
    await generateRevenueForecast({
      months:
        readQueryValue(
          request,
          "months"
        ),

      forecastMonths:
        readQueryValue(
          request,
          "forecastMonths"
        ),
    });

  return response.status(200).json({
    success: true,
    forecast,
  });
}

async function createRevenueForecastSnapshot(
  request,
  response
) {
  const body =
    request.body || {};

  const forecast =
    await generateRevenueForecast({
      months:
        body.months,

      forecastMonths:
        body.forecastMonths,
    });

  const generatedAt =
    new Date(
      forecast.generatedAt ||
        Date.now()
    );

  const defaultName =
    `Revenue forecast - ${new Intl.DateTimeFormat(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    ).format(generatedAt)}`;

  const snapshot =
    await RevenueForecastSnapshot.create({
      name:
        normaliseText(
          body.name
        ) ||
        defaultName,

      description:
        normaliseText(
          body.description
        ),

      generatedAt,

      createdBy:
        getAuthenticatedUserId(
          request
        ),

      currency:
        forecast.currency ||
        "GBP",

      timezone:
        forecast.timezone ||
        "Europe/London",

      parameters:
        forecast.parameters ||
        {},

      summary:
        forecast.summary ||
        {},

      methodology:
        forecast.methodology ||
        {},

      insights:
        forecast.insights ||
        {},

      historicalRevenue:
        forecast.historicalRevenue ||
        [],

      bookedRevenue:
        forecast.bookedRevenue ||
        [],

      forecastRevenue:
        forecast.forecastRevenue ||
        [],
    });

  return response.status(201).json({
    success: true,

    message:
      "Revenue forecast snapshot saved successfully.",

    snapshot,
  });
}

async function listRevenueForecastSnapshots(
  request,
  response
) {
  const page =
    clampInteger(
      readQueryValue(
        request,
        "page"
      ),
      1,
      100000,
      1
    );

  const limit =
    clampInteger(
      readQueryValue(
        request,
        "limit"
      ),
      1,
      100,
      20
    );

  const skip =
    (page - 1) *
    limit;

  const [
    snapshots,
    total,
  ] =
    await Promise.all([
      RevenueForecastSnapshot.find()
        .select(
          [
            "name",
            "description",
            "generatedAt",
            "createdBy",
            "currency",
            "timezone",
            "parameters",
            "summary",
            "methodology",
            "insights",
            "createdAt",
            "updatedAt",
          ].join(" ")
        )
        .populate(
          "createdBy",
          "name email role"
        )
        .sort({
          generatedAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      RevenueForecastSnapshot.countDocuments(),
    ]);

  return response.status(200).json({
    success: true,
    snapshots,

    pagination: {
      page,
      limit,
      total,

      pages:
        Math.ceil(
          total / limit
        ),
    },
  });
}

async function getRevenueForecastSnapshot(
  request,
  response
) {
  const {
    snapshotId,
  } = request.params;

  if (
    !isValidSnapshotId(
      snapshotId
    )
  ) {
    return response.status(400).json({
      success: false,
      message:
        "The forecast snapshot ID is invalid.",
    });
  }

  const snapshot =
    await RevenueForecastSnapshot.findById(
      snapshotId
    )
      .populate(
        "createdBy",
        "name email role"
      )
      .lean();

  if (!snapshot) {
    return response.status(404).json({
      success: false,
      message:
        "Revenue forecast snapshot not found.",
    });
  }

  return response.status(200).json({
    success: true,
    snapshot,
  });
}

async function deleteRevenueForecastSnapshot(
  request,
  response
) {
  const {
    snapshotId,
  } = request.params;

  if (
    !isValidSnapshotId(
      snapshotId
    )
  ) {
    return response.status(400).json({
      success: false,
      message:
        "The forecast snapshot ID is invalid.",
    });
  }

  const snapshot =
    await RevenueForecastSnapshot.findByIdAndDelete(
      snapshotId
    );

  if (!snapshot) {
    return response.status(404).json({
      success: false,
      message:
        "Revenue forecast snapshot not found.",
    });
  }

  return response.status(200).json({
    success: true,

    message:
      "Revenue forecast snapshot deleted successfully.",

    deletedSnapshotId:
      snapshot._id,
  });
}

export {
  createRevenueForecastSnapshot,
  deleteRevenueForecastSnapshot,
  getRevenueForecast,
  getRevenueForecastSnapshot,
  listRevenueForecastSnapshots,
};
