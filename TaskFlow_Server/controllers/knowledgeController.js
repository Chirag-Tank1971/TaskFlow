const mongoose = require("mongoose");
const { z } = require("zod");
const KnowledgeDocument = require("../models/KnowledgeDocument");
const KnowledgeQuery = require("../models/KnowledgeQuery");
const Task = require("../models/Task");
const { ingestDocument, removeDocumentChunks, fileKind } = require("../services/knowledgeService");
const { answerQuestion, getCallAssist } = require("../services/ragService");
const { AiBusyError, AiUnavailableError } = require("../services/geminiGenerate");
const { getChromaStatus, describeChromaError } = require("../config/chroma");
const { logActivity, actorFromReq } = require("../services/activityService");

const uploadSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150, "Title is too long"),
  audience: z.enum(["all", "managers"]).optional().default("all"),
});

const askSchema = z.object({
  question: z.string().trim().min(3, "Question is too short").max(1000, "Question is too long"),
});

const firstIssue = (r, fallback) => r.error?.issues?.[0]?.message || fallback;

// Map service errors to useful HTTP responses
const handleAiError = (res, err, context) => {
  if (err instanceof AiBusyError) {
    res.set("Retry-After", String(err.retryAfter));
    return res.status(429).json({ message: err.message, retryAfter: err.retryAfter });
  }
  if (err instanceof AiUnavailableError) {
    res.set("Retry-After", "60");
    return res.status(503).json({ message: err.message, retryAfter: 60 });
  }
  const chromaMessage = describeChromaError(err);
  if (chromaMessage) {
    console.error(`${context} Chroma Error:`, err.message);
    return res.status(503).json({ message: chromaMessage });
  }
  console.error(`${context} Error:`, err);
  return res.status(500).json({ message: err.message?.startsWith("The AI") ? err.message : `Server error during ${context.toLowerCase()}` });
};

const recordQuery = (req, data) =>
  KnowledgeQuery.create({
    ...data,
    askedBy: { id: req.user.id, name: req.user.name, role: req.user.role },
  }).catch((err) => console.error("[Knowledge] Failed to log query:", err.message));

/**
 * POST /api/knowledge/documents (multipart: file, title, audience) — Admin/Manager
 */
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded. Supported: PDF, DOCX, TXT, Markdown." });
    }
    if (!fileKind(req.file.originalname)) {
      return res.status(400).json({ message: "Unsupported file type. Upload PDF, DOCX, TXT or Markdown." });
    }

    const parsed = uploadSchema.safeParse({
      title: req.body.title || req.file.originalname.replace(/\.[^.]+$/, ""),
      audience: req.body.audience || undefined,
    });
    if (!parsed.success) {
      return res.status(400).json({ message: firstIssue(parsed, "Invalid document details") });
    }

    const chroma = await getChromaStatus();
    if (!chroma.ok) {
      return res.status(503).json({ message: chroma.error });
    }

    const doc = await KnowledgeDocument.create({
      title: parsed.data.title,
      audience: parsed.data.audience,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: { id: req.user.id, name: req.user.name },
    });

    // Index in the background; the client polls the document status
    ingestDocument(doc._id, req.file.buffer);

    res.status(202).json({ message: "Document uploaded. Indexing has started.", document: doc });
  } catch (err) {
    console.error("Knowledge Upload Error:", err);
    res.status(500).json({ message: "Server error uploading document" });
  }
};

/**
 * GET /api/knowledge/documents — Admin/Manager
 */
const listDocuments = async (req, res) => {
  try {
    const [documents, chroma] = await Promise.all([
      KnowledgeDocument.find().sort({ createdAt: -1 }).lean(),
      getChromaStatus(),
    ]);
    res.json({ documents, chromaUp: chroma.ok, chromaError: chroma.error });
  } catch (err) {
    console.error("Knowledge List Error:", err);
    res.status(500).json({ message: "Server error listing documents" });
  }
};

/**
 * DELETE /api/knowledge/documents/:id — Admin/Manager
 */
const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid document ID" });
    }
    const doc = await KnowledgeDocument.findById(id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    await removeDocumentChunks(doc._id);
    await doc.deleteOne();
    res.json({ message: `Removed "${doc.title}" from the knowledge base` });
  } catch (err) {
    handleAiError(res, err, "Knowledge Delete");
  }
};

/**
 * POST /api/knowledge/ask { question } — any authenticated user
 */
const ask = async (req, res) => {
  const started = Date.now();
  try {
    const parsed = askSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: firstIssue(parsed, "Invalid question") });
    }
    const { question } = parsed.data;

    const result = await answerQuestion(question, { role: req.user.role });

    recordQuery(req, {
      kind: "ask",
      question,
      answered: result.answered,
      sourceCount: result.sources.length,
      topScore: result.topScore,
      latencyMs: Date.now() - started,
    });

    res.json({ answer: result.answer, answered: result.answered, sources: result.sources });
  } catch (err) {
    handleAiError(res, err, "Knowledge Ask");
  }
};

/**
 * POST /api/tasks/:taskId/assist — agents: own tasks only
 */
const callAssist = async (req, res) => {
  const started = Date.now();
  try {
    const { taskId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: "Invalid task ID format" });
    }
    const task = await Task.findById(taskId).lean();
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (req.user.role === "agent" && task.agent?.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: You can only use Call Assist on your own tasks" });
    }

    const assist = await getCallAssist(task, { role: req.user.role });

    recordQuery(req, {
      kind: "assist",
      question: `Call Assist for ${task.firstName || "lead"}`,
      task: task._id,
      answered: true,
      sourceCount: assist.sources.length,
      topScore: assist.topScore,
      latencyMs: Date.now() - started,
    });
    logActivity({
      task: task._id,
      taskName: task.firstName,
      type: "ai_assist",
      actor: actorFromReq(req),
      meta: { sources: assist.sources.length, similarLeads: assist.similarLeads.length },
    });

    const { topScore, ...payload } = assist;
    res.json(payload);
  } catch (err) {
    handleAiError(res, err, "Call Assist");
  }
};

/**
 * GET /api/knowledge/queries?unanswered=true — Admin/Manager: recent questions, to spot doc gaps
 */
const listQueries = async (req, res) => {
  try {
    const filter = { kind: "ask", ...(req.query.unanswered === "true" && { answered: false }) };
    const queries = await KnowledgeQuery.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    const [total, unanswered] = await Promise.all([
      KnowledgeQuery.countDocuments({ kind: "ask" }),
      KnowledgeQuery.countDocuments({ kind: "ask", answered: false }),
    ]);
    res.json({ queries, stats: { total, unanswered } });
  } catch (err) {
    console.error("Knowledge Queries Error:", err);
    res.status(500).json({ message: "Server error listing questions" });
  }
};

module.exports = { uploadDocument, listDocuments, deleteDocument, ask, callAssist, listQueries };
