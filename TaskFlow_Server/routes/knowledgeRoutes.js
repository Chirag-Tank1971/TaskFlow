const express = require("express");
const multer = require("multer");
const {
  uploadDocument,
  listDocuments,
  deleteDocument,
  ask,
  listQueries,
} = require("../controllers/knowledgeController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");

const router = express.Router();

// Knowledge documents are processed from memory, never written to disk
const MAX_DOC_MB = Number(process.env.MAX_KNOWLEDGE_DOC_MB) || 10;
const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOC_MB * 1024 * 1024, files: 1 },
});

const managersOnly = authorize(["admin", "manager"]);

/**
 * @route   POST /api/knowledge/documents
 * @desc    Upload a PDF/DOCX/TXT/Markdown document and index it into Chroma Cloud
 * @access  Private (Admin/Manager only)
 */
router.post("/documents", authenticate, managersOnly, docUpload.single("file"), uploadDocument);

/**
 * @route   GET /api/knowledge/documents
 * @desc    List knowledge-base documents and their indexing status
 * @access  Private (Admin/Manager only)
 */
router.get("/documents", authenticate, managersOnly, listDocuments);

/**
 * @route   DELETE /api/knowledge/documents/:id
 * @desc    Remove a document and its vectors
 * @access  Private (Admin/Manager only)
 */
router.delete("/documents/:id", authenticate, managersOnly, deleteDocument);

/**
 * @route   POST /api/knowledge/ask
 * @desc    Ask a question; answered from the knowledge base with citations
 * @access  Private (agents only search documents shared with everyone)
 */
router.post("/ask", authenticate, ask);

/**
 * @route   GET /api/knowledge/queries
 * @desc    Recent questions (optionally only unanswered) to find documentation gaps
 * @access  Private (Admin/Manager only)
 */
router.get("/queries", authenticate, managersOnly, listQueries);

module.exports = router;
