import Appointment from "../../models/Appointment.js";
import { generateManagementCopilotBrief } from "../../services/aiMicroserviceClient.js";
import {
  buildAiTenantFilter,
} from "../aiPlatform/aiTenantScope.js";

const state = (value) =>
  String(
    value.status ||
      value.appointmentStatus ||
      ""
  )
    .trim()
    .toLowerCase();

const money = (value) =>
  Math.max(
    0,
    Number(
      value.totalPrice ??
        value.total ??
        value.amount ??
        value.price ??
        value.service?.price ??
        0
    ) || 0
  );

export async function buildManagementCopilotPayload(
  options = {}
) {
  const {
    scope,
    filter: tenantFilter,
  } = buildAiTenantFilter(
    options
  );
  const days =
    Math.max(
      1,
      Number(
        options.periodDays
      ) || 30
    );
  const end =
    new Date(
      options.asOfDate ||
        new Date()
    );
  end.setHours(
    23,
    59,
    59,
    999
  );

  const currentStart =
    new Date(end);
  currentStart.setDate(
    currentStart.getDate() -
      days +
      1
  );
  currentStart.setHours(
    0,
    0,
    0,
    0
  );

  const previousEnd =
    new Date(
      currentStart
    );
  previousEnd.setMilliseconds(
    -1
  );
  const previousStart =
    new Date(
      previousEnd
    );
  previousStart.setDate(
    previousStart.getDate() -
      days +
      1
  );
  previousStart.setHours(
    0,
    0,
    0,
    0
  );

  const rows =
    await Appointment.find({
      ...tenantFilter,
      createdAt: {
        $gte:
          previousStart,
        $lte: end,
      },
    })
      .select(
        "status appointmentStatus totalPrice total amount price service appointmentDate date scheduledAt createdAt"
      )
      .lean()
      .exec();

  const summarise = (
    start,
    finish
  ) => {
    const selected =
      rows.filter(
        (item) => {
          const date =
            new Date(
              item.appointmentDate ||
                item.date ||
                item.scheduledAt ||
                item.createdAt
            );

          return (
            date >= start &&
            date <= finish
          );
        }
      );
    const completed =
      selected.filter(
        (item) =>
          state(item) ===
          "completed"
      );
    const noShows =
      selected.filter(
        (item) =>
          [
            "no-show",
            "no_show",
            "noshow",
          ].includes(
            state(item)
          )
      );
    const cancelled =
      selected.filter(
        (item) =>
          [
            "cancelled",
            "canceled",
          ].includes(
            state(item)
          )
      );

    return {
      bookings:
        selected.length,
      completed:
        completed.length,
      noShows:
        noShows.length,
      cancelled:
        cancelled.length,
      revenue:
        completed.reduce(
          (total, item) =>
            total +
            money(item),
          0
        ),
    };
  };

  const current =
    summarise(
      currentStart,
      end
    );
  const previous =
    summarise(
      previousStart,
      previousEnd
    );
  const noShowRate =
    current.bookings
      ? current.noShows /
        current.bookings *
        100
      : 0;
  const cancelRate =
    current.bookings
      ? current.cancelled /
        current.bookings *
        100
      : 0;
  const issues = [];

  if (noShowRate >= 8) {
    issues.push({
      key:
        "no-show-rate",
      title:
        "No-show rate above target",
      description:
        `The no-show rate is ${noShowRate.toFixed(1)}%.`,
      priority:
        noShowRate >= 15
          ? "critical"
          : "high",
      area:
        "appointments",
      impact_value:
        current.noShows *
        (
          current.completed
            ? current.revenue /
              current.completed
            : 0
        ),
    });
  }

  if (cancelRate >= 15) {
    issues.push({
      key:
        "cancellation-rate",
      title:
        "Cancellation rate requires attention",
      description:
        `The cancellation rate is ${cancelRate.toFixed(1)}%.`,
      priority:
        "high",
      area:
        "appointments",
    });
  }

  return {
    as_of_date:
      end
        .toISOString()
        .slice(
          0,
          10
        ),
    period_label:
      `Last ${days} days`,
    metrics: [
      {
        key: "bookings",
        label: "Bookings",
        value:
          current.bookings,
        previous_value:
          previous.bookings,
        area:
          "appointments",
      },
      {
        key: "completed",
        label:
          "Completed appointments",
        value:
          current.completed,
        previous_value:
          previous.completed,
        area:
          "appointments",
      },
      {
        key: "revenue",
        label:
          "Completed revenue",
        value:
          current.revenue,
        previous_value:
          previous.revenue,
        unit: "GBP",
        area: "revenue",
      },
      {
        key:
          "no-show-rate",
        label:
          "No-show rate",
        value:
          noShowRate,
        previous_value:
          previous.bookings
            ? previous.noShows /
              previous.bookings *
              100
            : 0,
        unit:
          "percent",
        area:
          "appointments",
      },
    ],
    issues,
    include_action_plan:
      options.includeActionPlan !==
      false,
    scope: {
      tenantScoped: true,
      businessId:
        scope.businessId,
      locationId:
        scope.locationId,
      locationAccessMode:
        scope.locationAccessMode,
      authorisedLocationCount:
        scope.locationAccessMode ===
        "all"
          ? null
          : scope
              .allowedLocationIds
              .length,
    },
  };
}

export async function generateManagementCopilot(
  options = {}
) {
  const payload =
    await buildManagementCopilotPayload(
      options
    );

  return {
    brief:
      await generateManagementCopilotBrief(
        payload,
        {
          requestId:
            options.requestId,
        }
      ),
    source: {
      asOfDate:
        payload.as_of_date,
      periodLabel:
        payload.period_label,
      metricCount:
        payload.metrics.length,
      issueCount:
        payload.issues.length,
      aggregateOnly: true,
      tenantScoped: true,
      scope:
        payload.scope,
    },
  };
}

export default {
  buildManagementCopilotPayload,
  generateManagementCopilot,
};
