import "dotenv/config";
import mongoose from "mongoose";

import CommunicationTemplate from "../src/models/CommunicationTemplate.js";
import CustomerTag from "../src/features/customerProfiles/CustomerTag.js";

const templates = [
  {
    name: "Dormant customer welcome back",
    description:
      "Re-engage customers who have not booked recently.",
    campaignType: "dormant_customer",
    channel: "email",
    subject:
      "We miss you, {{customer.firstName}}",
    body:
      "Hi {{customer.firstName}}, we would love to welcome you back to {{salon.name}}. Reply to arrange your next appointment.",
    variables: [
      "customer.firstName",
      "salon.name",
    ],
    active: true,
  },
  {
    name: "Appointment reminder SMS",
    description:
      "Standard 24-hour appointment reminder.",
    campaignType: "appointment_reminder",
    channel: "sms",
    subject: "",
    body:
      "Hi {{customer.firstName}}, your appointment is on {{appointment.date}} at {{appointment.time}} with {{appointment.stylist}}. Contact {{salon.phone}} if you need to make a change.",
    variables: [
      "customer.firstName",
      "appointment.date",
      "appointment.time",
      "appointment.stylist",
      "salon.phone",
    ],
    active: true,
  },
  {
    name: "Post-appointment follow-up",
    description:
      "Ask the customer about their recent visit.",
    campaignType: "follow_up",
    channel: "whatsapp",
    subject: "",
    body:
      "Hi {{customer.firstName}}, thank you for visiting {{salon.name}}. We hope you loved your service. Reply if there is anything we can help with.",
    variables: [
      "customer.firstName",
      "salon.name",
    ],
    active: true,
  },
  {
    name: "Birthday greeting",
    description:
      "Birthday greeting and booking invitation.",
    campaignType: "birthday",
    channel: "email",
    subject:
      "Happy birthday, {{customer.firstName}}",
    body:
      "Happy birthday {{customer.firstName}} from everyone at {{salon.name}}. We would love to celebrate with you at your next appointment.",
    variables: [
      "customer.firstName",
      "salon.name",
    ],
    active: true,
  },
];

const tags = [
  {
    name: "vip",
    label: "VIP",
    description: "High-value customer",
  },
  {
    name: "new_customer",
    label: "New Customer",
    description: "Recently registered customer",
  },
  {
    name: "dormant",
    label: "Dormant",
    description: "Customer has not booked recently",
  },
  {
    name: "follow_up_required",
    label: "Follow-up Required",
    description:
      "Customer requires staff follow-up",
  },
  {
    name: "colour_client",
    label: "Colour Client",
    description:
      "Customer receives colour services",
  },
];

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error(
      "MONGO_URI is required in backend/.env."
    );
  }

  await mongoose.connect(process.env.MONGO_URI);

  for (const template of templates) {
    await CommunicationTemplate.findOneAndUpdate(
      {
        name: template.name,
      },
      {
        $set: template,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  }

  for (const tag of tags) {
    await CustomerTag.findOneAndUpdate(
      {
        name: tag.name,
      },
      {
        $set: {
          ...tag,
          active: true,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  }

  console.log(
    `Seeded ${templates.length} templates and ${tags.length} tags.`
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
