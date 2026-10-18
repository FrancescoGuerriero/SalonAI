import Appointment from "../../models/Appointment.js";
import Business from "../../models/Business.js";
import Customer from "../../models/customer.js";
import Location from "../../models/Location.js";
import Service from "../../models/service.js";
import Stylist from "../../models/Stylist.js";

import {
  buildCustomerAppointmentOwnershipReadiness,
} from "./customerAppointmentOwnershipMigration.js";

function querySession(
  query,
  session
) {
  return session
    ? query.session(
        session
      )
    : query;
}

export async function resolveCanonicalCustomerAppointmentOwnership({
  configuration,
  session = null,
} = {}) {
  if (
    !configuration?.business?.slug ||
    !configuration?.location?.slug
  ) {
    throw new Error(
      "Canonical Customer/Appointment tenant configuration is required."
    );
  }

  const business =
    await querySession(
      Business.findOne({
        slug:
          configuration.business.slug,
      })
        .select(
          "_id slug businessType status"
        ),
      session
    ).lean();

  if (!business) {
    throw new Error(
      "Canonical Business is missing. Complete the canonical tenant bootstrap before Customer/Appointment ownership work."
    );
  }

  const location =
    await querySession(
      Location.findOne({
        business:
          business._id,
        slug:
          configuration.location.slug,
        status:
          "active",
      })
        .select(
          "_id business slug status"
        ),
      session
    ).lean();

  if (!location) {
    throw new Error(
      "Canonical active primary Location is missing. Complete the canonical tenant bootstrap before Customer/Appointment ownership work."
    );
  }

  return Object.freeze({
    business,
    location,
  });
}

export async function loadCustomerAppointmentOwnershipSnapshot({
  configuration,
  session = null,
  includeIndexes = false,
} = {}) {
  const {
    business,
    location,
  } =
    await resolveCanonicalCustomerAppointmentOwnership({
      configuration,
      session,
    });

  const [
    businesses,
    locations,
    customers,
    appointments,
    services,
    stylists,
  ] =
    await Promise.all([
      querySession(
        Business.find({})
          .sort({
            _id: 1,
          })
          .select(
            "_id"
          ),
        session
      ).lean(),
      querySession(
        Location.find({})
          .sort({
            _id: 1,
          })
          .select(
            "_id business status"
          ),
        session
      ).lean(),
      querySession(
        Customer.find({})
          .sort({
            _id: 1,
          })
          .select(
            "_id business"
          ),
        session
      ).lean(),
      querySession(
        Appointment.find({})
          .sort({
            _id: 1,
          })
          .select(
            "_id business location customer service stylist"
          ),
        session
      ).lean(),
      querySession(
        Service.find({})
          .sort({
            _id: 1,
          })
          .select(
            "_id business"
          ),
        session
      ).lean(),
      querySession(
        Stylist.find({})
          .sort({
            _id: 1,
          })
          .select(
            "_id business workingLocations"
          ),
        session
      ).lean(),
    ]);

  const readiness =
    buildCustomerAppointmentOwnershipReadiness({
      customers,
      appointments,
      services,
      stylists,
      businesses,
      locations,
      businessId:
        business._id,
      locationId:
        location._id,
    });

  let customerIndexes = [];
  let appointmentIndexes = [];

  if (
    includeIndexes &&
    !session
  ) {
    [
      customerIndexes,
      appointmentIndexes,
    ] =
      await Promise.all([
        Customer.collection
          .indexes()
          .catch(
            () => []
          ),
        Appointment.collection
          .indexes()
          .catch(
            () => []
          ),
      ]);
  }

  return Object.freeze({
    business,
    location,
    businesses:
      Object.freeze([
        ...businesses,
      ]),
    locations:
      Object.freeze([
        ...locations,
      ]),
    customers:
      Object.freeze([
        ...customers,
      ]),
    appointments:
      Object.freeze([
        ...appointments,
      ]),
    services:
      Object.freeze([
        ...services,
      ]),
    stylists:
      Object.freeze([
        ...stylists,
      ]),
    readiness,
    coverage:
      Object.freeze({
        customers:
          Object.freeze({
            total:
              customers.length,
            businessScoped:
              customers.filter(
                (customer) =>
                  Boolean(
                    customer.business
                  )
              ).length,
          }),
        appointments:
          Object.freeze({
            total:
              appointments.length,
            businessScoped:
              appointments.filter(
                (appointment) =>
                  Boolean(
                    appointment.business
                  )
              ).length,
            locationScoped:
              appointments.filter(
                (appointment) =>
                  Boolean(
                    appointment.location
                  )
              ).length,
          }),
      }),
    indexes:
      Object.freeze({
        customers:
          Object.freeze([
            ...customerIndexes,
          ]),
        appointments:
          Object.freeze([
            ...appointmentIndexes,
          ]),
      }),
  });
}

export default {
  resolveCanonicalCustomerAppointmentOwnership,
  loadCustomerAppointmentOwnershipSnapshot,
};
