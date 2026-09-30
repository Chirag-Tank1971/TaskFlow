const { z } = require("zod");
const KnowledgeQuery = require("../models/KnowledgeQuery");
const { askData } = require("../services/dataAssistantService");
const { ToolError } = require("../services/dataQueryTools");
const { AiBusyError, AiUnavailableError } = require("../services/geminiGenerate");

const askSchema = z.object({
  question: z.string().trim().min(3, "Question is too short").max(500, "Question is too long"),
  timeZone: z.string().trim().max(64).optional(),
});

/**
 * POST /api/data/ask { question, timeZone } — Admin/Manager only.
 * Answers questions about TaskFlow data through read-only tools.
 */
const askDataQuestion = async (req, res) => {
  const started = Date.now();
  const parsed = askSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid question" });
  }
  const { question, timeZone } = parsed.data;

  const log = (data) =>
    KnowledgeQuery.create({
      kind: "data",
      question,
      askedBy: { id: req.user.id, name: req.user.name, role: req.user.role },
      latencyMs: Date.now() - started,
      ...data,
    }).catch((err) => console.error("[DataAssistant] Failed to log query:", err.message));

  try {
    const { tool, args, result } = await askData(question, { timeZone });
    log({ answered: tool !== "reply", toolName: tool, toolArgs: args, sourceCount: result.total ?? 0 });
    res.json({ question, tool, args, ...result });
  } catch (err) {
    if (err instanceof AiBusyError) {
      res.set("Retry-After", String(err.retryAfter));
      return res.status(429).json({ message: err.message, retryAfter: err.retryAfter });
    }
    if (err instanceof AiUnavailableError) {
      log({ answered: false, toolName: "unavailable" });
      res.set("Retry-After", "60");
      return res.status(503).json({ message: err.message, retryAfter: 60 });
    }
    if (err instanceof ToolError) {
      log({ answered: false, toolName: "error" });
      return res.status(422).json({ message: err.message });
    }
    console.error("Data Assistant Error:", err);
    log({ answered: false, toolName: "error" });
    res.status(500).json({ message: "The data assistant ran into a problem. Please try again." });
  }
};

module.exports = { askDataQuestion };
