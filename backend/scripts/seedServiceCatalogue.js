import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import mongoose from "mongoose";

import connectDB from "../src/config/db.js";
import Service from "../src/models/service.js";

function parseArguments(values) {
  const options = {
    file: "",
    dryRun: false,
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (value === "--dry-run") {
      options.dryRun = true;
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
    throw new Error("Provide a catalogue file with --file <path>.");
  }

  return options;
}

function text(value, max = 500) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

function number(value, field, minimum = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < minimum) {
    throw new Error(`${field} must be at least ${minimum}.`);
  }

  return parsed;
}

function normaliseService(service, index) {
  const name = text(service?.name, 160);
  const category = text(service?.category, 120);

  if (!name) throw new Error(`services[${index}].name is required.`);
  if (!category) throw new Error(`services[${index}].category is required.`);

  return {
    name,
    category,
    description: text(service?.description, 1000),
    price: number(service?.price, `services[${index}].price`, 0),
    priceLabel: text(service?.priceLabel, 120),
    priceOnConsultation: service?.priceOnConsultation === true,
    duration: number(service?.duration, `services[${index}].duration`, 1),
    durationEstimated: service?.durationEstimated === true,
    onlineBookable: service?.onlineBookable !== false,
    image: text(service?.image, 500),
    active: service?.active !== false,
  };
}

async function readCatalogue(filePath) {
  const absolutePath = path.resolve(filePath);
  const raw = await readFile(absolutePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed?.services) || parsed.services.length === 0) {
    throw new Error("The catalogue must contain at least one service.");
  }

  const names = new Set();
  const services = parsed.services.map((service, index) => {
    const normalised = normaliseService(service, index);
    const key = normalised.name.toLowerCase();

    if (names.has(key)) {
      throw new Error(`Duplicate service name: ${normalised.name}`);
    }

    names.add(key);
    return normalised;
  });

  return {
    absolutePath,
    services,
  };
}

async function seedServices(services) {
  for (const service of services) {
    await Service.findOneAndUpdate(
      { name: service.name },
      { $set: service },
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

  console.log(`Catalogue: ${catalogue.absolutePath}`);
  console.log(`Services: ${catalogue.services.length}`);

  if (options.dryRun) {
    console.log("Service catalogue validation passed; no database changes were made.");
  } else {
    await connectDB();
    await seedServices(catalogue.services);
    console.log("Service catalogue seeded successfully.");
  }
} catch (error) {
  console.error(`Service catalogue seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
