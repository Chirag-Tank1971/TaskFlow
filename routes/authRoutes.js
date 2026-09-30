const express = require("express");
const { login, signup, logout, getMe } = require("../controllers/authController");
const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return a JWT token + HttpOnly cookie
 */
router.post("/login", login);

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user or agent
 */
router.post("/signup", signup);

/**
 * @route   GET /api/auth/me
 * @desc    Get currently logged in user profile
 */
router.get("/me", authenticate, getMe);

/**
 * @route   GET /api/auth/logout
 * @desc    Clear authentication cookie
 */
router.get("/logout", logout);

module.exports = router;
