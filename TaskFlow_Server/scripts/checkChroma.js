/**
 * Verify the Chroma Cloud setup end to end: credentials, database, collection creation,
 * write → similarity query → delete, and the distance space used for scoring.
 * Uses a throwaway collection, so it never touches real knowledge-base data.
 *
 * Usage: npm run chroma:check
 */
require("dotenv").config();
const { CloudClient } = require("chromadb");
const { describeChromaError, explainForbidden, toSimilarity, COLLECTIONS } = require("../config/chroma");

const TEST_COLLECTION = "taskflow_healthcheck";

// Tiny unit vectors: a is close to b, far from c
const norm = (v) => {
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
};
const vectors = { a: norm([1, 0.1, 0]), b: norm([0.9, 0.2, 0]), c: norm([0, 0, 1]) };

const step = (msg) => console.log(`  ✓ ${msg}`);

const run = async () => {
  const missing = ["CHROMA_API_KEY", "CHROMA_TENANT", "CHROMA_DATABASE"].filter((k) => !process.env[k]);
  if (missing.length) throw Object.assign(new Error(`Chroma Cloud is not configured: set ${missing.join(", ")}`), { code: "CHROMA_NOT_CONFIGURED" });

  console.log(`Checking Chroma Cloud (tenant ${process.env.CHROMA_TENANT}, database "${process.env.CHROMA_DATABASE}")`);
  const client = new CloudClient({
    apiKey: process.env.CHROMA_API_KEY,
    tenant: process.env.CHROMA_TENANT,
    database: process.env.CHROMA_DATABASE,
  });

  await client.heartbeat();
  step("reachable");

  const collection = await client.getOrCreateCollection({
    name: TEST_COLLECTION,
    embeddingFunction: null,
    configuration: { spann: { space: "cosine" } },
  });
  const cfg = collection.configuration || {};
  const space = cfg.spann?.space || cfg.hnsw?.space || "l2";
  step(`credentials accepted, collection created (distance space: ${space})`);

  try {
    await collection.upsert({
      ids: ["b", "c"],
      embeddings: [vectors.b, vectors.c],
      documents: ["close to the query", "unrelated"],
    });
    const res = await collection.query({ queryEmbeddings: [vectors.a], nResults: 2, include: ["distances", "documents"] });
    const rows = res.rows()[0];
    const scores = rows.map((r) => `${r.id}=${toSimilarity(space, r.distance).toFixed(2)}`).join(", ");
    if (rows[0]?.id !== "b") throw new Error(`similarity search returned the wrong order (${scores})`);
    step(`write + similarity search work (scores: ${scores})`);
  } finally {
    await client.deleteCollection({ name: TEST_COLLECTION }).catch(() => {});
    step("test collection removed");
  }

  const existing = await client.listCollections().catch(() => []);
  const names = existing.map((c) => c.name || c);
  console.log(`\nApp collections present: ${Object.values(COLLECTIONS).map((n) => `${n} ${names.includes(n) ? "(yes)" : "(created on first upload)"}`).join(", ")}`);
  console.log("✅ Chroma Cloud is ready for TaskFlow");
};

run().catch(async (err) => {
  const forbidden = /ChromaForbiddenError|ChromaAuthError/.test(err?.name || "");
  const specific = forbidden ? await explainForbidden() : null;
  console.error(`\n❌ ${specific || describeChromaError(err) || err.message}`);
  process.exit(1);
});
