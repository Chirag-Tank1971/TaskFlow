const { getProgress } = require("../services/progressTracker");

/**
 * Get upload progress (Supports both Server-Sent Events and JSON polling)
 * @route GET /api/upload/progress/:jobId
 */
const getUploadProgress = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({ message: "Job ID is required" });
    }

    const isSSE =
      req.headers.accept?.includes("text/event-stream") || req.query.stream === "true";

    if (isSSE) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Prevent Nginx buffering
      res.flushHeaders?.();

      const sendUpdate = () => {
        const progress = getProgress(jobId);
        if (!progress) {
          res.write(
            `data: ${JSON.stringify({ status: "not_found", message: "Job not found" })}\n\n`
          );
          res.end();
          return false;
        }

        res.write(`data: ${JSON.stringify(progress)}\n\n`);

        if (progress.status === "completed" || progress.status === "failed") {
          res.end();
          return false;
        }
        return true;
      };

      // Send immediate first frame
      const ongoing = sendUpdate();
      if (!ongoing) return;

      const intervalId = setInterval(() => {
        const active = sendUpdate();
        if (!active) {
          clearInterval(intervalId);
        }
      }, 500);

      req.on("close", () => {
        clearInterval(intervalId);
      });
      return;
    }

    // Return standard JSON for HTTP polling
    const progress = getProgress(jobId);
    if (!progress) {
      return res.status(404).json({
        message: "Job not found or expired",
        status: "not_found",
      });
    }

    res.json(progress);
  } catch (error) {
    console.error("Progress Controller Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error retrieving progress" });
    }
  }
};

module.exports = { getUploadProgress };
