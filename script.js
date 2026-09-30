const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const agentRoutes = require("./routes/agentRoutes");
const agentStatsRoutes = require("./routes/agentStatsRoutes");
const taskRoutes = require("./routes/taskRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const categorizationRoutes = require("./routes/categorizationRoutes");
const activityRoutes = require("./routes/activityRoutes");
const knowledgeRoutes = require("./routes/knowledgeRoutes");
const dataAssistantRoutes = require("./routes/dataAssistantRoutes");
const cookieParser = require("cookie-parser");
const multer = require("multer");

// CORS Configuration - Production-ready with environment variables
const getAllowedOrigins = () => {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(",").map((origin) => origin.trim()).filter(Boolean);
  }
  return [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173", // Vite default port
    "http://127.0.0.1:5173",
  ];
};

const allowedOrigins = getAllowedOrigins();

const isValidOrigin = (origin) => {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};

const isLocalhost = (origin) => {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

// Exact matches, or explicit patterns from ALLOWED_ORIGINS such as
// "https://taskflow-*-myteam.vercel.app", where * matches a single DNS label fragment only.
// Any *.vercel.app site is NOT trusted by default: anyone can deploy there.
const matchesAllowedOrigin = (origin) => {
  if (allowedOrigins.includes(origin)) return true;
  for (const allowed of allowedOrigins) {
    if (allowed.includes("*")) {
      const pattern = allowed
        .split("*")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("[a-z0-9-]+");
      const regex = new RegExp(`^${pattern}$`, "i");
      if (regex.test(origin)) return true;
    }
  }
  return false;
};

const app = express();

// Behind proxies (Render's load balancer, plus Vercel when /api is rewritten through it), trust
// X-Forwarded-For so req.ip is the real client. Otherwise every user shares the proxy's IP and
// the rate limiters lock everyone out together. TRUST_PROXY = number of proxy hops in front.
if (process.env.NODE_ENV === "production" || process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
}

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Don't block external API / SSE scripts in dev
    crossOriginEmbedderPolicy: false,
  })
);

// Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // Limit each IP to 60 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many authentication attempts, please try again in 15 minutes",
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600, // Limit general API requests
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", apiLimiter);
app.use("/api/auth/", authLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (!isValidOrigin(origin)) {
        return callback(new Error("Invalid origin format"), false);
      }
      if (matchesAllowedOrigin(origin)) {
        return callback(null, true);
      }
      // Outside production, any localhost port is fine (other sites still blocked,
      // so a server deployed without NODE_ENV=production is not left wide open)
      if (process.env.NODE_ENV !== "production" && isLocalhost(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 86400,
  })
);

// Connect to MongoDB, then clean up knowledge-base indexing interrupted by the last restart
connectDB().then(() => {
  if (process.env.NODE_ENV !== "test") {
    require("./services/knowledgeService").recoverInterruptedIndexing();
  }
});

// Report the Chroma Cloud (vector database) connection at startup; runs in the background
if (process.env.NODE_ENV !== "test") {
  require("./config/chroma").logChromaStartupStatus();
}

// Health Check Endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "TaskFlow_Server",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/", agentRoutes);
app.use("/api/agent", agentStatsRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/categorization", categorizationRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/knowledge", knowledgeRoutes);
app.use("/api/data", dataAssistantRoutes);

// Unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler - must be registered last
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS" || err.message === "Invalid origin format") {
    return res.status(403).json({ message: "CORS policy violation: Origin not allowed" });
  }

  if (err instanceof multer.MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "File too large. Please upload a smaller CSV." : `Upload error: ${err.message}`;
    return res.status(status).json({ message });
  }

  // Malformed JSON body / payload too large from express.json()
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Malformed JSON in request body" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body too large" });
  }

  console.error("Unhandled Error:", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: status < 500 ? err.message : "Internal server error",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
