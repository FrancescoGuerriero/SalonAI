import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import mongoose from "mongoose";

import connectDB from "../src/config/db.js";
import Service from "../src/models/service.js";
import Stylist from "../src/models/Stylist.js";
import { isEmailAddress } from "../src/shared/inputValidation.js";

function parseArguments(values) {
  const options = {
    file: "",
    dryRun: false,
    allowExampleData: false,
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (value === "--dry-run") {
      options.dryRun = true;
    } else if (value === "--allow-example-data") {
      options.allowExampleData = true;
    } else if (value === "--file") {
      options.file = values[index + 1] || "";
      index += 1;
    } else if (value.startsWith("--file=")) {
      options.file = value.slice("--file=".length);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  if (!options.file) {
    throw new Error(
      "Provide a catalogue file with --file <path>."
    );
  }

  return options;
}

function normaliseText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function requireText(value, field) {
  const text = normaliseText(value);

  if (!text) {
    throw new Error(`${field} is required.`);
  }

  return text;
}

function requirePositiveNumber(value, field) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${field} must be greater than zero.`);
  }

  return number;
}

function normaliseServices(services) {
  if (!Array.isArray(services) || services.length === 0) {
    throw new Error("The catalogue must contain at least one service.");
  }

  const names = new Set();

  return services.map((service, index) => {
    const name = requireText(service?.name, `services[${index}].name`);

    if (names.has(name.toLowerCase())) {
      throw new Error(`Duplicate service name: ${name}`);
    }

    names.add(name.toLowerCase());

    return {
      name,
      category: requireText(
        service?.category,
        `services[${index}].category`
      ),
      description: normaliseText(service?.description),
      price: requirePositiveNumber(
        service?.price,
        `services[${index}].price`
      ),
      duration: requirePositiveNumber(
        service?.duration,
        `services[${index}].duration`
      ),
      image: normaliseText(service?.image),
      active: service?.active !== false,
    };
  });
}

function normaliseStylists(stylists, serviceNames) {
  if (!Array.isArray(stylists) || stylists.length === 0) {
    throw new Error("The catalogue must contain at least one stylist.");
  }

  const emails = new Set();

  return stylists.map((stylist, index) => {
    const email = requireText(
      stylist?.email,
      `stylists[${index}].email`
    ).toLowerCase();

    if (!isEmailAddress(email)) {
      throw new Error(`stylists[${index}].email is invalid.`);
    }

    if (emails.has(email)) {
      throw new Error(`Duplicate stylist email: ${email}`);
    }

    emails.add(email);

    const offeredServices = Array.isArray(stylist?.services)
      ? stylist.services.map((name) => requireText(name, "stylist service"))
      : [];

    for (const serviceName of offeredServices) {
      if (!serviceNames.has(serviceName.toLowerCase())) {
        throw new Error(
          `Stylist ${email} references unknown service: ${serviceName}`
        );
      }
    }

    return {
      firstName: requireText(
        stylist?.firstName,
        `stylists[${index}].firstName`
      ),
      lastName: requireText(
        stylist?.lastName,
        `stylists[${index}].lastName`
      ),
      email,
      phone: normaliseText(stylist?.phone),
      biography: normaliseText(stylist?.biography),
      profileImage: normaliseText(stylist?.profileImage),
      yearsExperience: Math.max(
        0,
        Number(stylist?.yearsExperience) || 0
      ),
      specialties: Array.isArray(stylist?.specialties)
        ? stylist.specialties.map(normaliseText).filter(Boolean)
        : [],
      languages: Array.isArray(stylist?.languages)
        ? stylist.languages.map(normaliseText).filter(Boolean)
        : [],
      workingHours: Array.isArray(stylist?.workingHours)
        ? stylist.workingHours
        : undefined,
      isActive: stylist?.isActive !== false,
      offeredServices,
    };
  });
}

async function readCatalogue(filePath) {
  const absolutePath = path.resolve(filePath);
  const contents = await readFile(absolutePath, "utf8");
  const parsed = JSON.parse(contents);
  const services = normaliseServices(parsed?.services);
  const serviceNames = new Set(
    services.map((service) => service.name.toLowerCase())
  );
  const stylists = normaliseStylists(parsed?.stylists, serviceNames);

  return {
    absolutePath,
    productionReady: parsed?.productionReady === true,
    services,
    stylists,
  };
}

async function seedCatalogue(catalogue) {
  const servicesByName = new Map();

  for (const service of catalogue.services) {
    const saved = await Service.findOneAndUpdate(
      { name: service.name },
      { $set: service },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    servicesByName.set(service.name.toLowerCase(), saved._id);
  }

  for (const stylist of catalogue.stylists) {
    const {
      offeredServices,
      workingHours,
      ...stylistFields
    } = stylist;

    const update = {
      ...stylistFields,
      services: offeredServices.map(
        (name) => servicesByName.get(name.toLowerCase())
      ),
    };

    if (workingHours) {
      update.workingHours = workingHours;
    }

    await Stylist.findOneAndUpdate(
      { email: stylist.email },
      { $set: update },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );
  }
}

const options = parseArguments(process.argv.slice(2));

try {
  const catalogue = await readCatalogue(options.file);

  if (
    !catalogue.productionReady &&
    !options.dryRun &&
    !options.allowExampleData
  ) {
    throw new Error(
      "The catalogue is not marked productionReady. Validate with --dry-run or explicitly pass --allow-example-data."
    );
  }

  console.log(`Catalogue: ${catalogue.absolutePath}`);
  console.log(`Services: ${catalogue.services.length}`);
  console.log(`Stylists: ${catalogue.stylists.length}`);

  if (options.dryRun) {
    console.log("Booking catalogue validation passed; no database changes were made.");
  } else {
    await connectDB();
    await seedCatalogue(catalogue);
    console.log("Booking catalogue seeded successfully.");
  }
} catch (error) {
  console.error(`Booking catalogue seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
