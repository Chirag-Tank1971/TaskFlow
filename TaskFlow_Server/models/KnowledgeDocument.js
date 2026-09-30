const mongoose = require("mongoose");

/**
 * A knowledge-base document. The text itself lives in Chroma Cloud as embedded chunks
 * (ids "<documentId>:<chunkIndex>"); this record tracks metadata and indexing status.
 */
const knowledgeDocumentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    filename: String,
    mimeType: String,
    size: Number,
    // "all" = agents and managers; "managers" = admins/managers only
    audience: { type: String, enum: ["all", "managers"], default: "all" },
    status: { type: String, enum: ["processing", "ready", "failed"], default: "processing" },
    error: String,
    chunkCount: { type: Number, default: 0 },
    characterCount: { type: Number, default: 0 },
    uploadedBy: {
      id: mongoose.Schema.Types.ObjectId,
      name: String,
    },
  },
  { timestamps: true }
);

knowledgeDocumentSchema.index({ createdAt: -1 });

module.exports = mongoose.model("KnowledgeDocument", knowledgeDocumentSchema);
