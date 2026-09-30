const { getCollection } = require("../config/chroma");
const { embedTexts } = require("./embeddingService");

// Only leads with a clear result are useful as examples for Call Assist
const INDEXED_OUTCOMES = ["converted", "not-interested"];

/**
 * Text that represents a lead for similarity search: what they wanted and how the calls went.
 */
const leadText = (task) => {
  const callNotes = (task.callLogs || [])
    .map((c) => c.note)
    .filter(Boolean)
    .join(" | ");
  return [
    `Category: ${task.category || "General"}`,
    `Lead notes: ${task.notes || "(none)"}`,
    callNotes && `Call notes: ${callNotes}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 6000);
};

/**
 * Add/refresh closed leads in the "leads" collection. Leads without a useful outcome are removed.
 * Never throws: indexing is best-effort and must not break the caller.
 */
const indexLeads = async (tasks) => {
  try {
    const list = (Array.isArray(tasks) ? tasks : [tasks]).filter(Boolean);
    const toIndex = list.filter((t) => INDEXED_OUTCOMES.includes(t.outcome));
    const toRemove = list.filter((t) => !INDEXED_OUTCOMES.includes(t.outcome)).map((t) => t._id.toString());

    const { collection } = await getCollection("leads");
    if (toRemove.length) await collection.delete({ ids: toRemove });
    if (!toIndex.length) return 0;

    const documents = toIndex.map(leadText);
    const embeddings = await embedTexts(documents, "RETRIEVAL_DOCUMENT");
    await collection.upsert({
      ids: toIndex.map((t) => t._id.toString()),
      embeddings,
      documents,
      metadatas: toIndex.map((t) => ({
        taskId: t._id.toString(),
        firstName: t.firstName || "",
        outcome: t.outcome,
        category: t.category || "General",
        attempts: t.attempts || 0,
      })),
    });
    return toIndex.length;
  } catch (err) {
    console.error("[LeadIndex] Failed to index leads:", err.message);
    return 0;
  }
};

const removeLeads = async (taskIds) => {
  try {
    const ids = taskIds.map((id) => id.toString());
    if (!ids.length) return;
    const { collection } = await getCollection("leads");
    await collection.delete({ ids });
  } catch (err) {
    console.error("[LeadIndex] Failed to remove leads:", err.message);
  }
};

/**
 * Find past converted leads similar to the given query embedding.
 */
const findSimilarConvertedLeads = async (queryEmbedding, { excludeTaskId, k = 3 } = {}) => {
  const { collection, similarity } = await getCollection("leads");
  const result = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: k + 1, // one extra in case the lead itself is indexed
    where: { outcome: "converted" },
    include: ["documents", "metadatas", "distances"],
  });
  return (result.rows()[0] || [])
    .filter((row) => row.id !== excludeTaskId?.toString())
    .slice(0, k)
    .map((row) => ({
      taskId: row.id,
      firstName: row.metadata?.firstName,
      category: row.metadata?.category,
      attempts: row.metadata?.attempts,
      text: row.document || "",
      score: similarity(row.distance),
    }));
};

module.exports = { indexLeads, removeLeads, findSimilarConvertedLeads, leadText, INDEXED_OUTCOMES };
