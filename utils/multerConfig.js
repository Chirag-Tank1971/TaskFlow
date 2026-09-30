const multer = require("multer");
const path = require("path");

// Max CSV size in MB (override with MAX_UPLOAD_MB)
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 5;

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: "uploads/", // Save files to the "uploads" directory
  // Never trust the client filename on disk; keep only a safe basename
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${path.basename(file.originalname).replace(/[^\w.-]/g, "_")}`),
});

// Multer upload configuration with file type filtering and size limits
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["text/csv", "application/vnd.ms-excel"]; // Allowed file MIME types
    cb(null, allowedTypes.includes(file.mimetype)); // Accept or reject file based on type
  },
});

module.exports = upload; // Export the configured upload middleware
