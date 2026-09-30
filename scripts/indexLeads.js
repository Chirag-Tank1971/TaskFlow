/**
 * Backfill the Chroma Cloud "leads" collection with existing closed leads
 * (outcome converted / not-interested), so Call Assist has examples from day one.
 * Safe to re-run: records are upserted by task id.
 *
 * Usage: node scripts/indexLeads.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Task = require("../models/Task");
const { indexLeads, INDEXED_OUTCOMES } = require("../services/leadIndexService");
const { getChromaStatus } = require("../config/chroma");

const BATCH = 100;

const run = async () => {
  const chroma = await getChromaStatus();
  if (!chroma.ok) {
    console.error(`❌ ${chroma.error}`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URL);
  const total = await Task.countDocuments({ outcome: { $in: INDEXED_OUTCOMES } });
  console.log(`Indexing ${total} closed leads...`);

  let done = 0;
  for (let skip = 0; skip < total; skip += BATCH) {
    const tasks = await Task.find({ outcome: { $in: INDEXED_OUTCOMES } })
      .sort({ _id: 1 })
      .skip(skip)
      .limit(BATCH)
      .lean();
    done += await indexLeads(tasks);
    console.log(`  ${done}/${total}`);
  }

  console.log(`✅ Indexed ${done} leads`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error("❌ Lead indexing failed:", err.message);
  await mongoose.disconnect();
  process.exit(1);
});
