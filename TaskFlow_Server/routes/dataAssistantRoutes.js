const express = require("express");
const { askDataQuestion } = require("../controllers/dataAssistantController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");

const router = express.Router();

/**
 * @route   POST /api/data/ask
 * @desc    Ask a natural-language question about TaskFlow data (read-only)
 * @access  Private (Admin/Manager only)
 */
router.post("/ask", authenticate, authorize(["admin", "manager"]), askDataQuestion);

module.exports = router;
