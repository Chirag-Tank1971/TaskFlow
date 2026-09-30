const Activity = require("../models/Activity");

const SYSTEM_ACTOR = { id: null, role: "system", name: "System" };

/**
 * Build the actor stamp from the authenticated request.
 */
const actorFromReq = (req) => ({
  id: req.user?.id || null,
  role: req.user?.role || "system",
  name: req.user?.name || "Unknown",
});

/**
 * Compare two plain objects over the given fields and return the differences.
 */
const diffFields = (before, after, fields) =>
  fields
    .filter((f) => String(before[f] ?? "") !== String(after[f] ?? ""))
    .map((f) => ({ field: f, from: before[f] ?? null, to: after[f] ?? null }));

/**
 * Record one or more activity entries. Never throws: an audit write failure
 * must not break the user's action, so errors are only logged.
 */
const logActivity = async (entries) => {
  const list = (Array.isArray(entries) ? entries : [entries]).filter(Boolean);
  if (list.length === 0) return;
  try {
    await Activity.insertMany(list, { ordered: false });
  } catch (err) {
    console.error("[Activity] Failed to record activity:", err.message);
  }
};

module.exports = { logActivity, actorFromReq, diffFields, SYSTEM_ACTOR };
