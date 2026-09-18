import Appointment from "../../models/Appointment.js";
import CommunicationCampaign from "../../models/CommunicationCampaign.js";
import Customer from "../../models/customer.js";
import Service from "../../models/service.js";
import Product from "../commerce/Product.js";
import {
  hasUserPermission,
} from "../../middleware/permissionMiddleware.js";

function path(value) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function can(
  user,
  permission
) {
  return hasUserPermission(
    user,
    permission
  );
}

async function appointmentContext(
  user
) {
  if (
    !can(
      user,
      "appointment:read"
    )
  ) {
    return null;
  }

  const now =
    new Date();
  const inSevenDays =
    new Date(
      now.getTime() +
        7 *
          24 *
          60 *
          60 *
          1000
    );

  const [
    upcomingSevenDays,
    activeNow,
  ] = await Promise.all([
    Appointment.countDocuments({
      startsAt: {
        $gte: now,
        $lt:
          inSevenDays,
      },
      status: {
        $in: [
          "pending",
          "confirmed",
          "checked_in",
          "in_progress",
        ],
      },
    }),
    Appointment.countDocuments({
      status: {
        $in: [
          "checked_in",
          "in_progress",
        ],
      },
    }),
  ]);

  return {
    domain:
      "appointments",
    permission:
      "appointment:read",
    metrics: {
      upcomingSevenDays,
      activeNow,
    },
  };
}

async function customerContext(
  user
) {
  if (
    !can(
      user,
      "customer:read"
    )
  ) {
    return null;
  }

  const now =
    new Date();

  const [
    totalCustomers,
    customersWithUpcomingAppointment,
    customersWithRecordedNoShows,
  ] = await Promise.all([
    Customer.countDocuments({
      status: {
        $ne: "deleted",
      },
    }),
    Customer.countDocuments({
      status: {
        $ne: "deleted",
      },
      nextAppointment: {
        $gte: now,
      },
    }),
    Customer.countDocuments({
      status: {
        $ne: "deleted",
      },
      noShowCount: {
        $gt: 0,
      },
    }),
  ]);

  return {
    domain:
      "customers",
    permission:
      "customer:read",
    metrics: {
      totalCustomers,
      customersWithUpcomingAppointment,
      customersWithRecordedNoShows,
    },
  };
}

async function catalogueContext(
  user,
  contextPath
) {
  const productAllowed =
    can(
      user,
      "product:read"
    ) ||
    can(
      user,
      "inventory:read"
    );

  const serviceAllowed =
    can(
      user,
      "service:read"
    );

  const result = [];

  if (
    productAllowed &&
    /(product|inventory|shop)/.test(
      contextPath
    )
  ) {
    const [
      activeProducts,
      outOfStock,
      lowStock,
    ] = await Promise.all([
      Product.countDocuments({
        active: true,
      }),
      Product.countDocuments({
        active: true,
        stockQuantity: 0,
      }),
      Product.countDocuments({
        active: true,
        $expr: {
          $lte: [
            "$stockQuantity",
            "$reorderLevel",
          ],
        },
      }),
    ]);

    result.push({
      domain:
        "products_inventory",
      permission:
        can(
          user,
          "inventory:read"
        )
          ? "inventory:read"
          : "product:read",
      metrics: {
        activeProducts,
        outOfStock,
        lowStock,
      },
    });
  }

  if (
    serviceAllowed &&
    /service/.test(
      contextPath
    )
  ) {
    const [
      activeServices,
      onlineBookableServices,
    ] = await Promise.all([
      Service.countDocuments({
        active: true,
      }),
      Service.countDocuments({
        active: true,
        onlineBookable:
          true,
      }),
    ]);

    result.push({
      domain:
        "services",
      permission:
        "service:read",
      metrics: {
        activeServices,
        onlineBookableServices,
      },
    });
  }

  return result;
}

async function communicationContext(
  user
) {
  if (
    !can(
      user,
      "communications:read"
    )
  ) {
    return null;
  }

  const [
    drafts,
    scheduled,
    processing,
    failed,
  ] = await Promise.all([
    CommunicationCampaign.countDocuments({
      status: "draft",
    }),
    CommunicationCampaign.countDocuments({
      status:
        "scheduled",
    }),
    CommunicationCampaign.countDocuments({
      status: {
        $in: [
          "queued",
          "processing",
        ],
      },
    }),
    CommunicationCampaign.countDocuments({
      status: {
        $in: [
          "failed",
          "partially_completed",
        ],
      },
    }),
  ]);

  return {
    domain:
      "communications",
    permission:
      "communications:read",
    metrics: {
      drafts,
      scheduled,
      processing,
      failed,
    },
  };
}

export async function buildAdviserDomainContext({
  contextPath = "",
  user,
} = {}) {
  const currentPath =
    path(contextPath);
  const sections = [];

  if (
    /(appointment|calendar|booking)/.test(
      currentPath
    )
  ) {
    const value =
      await appointmentContext(
        user
      );

    if (value) {
      sections.push(
        value
      );
    }
  }

  if (
    /(customer|crm)/.test(
      currentPath
    )
  ) {
    const value =
      await customerContext(
        user
      );

    if (value) {
      sections.push(
        value
      );
    }
  }

  sections.push(
    ...(await catalogueContext(
      user,
      currentPath
    ))
  );

  if (
    /(communication|campaign|marketing)/.test(
      currentPath
    )
  ) {
    const value =
      await communicationContext(
        user
      );

    if (value) {
      sections.push(
        value
      );
    }
  }

  return {
    contextPath:
      currentPath,
    sections,
  };
}

export default {
  buildAdviserDomainContext,
};
