const mongoose = require("mongoose");

const ACTIVITY_TYPES = [
  "created", // task added manually
  "imported", // task added via CSV upload
  "updated", // details edited (name, phone, notes, category)
  "status_changed",
  "reassigned",
  "call_logged",
  "categorized", // category set by AI
  "deleted",
  "ai_assist", // Call Assist suggestions requested
];

/**
 * Append-only audit trail of everything that happens to a task.
 * Stored separately from tasks so history survives task deletion.
 */
const activitySchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
    taskName: String, // denormalized so the log stays readable after deletion
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    actor: {
      id: { type: mongoose.Schema.Types.ObjectId, default: null }, // null = system (e.g. AI)
      role: { type: String, enum: ["admin", "manager", "agent", "system"], required: true },
      name: { type: String, default: "System" },
    },
    // Field-level diffs, e.g. { field: "status", from: "pending", to: "completed" }
    changes: [
      {
        _id: false,
        field: String,
        from: mongoose.Schema.Types.Mixed,
        to: mongoose.Schema.Types.Mixed,
      },
    ],
    // Extra context, e.g. { outcome, note, callbackAt } for call_logged
    meta: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activitySchema.index({ task: 1, createdAt: -1 });
activitySchema.index({ createdAt: -1 });
activitySchema.index({ type: 1, createdAt: -1 });
activitySchema.index({ "actor.id": 1, createdAt: -1 });

const Activity = mongoose.model("Activity", activitySchema);
Activity.ACTIVITY_TYPES = ACTIVITY_TYPES;

module.exports = Activity;
