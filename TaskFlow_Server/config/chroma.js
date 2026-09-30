const { CloudClient } = require("chromadb");

/**
 * Chroma Cloud connection (vector database for the knowledge base and Call Assist).
 *
 *   CHROMA_API_KEY   API key from the Chroma Cloud dashboard
 *   CHROMA_TENANT    tenant ID (dashboard → Settings)
 *   CHROMA_DATABASE  database name, e.g. "taskflow-dev" locally and "taskflow" in production
 *
 * Use a separate database per environment so development data never mixes with production.
 */
const COLLECTIONS = {
  knowledge: "taskflow_knowledge", // chunks of uploaded knowledge-base documents
  leads: "taskflow_leads", // closed leads, for Call Assist's "similar leads" lookup
};

let client = null;
const collectionCache = new Map();

const missingConfig = () => ["CHROMA_API_KEY", "CHROMA_TENANT", "CHROMA_DATABASE"].filter((k) => !process.env[k]);

const getClient = () => {
  if (client) return client;
  const missing = missingConfig();
  if (missing.length) {
    const err = new Error(`Chroma Cloud is not configured: set ${missing.join(", ")}`);
    err.code = "CHROMA_NOT_CONFIGURED";
    throw err;
  }
  client = new CloudClient({
    apiKey: process.env.CHROMA_API_KEY,
    tenant: process.env.CHROMA_TENANT,
    database: process.env.CHROMA_DATABASE,
  });
  return client;
};

/**
 * Convert a Chroma distance into a 0-1 similarity for the collection's distance space.
 * Our embeddings are unit-length, so all three spaces map cleanly onto cosine similarity.
 */
const toSimilarity = (space, distance) => {
  if (distance == null) return 0;
  if (space === "l2") return 1 - distance / 2; // Chroma's l2 is squared: |a-b|² = 2 - 2·cos
  return 1 - distance; // "cosine" (1 - cos) and "ip" (1 - dot) for unit vectors
};

/**
 * Get (or create) a collection. We always supply our own Gemini embeddings, so no Chroma-side
 * embedding function is configured. Returns { collection, similarity(distance) }.
 */
const getCollection = async (key) => {
  const name = COLLECTIONS[key];
  if (!name) throw new Error(`Unknown Chroma collection: ${key}`);
  if (collectionCache.has(name)) return collectionCache.get(name);

  // Chroma Cloud indexes with SPANN; ask for cosine distance
  const collection = await getClient().getOrCreateCollection({
    name,
    embeddingFunction: null,
    configuration: { spann: { space: "cosine" } },
  });

  // Don't assume the requested space was applied (e.g. an older collection): read it back
  const cfg = collection.configuration || {};
  const space = cfg.spann?.space || cfg.hnsw?.space || collection.metadata?.["hnsw:space"] || "l2";
  if (space !== "cosine") {
    console.warn(`[Chroma] Collection "${name}" uses "${space}" distance; converting scores accordingly`);
  }

  const handle = { collection, space, similarity: (distance) => toSimilarity(space, distance) };
  collectionCache.set(name, handle);
  return handle;
};

/**
 * Turn a Chroma error into a message an admin can act on, or null if it isn't a Chroma problem.
 */
const describeChromaError = (err) => {
  const name = err?.name || "";
  const text = `${name} ${err?.message || ""}`;
  if (err?.code === "CHROMA_NOT_CONFIGURED") {
    return `The knowledge base isn't set up: ${err.message} on the server.`;
  }
  if (/ChromaAuthError|401|unauthori[sz]ed/i.test(text)) {
    return "Chroma Cloud rejected the API key. Check CHROMA_API_KEY on the server.";
  }
  if (/ChromaForbiddenError|403|forbidden|do not have permission/i.test(text)) {
    return `This Chroma Cloud API key isn't allowed to use tenant "${process.env.CHROMA_TENANT}" / database "${process.env.CHROMA_DATABASE}". Check CHROMA_TENANT and CHROMA_DATABASE (database names are case-sensitive).`;
  }
  if (/ChromaNotFoundError/.test(name) || /database .*not found|tenant .*not found/i.test(text)) {
    return `Chroma Cloud database "${process.env.CHROMA_DATABASE}" wasn't found. Create it in the Chroma Cloud dashboard.`;
  }
  if (/ChromaQuotaExceededError|ChromaRateLimitError/.test(name)) {
    return "Chroma Cloud usage limit reached. Try again later or check your Chroma Cloud plan.";
  }
  if (/ChromaConnectionError|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed|Failed to connect/i.test(text)) {
    return "Can't reach Chroma Cloud right now. Check the server's internet access and try again.";
  }
  return null;
};

