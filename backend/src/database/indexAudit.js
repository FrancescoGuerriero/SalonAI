import mongoose from "mongoose";
import { env } from "../config/env.js";

await mongoose.connect(env.mongoUri);

const results = [];

for (const [name, model] of Object.entries(mongoose.models)) {
  const collection = model.collection;
  const indexes = await collection.indexes();

  results.push({
    model: name,
    collection: collection.collectionName,
    indexes,
  });
}

console.log(JSON.stringify(results, null, 2));
await mongoose.disconnect();
