const path = require("path");
const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");
const KnowledgeDocument = require("../models/KnowledgeDocument");
const { getCollection, describeChromaError } = require("../config/chroma");
const { embedTexts, embedQuery } = require("./embeddingService");
const { chunkText } = require("./chunker");

// Bounds indexing cost (~150 chunks) on the free Gemini tier
const MAX_CHARACTERS = 500000;
// Cosine similarity below this is treated as "not relevant". With gemini-embedding-001 at 768 dims,
// related text scored ~0.70 and unrelated ~0.53 in testing. Tune with real documents.
const MIN_SIMILARITY = Number(process.env.RAG_MIN_SIMILARITY) || 0.6;

const SUPPORTED_TYPES = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".txt": "text",
  ".md": "text",
  ".markdown": "text",
};

const fileKind = (filename) => SUPPORTED_TYPES[path.extname(filename || "").toLowerCase()] || null;

/**
 * Extract plain text from an uploaded file buffer.
 */
const extractText = async (buffer, filename) => {
  const kind = fileKind(filename);
  if (kind === "pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      // pdf-parse v2 inserts "-- N of M --" page markers; they're noise for retrieval
      return (result.text || "").replace(/^\s*-- \d+ of \d+ --\s*$/gm, "");
    } finally {
      await parser.destroy();
    }
  }
  if (kind === "docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    return value || "";
  }
  if (kind === "text") return buffer.toString("utf8");
  throw new Error("Unsupported file type. Upload PDF, DOCX, TXT or Markdown.");
};

/**
 * Extract → chunk → embed → store in Chroma. Updates the document's status as it goes.
 * Runs in the background after upload; never throws.
 */
const ingestDocument = async (docId, buffer) => {
  const doc = await KnowledgeDocument.findById(docId);
  if (!doc) return;

  try {
    const text = (await extractText(buffer, doc.filename)).trim();
    if (!text) {
      throw new Error("No readable text found. Scanned PDFs (images) are not supported yet.");
    }
    if (text.length > MAX_CHARACTERS) {
      throw new Error(`Document is too long (${text.length.toLocaleString()} characters, max ${MAX_CHARACTERS.toLocaleString()}). Split it into smaller files.`);
    }

    const chunks = chunkText(text);
    // Prefix the title so each chunk carries its context into the embedding
    const embeddings = await embedTexts(chunks.map((c) => `${doc.title}\n\n${c}`), "RETRIEVAL_DOCUMENT");

    const { collection } = await getCollection("knowledge");
    await collection.upsert({
      ids: chunks.map((_, i) => `${doc._id}:${i}`),
      embeddings,
      documents: chunks,
      metadatas: chunks.map((_, i) => ({
        docId: doc._id.toString(),
        title: doc.title,
        audience: doc.audience,
        chunkIndex: i,
      })),
    });

    doc.status = "ready";
    doc.chunkCount = chunks.length;
    doc.characterCount = text.length;
    doc.error = undefined;
    await doc.save();
    console.log(`[Knowledge] Indexed "${doc.title}" (${chunks.length} chunks)`);
  } catch (err) {
    console.error(`[Knowledge] Indexing failed for "${doc.title}":`, err.message);
    doc.status = "failed";
    // Show an actionable message for Chroma Cloud problems (credentials, quota, connectivity)
    doc.error = (describeChromaError(err) || err.message || "Indexing failed").slice(0, 500);
    await doc.save().catch(() => {});
    // Don't leave half-written chunks behind
    await removeDocumentChunks(doc._id).catch(() => {});
  }
};

const removeDocumentChunks = async (docId) => {
  const { collection } = await getCollection("knowledge");
  await collection.delete({ where: { docId: docId.toString() } });
};

/**
 * Semantic search over the knowledge base.
 * @param {string|number[]} query - question text, or a precomputed query embedding
 * @param {{ role: string, k?: number }} options - agents only see audience "all" documents
 * @returns {Promise<Array<{ id, docId, title, text, score }>>} relevant chunks, best first
 */
const searchKnowledge = async (query, { role, k = 5 } = {}) => {
  const queryEmbedding = Array.isArray(query) ? query : await embedQuery(query);
  const { collection, similarity } = await getCollection("knowledge");

  const result = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: k,
    ...(role === "agent" && { where: { audience: "all" } }),
    include: ["documents", "metadatas", "distances"],
  });

  return (result.rows()[0] || [])
    .map((row) => ({
      id: row.id,
      docId: row.metadata?.docId,
      title: row.metadata?.title || "Untitled",
      text: row.document || "",
      score: similarity(row.distance), // distance → 0-1 similarity for the collection's space
    }))
    .filter((r) => r.score >= MIN_SIMILARITY);
};

/**
 * Indexing runs in the background inside this process. If the server restarted mid-way
 * (deploy, crash, Render free-tier spin-down), those documents would say "processing" forever.
 * Call once at startup (single instance) to mark them failed so admins can re-upload.
 */
const recoverInterruptedIndexing = async () => {
  try {
    const stuck = await KnowledgeDocument.find({ status: "processing" }).select("_id title").lean();
    if (stuck.length === 0) return 0;
    await KnowledgeDocument.updateMany(
      { _id: { $in: stuck.map((d) => d._id) } },
      { $set: { status: "failed", error: "Indexing was interrupted by a server restart. Please delete and re-upload this document." } }
    );
    // Remove any partial vectors (best-effort; Chroma may not be reachable yet)
    await Promise.all(stuck.map((d) => removeDocumentChunks(d._id).catch(() => {})));
    console.warn(`[Knowledge] Marked ${stuck.length} interrupted document(s) as failed: ${stuck.map((d) => d.title).join(", ")}`);
    return stuck.length;
  } catch (err) {
    console.error("[Knowledge] Could not check for interrupted indexing:", err.message);
    return 0;
  }
};

module.exports = {
  recoverInterruptedIndexing,
  ingestDocument,
  removeDocumentChunks,
  searchKnowledge,
  fileKind,
  MIN_SIMILARITY,
};
