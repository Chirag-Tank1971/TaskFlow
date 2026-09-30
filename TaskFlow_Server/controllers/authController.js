const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Agent = require("../models/Agent");
const { loginSchema, signupSchema } = require("../validators/authValidator");

/**
 * Handle user/agent login
 */
const login = async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      const msg = parseResult.error?.issues?.[0]?.message || parseResult.error?.errors?.[0]?.message || "Invalid input data";
      return res.status(400).json({ message: msg });
    }

    const { email, password, accountType } = parseResult.data;

    let user = null;
    let role = "admin";

    const findByEmail = async (Model, rawEmail) => {
      if (!rawEmail) return null;
      const normalized = rawEmail.trim();
      let doc = await Model.findOne({ email: normalized });
      if (doc) return doc;
      doc = await Model.findOne({ email: normalized.toLowerCase() });
      if (doc) return doc;
      const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return await Model.findOne({ email: { $regex: new RegExp(`^${escaped}$`, "i") } });
    };

    // Role always comes from which collection the account lives in, never from the email address
    if (accountType === "agent") {
      user = await findByEmail(Agent, email);
      role = "agent";
    } else if (accountType === "admin") {
      user = await findByEmail(User, email);
      role = user?.role || "admin";
    } else {
      // Auto-detect: Check User first, then Agent
      user = await findByEmail(User, email);
      if (!user) {
        user = await findByEmail(Agent, email);
        if (user) role = "agent";
      } else {
        role = user.role || "admin";
      }
    }

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check if agent is decommissioned
    if (role === "agent" && user.status === "Decommissioned") {
      return res.status(403).json({ message: "Account decommissioned. Please contact administration." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const payload = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Set secure HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Return sanitized user without password
    const safeUser = user.toObject();
    safeUser.role = role;

    // Token is only delivered via the HttpOnly cookie so page scripts can never read it
    res.json({
      message: "Login successful",
      user: safeUser,
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error during authentication" });
  }
};

/**
 * Handle user/agent registration
 */
const signup = async (req, res) => {
  try {
    const parseResult = signupSchema.safeParse(req.body);
    if (!parseResult.success) {
      const msg = parseResult.error?.issues?.[0]?.message || parseResult.error?.errors?.[0]?.message || "Invalid input data";
      return res.status(400).json({ message: msg });
    }

    const { name, email, password, confirmPass, fullNumber, role } = parseResult.data;

    if (confirmPass && password !== confirmPass) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user or agent exists
    const [existingUser, existingAgent] = await Promise.all([
      User.findOne({ email: normalizedEmail }),
      Agent.findOne({ email: normalizedEmail }),
    ]);

    if (existingUser || existingAgent) {
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    // Public signup creates agents by default. An admin account can only be self-registered
    // when no admin/manager exists yet (first-time setup); after that, use scripts/createAdmin.js.
    const wantsAdmin = role === "admin" || role === "manager";
    if (wantsAdmin && (await User.exists({}))) {
      return res.status(403).json({
        message: "Admin registration is closed. Ask an existing administrator to create your account.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let createdRecord = null;
    let assignedRole = "agent";

    if (!wantsAdmin) {
      assignedRole = "agent";
      createdRecord = await Agent.create({
        name,
        email: normalizedEmail,
        mobile: fullNumber || "N/A",
        password: hashedPassword,
        status: "Available",
        role: "agent",
      });
    } else {
      // The very first account is always a full admin
      assignedRole = "admin";
      createdRecord = await User.create({
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: assignedRole,
      });
    }

    const payload = {
      id: createdRecord._id.toString(),
      email: createdRecord.email,
      name: createdRecord.name,
      role: assignedRole,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const safeUser = createdRecord.toObject();
    safeUser.role = assignedRole;

    res.status(201).json({
      message: "Account created successfully",
      user: safeUser,
    });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
};

/**
 * Get currently authenticated user profile
 */
const getMe = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const Model = req.user.role === "agent" ? Agent : User;
    const user = await Model.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const safeUser = user.toObject();
    safeUser.role = req.user.role;

    res.json({ user: safeUser });
  } catch (error) {
    console.error("GetMe Error:", error);
    res.status(500).json({ message: "Server error fetching user profile" });
  }
};

/**
 * Logout and clear authentication cookie
 */
const logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ message: "Logged out successfully" });
};

module.exports = { login, signup, logout, getMe };