/**
 * Ask Chroma Cloud which tenant/databases this API key can access (used to explain 403s).
 */
const getKeyIdentity = async () => {
  const res = await fetch("https://api.trychroma.com/api/v2/auth/identity", {
    headers: { "x-chroma-token": process.env.CHROMA_API_KEY || "" },
  });
  if (!res.ok) return null;
  return res.json(); // { user_id, tenant, databases: [...] }
};

/**
 * A valid key that isn't allowed to use the configured tenant/database gets a generic 403.
 * Look up what the key CAN access and say exactly what to change.
 */
const explainForbidden = async () => {
  try {
    const identity = await getKeyIdentity();
    if (!identity) return null;
    const { tenant, databases = [] } = identity;
    if (tenant && tenant !== process.env.CHROMA_TENANT) {
      return `This API key belongs to tenant "${tenant}", but CHROMA_TENANT is "${process.env.CHROMA_TENANT}". Update CHROMA_TENANT.`;
    }
    if (!databases.includes(process.env.CHROMA_DATABASE)) {
      const list = databases.length ? databases.map((d) => `"${d}"`).join(", ") : "none";
      return `This API key can't access database "${process.env.CHROMA_DATABASE}" (names are case-sensitive). ` +
        `Databases it can access: ${list}. Set CHROMA_DATABASE to one of these, or give the key access in the Chroma Cloud dashboard.`;
    }
  } catch {
    /* fall back to the generic message */
  }
  return null;
};

/**
 * Check Chroma Cloud: configured, reachable and authorised (heartbeat alone doesn't check the key,
 * so a cheap collection lookup is used). Returns { ok, error }.
 */
const getChromaStatus = async () => {
  try {
    await getCollection("knowledge");
    return { ok: true, error: null };
  } catch (err) {
    const forbidden = /ChromaForbiddenError|ChromaAuthError/.test(err?.name || "");
    const specific = forbidden ? await explainForbidden() : null;
    return { ok: false, error: specific || describeChromaError(err) || `Chroma Cloud error: ${err.message}` };
  }
};

/**
 * One-line startup report, e.g.
 *   [Chroma] ✓ Connected to Chroma Cloud (database "Task-flow", 412ms) · taskflow_knowledge: 6 vectors (cosine) · taskflow_leads: 0 vectors (cosine)
 * Never throws and never logs the API key; the server starts regardless of the result.
 */
const logChromaStartupStatus = async () => {
  const missing = missingConfig();
  if (missing.length) {
    console.warn(`[Chroma] ✗ Not configured (set ${missing.join(", ")}). Knowledge base and Call Assist are disabled.`);
    return;
  }

  const started = Date.now();
  const status = await getChromaStatus();
  if (!status.ok) {
    console.error(`[Chroma] ✗ Chroma Cloud unavailable (database "${process.env.CHROMA_DATABASE}"): ${status.error}`);
    return;
  }

  try {
    const parts = [];
    for (const key of Object.keys(COLLECTIONS)) {
      const { collection, space } = await getCollection(key);
      parts.push(`${collection.name}: ${await collection.count()} vectors (${space})`);
    }
    console.log(
      `[Chroma] ✓ Connected to Chroma Cloud (database "${process.env.CHROMA_DATABASE}", ${Date.now() - started}ms) · ${parts.join(" · ")}`
    );
  } catch (err) {
    console.warn(`[Chroma] ✓ Connected, but couldn't read collection stats: ${describeChromaError(err) || err.message}`);
  }
};

module.exports = {
  getCollection,
  getChromaStatus,
  logChromaStartupStatus,
  describeChromaError,
  explainForbidden,
  toSimilarity,
  COLLECTIONS,
};
