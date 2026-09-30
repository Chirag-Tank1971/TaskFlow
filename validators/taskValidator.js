const { z } = require("zod");
const { OUTCOME_KEYS } = require("../constants/callOutcomes");

const updateStatusSchema = z.object({
  status: z.enum(["pending", "in-progress", "completed"]),
});

const bulkStatusSchema = z.object({
  taskIds: z.array(z.string()).min(1, "At least one task ID is required"),
  status: z.enum(["pending", "in-progress", "completed"]),
});

const bulkDeleteSchema = z.object({
  taskIds: z.array(z.string()).min(1, "At least one task ID is required"),
});

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ID format");
const categoryEnum = z.enum(["Support", "Sales", "Technical", "Billing", "Urgent", "General"]);

const createTaskSchema = z.object({
  firstName: z.string().trim().min(1, "Customer name is required").max(100, "Name is too long"),
  phone: z
    .string()
    .trim()
    .max(30, "Phone number is too long")
    .regex(/^[+\d\s()\-.]*$/, "Phone number contains invalid characters")
    .optional()
    .default(""),
  notes: z.string().trim().max(2000, "Notes cannot exceed 2000 characters").optional().default(""),
  // Omitted = auto-assign to the available agent with the lightest workload
  agent: objectId.optional(),
  // Omitted = let AI categorize from the notes
  category: categoryEnum.optional(),
});

const updateTaskSchema = z
  .object({
    firstName: z.string().trim().min(1, "Customer name is required").max(100, "Name is too long"),
    phone: z
      .string()
      .trim()
      .max(30, "Phone number is too long")
      .regex(/^[+\d\s()\-.]*$/, "Phone number contains invalid characters"),
    notes: z.string().trim().max(2000, "Notes cannot exceed 2000 characters"),
    agent: objectId,
    category: categoryEnum,
    status: z.enum(["pending", "in-progress", "completed"]),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, "No fields to update");

const bulkAssignSchema = z.object({
  taskIds: z.array(objectId).min(1, "At least one task ID is required").max(200, "Cannot reassign more than 200 tasks at once"),
  agentId: objectId,
});

const MAX_CALLBACK_DAYS = 365;

const logCallSchema = z
  .object({
    outcome: z.enum(OUTCOME_KEYS),
    note: z.string().trim().max(1000, "Call note cannot exceed 1000 characters").optional().default(""),
    callbackAt: z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.outcome !== "callback") return;
    if (!data.callbackAt || isNaN(data.callbackAt.getTime())) {
      ctx.addIssue({ code: "custom", path: ["callbackAt"], message: "Pick a date and time for the callback" });
      return;
    }
    const now = Date.now();
    // Small grace window for clock differences between browser and server
    if (data.callbackAt.getTime() < now - 60 * 1000) {
      ctx.addIssue({ code: "custom", path: ["callbackAt"], message: "Callback time must be in the future" });
    }
    if (data.callbackAt.getTime() > now + MAX_CALLBACK_DAYS * 24 * 60 * 60 * 1000) {
      ctx.addIssue({ code: "custom", path: ["callbackAt"], message: "Callback must be within the next year" });
    }
  });

module.exports = {
  logCallSchema,
  updateStatusSchema,
  bulkStatusSchema,
  bulkDeleteSchema,
  createTaskSchema,
  updateTaskSchema,
  bulkAssignSchema,
};
