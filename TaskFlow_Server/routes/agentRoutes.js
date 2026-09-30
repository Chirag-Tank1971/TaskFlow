const express = require("express");
const { addAgent, getAgents, deleteAgent, updateAgent } = require("../controllers/agentController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");

const router = express.Router();

/**
 * @route   POST /api/agents
 * @desc    Add a new agent (Admin/Manager only)
 */
router.post("/agents", authenticate, authorize(["admin", "manager"]), addAgent);

/**
 * @route   POST /api/agents/update
 * @desc    Update an agent (Admin/Manager only)
 */
router.post("/agents/update", authenticate, authorize(["admin", "manager"]), updateAgent);

/**
 * @route   GET /api/agents
 * @desc    Retrieve all agents
 */
router.get("/agents", authenticate, getAgents);

/**
 * @route   DELETE /api/agents/:id
 * @desc    Delete an agent by ID (Admin/Manager only)
 */
router.delete("/agents/:id", authenticate, authorize(["admin", "manager"]), deleteAgent);

module.exports = router;
