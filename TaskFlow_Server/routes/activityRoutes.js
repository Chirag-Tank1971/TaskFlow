const express = require("express");
const { getActivityFeed } = require("../controllers/activityController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");

const router = express.Router();

/**
 * @route   GET /api/activity
 * @desc    Audit log of all task activity, filterable and paginated
 * @access  Private (Admin/Manager only)
 */
router.get("/", authenticate, authorize(["admin", "manager"]), getActivityFeed);

module.exports = router;
