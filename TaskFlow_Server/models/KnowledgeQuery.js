const mongoose = require("mongoose");

/**
 * Log of questions asked to the knowledge base (and Call Assist requests).
 * Lets admins spot unanswered questions, i.e. gaps in the documentation.
 */
const knowledgeQuerySchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["ask", "assist", "data"], default: "ask" },
    // For kind "data": which read-only tool the AI chose and its validated filters
    toolName: String,
    toolArgs: { type: Object, default: undefined },
    question: String,
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    askedBy: {
      id: mongoose.Schema.Types.ObjectId,
      name: String,
      role: String,
    },
    answered: Boolean, // false = nothing relevant found / AI unavailable
    sourceCount: Number,
    topScore: Number, // best similarity (0-1) among retrieved chunks
    latencyMs: Number,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

knowledgeQuerySchema.index({ createdAt: -1 });
knowledgeQuerySchema.index({ answered: 1, createdAt: -1 });

module.exports = mongoose.model("KnowledgeQuery", knowledgeQuerySchema);
