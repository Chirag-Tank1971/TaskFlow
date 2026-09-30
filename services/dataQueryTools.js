/**
 * Read-only "tools" the admin data assistant can call.
 *
 * Safety model: the AI never writes database queries. It can only pick one of these tools and
 * fill in its parameters; every parameter is validated with zod, and each tool builds its own
 * MongoDB query that reads an allow-listed set of fields. No tool can modify data, and none
 * can return passwords or other secrets.
 */
const { z } = require("zod");
const Task = require("../models/Task");
const Agent = require("../models/Agent");
const Activity = require("../models/Activity");
const Upload = require("../models/Upload");
const escapeRegex = require("../utils/escapeRegex");
const { OUTCOME_KEYS } = require("../constants/callOutcomes");

const MAX_ROWS = 100;
const CATEGORIES = ["Support", "Sales", "Technical", "Billing", "Urgent", "General"];
const STATUSES = ["pending", "in-progress", "completed"];
const OUTCOMES_WITH_NONE = [...OUTCOME_KEYS, "none"]; // "none" = never called
const AGENT_STATUSES = ["Available", "Not-Available", "Decommissioned"];
const ACTIVITY_TYPES = Activity.ACTIVITY_TYPES;

// Fields a task row may expose (tasks hold no secrets, but keep payloads lean)
const TASK_FIELDS = "firstName phone notes category categorySource status outcome callbackAt attempts lastContactedAt completedDate createdAt updatedAt agent callLogs";

// ---------- shared parameter pieces ----------

const isoDate = z.string().trim().refine((s) => !isNaN(new Date(s).getTime()), "Invalid date");
const nameText = z.string().trim().min(1).max(100);

const taskFilterShape = {
  categories: z.array(z.enum(CATEGORIES)).max(6).optional(),
  statuses: z.array(z.enum(STATUSES)).max(3).optional(),
  outcomes: z.array(z.enum(OUTCOMES_WITH_NONE)).max(8).optional(),
  agentName: nameText.optional(),
  customerName: nameText.optional(),
  text: z.string().trim().min(1).max(100).optional(),
  callbackDue: z.boolean().optional(),
  hasCallback: z.boolean().optional(),
  notContactedForDays: z.number().int().min(0).max(3650).optional(),
  minAttempts: z.number().int().min(0).max(1000).optional(),
  maxAttempts: z.number().int().min(0).max(1000).optional(),
  createdFrom: isoDate.optional(),
  createdTo: isoDate.optional(),
  completedFrom: isoDate.optional(),
  completedTo: isoDate.optional(),
};

const taskFilterJsonSchema = {
  categories: { type: "array", items: { type: "string", enum: CATEGORIES }, description: "Task categories to include" },
  statuses: { type: "array", items: { type: "string", enum: STATUSES }, description: "Task statuses to include. 'open' tasks means pending + in-progress." },
  outcomes: {
    type: "array",
    items: { type: "string", enum: OUTCOMES_WITH_NONE },
    description: "Latest call outcome. 'none' means the lead was never called.",
  },
  agentName: { type: "string", description: "Assigned agent's name (partial match)" },
  customerName: { type: "string", description: "Customer/lead first name (partial match)" },
  text: { type: "string", description: "Free-text search in customer name, phone and notes" },
  callbackDue: { type: "boolean", description: "Only open tasks whose scheduled callback time has passed (overdue callbacks)" },
  hasCallback: { type: "boolean", description: "Only open tasks with any scheduled callback (due or upcoming)" },
  notContactedForDays: { type: "integer", description: "Only tasks not called in at least this many days (including never called)" },
  minAttempts: { type: "integer", description: "Minimum number of call attempts" },
  maxAttempts: { type: "integer", description: "Maximum number of call attempts (0 = never called)" },
  createdFrom: { type: "string", description: "ISO 8601 datetime; tasks created at or after" },
  createdTo: { type: "string", description: "ISO 8601 datetime; tasks created at or before" },
  completedFrom: { type: "string", description: "ISO 8601 datetime; tasks completed at or after" },
  completedTo: { type: "string", description: "ISO 8601 datetime; tasks completed at or before" },
};

const findAgentIds = async (agentName) => {
  const agents = await Agent.find({ name: new RegExp(escapeRegex(agentName), "i") }).select("_id name").lean();
  return agents;
};

/**
 * Translate validated task filters into a MongoDB query plus a human-readable caption.
 */
const buildTaskQuery = async (f) => {
  const query = {};
  const caption = [];
  const now = new Date();

  if (f.categories?.length) {
    query.category = { $in: f.categories };
    caption.push(f.categories.join(", "));
  }
  if (f.statuses?.length) {
    query.status = { $in: f.statuses };
    caption.push(f.statuses.join(" + "));
  }
  if (f.outcomes?.length) {
    const real = f.outcomes.filter((o) => o !== "none");
    const conds = [];
    if (real.length) conds.push({ outcome: { $in: real } });
    if (f.outcomes.includes("none")) conds.push({ outcome: null });
    query.$and = [...(query.$and || []), { $or: conds }];
    caption.push(`outcome: ${f.outcomes.join(", ")}`);
  }
  if (f.agentName) {
    const agents = await findAgentIds(f.agentName);
    query.agent = { $in: agents.map((a) => a._id) };
    caption.push(agents.length ? `agent: ${agents.map((a) => a.name).join(", ")}` : `agent "${f.agentName}" (no match)`);
  }
  if (f.customerName) {
    query.firstName = new RegExp(escapeRegex(f.customerName), "i");
    caption.push(`customer ~ "${f.customerName}"`);
  }
  if (f.text) {
    const rx = new RegExp(escapeRegex(f.text), "i");
    query.$and = [...(query.$and || []), { $or: [{ firstName: rx }, { phone: rx }, { notes: rx }] }];
    caption.push(`matching "${f.text}"`);
  }
  if (f.callbackDue) {
    query.callbackAt = { $ne: null, $lte: now };
    query.status = query.status || { $ne: "completed" };
    caption.push("callback overdue");
  } else if (f.hasCallback) {
    query.callbackAt = { $ne: null };
    query.status = query.status || { $ne: "completed" };
    caption.push("callback scheduled");
  }
  if (f.notContactedForDays !== undefined) {
    const cutoff = new Date(now.getTime() - f.notContactedForDays * 86400000);
    query.$and = [...(query.$and || []), { $or: [{ lastContactedAt: null }, { lastContactedAt: { $lt: cutoff } }] }];
    caption.push(`not called in ${f.notContactedForDays}+ days`);
  }
  if (f.minAttempts !== undefined || f.maxAttempts !== undefined) {
    query.attempts = {
      ...(f.minAttempts !== undefined && { $gte: f.minAttempts }),
      ...(f.maxAttempts !== undefined && { $lte: f.maxAttempts }),
    };
    caption.push(
      f.maxAttempts === 0 ? "never called" : `attempts ${f.minAttempts ?? 0}–${f.maxAttempts ?? "∞"}`
    );
  }
  const range = (from, to, field, label) => {
    if (!from && !to) return;
    query[field] = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) };
    const fmt = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    caption.push(`${label} ${from ? fmt(from) : "…"} – ${to ? fmt(to) : "now"}`);
  };
  range(f.createdFrom, f.createdTo, "createdAt", "created");
  range(f.completedFrom, f.completedTo, "completedDate", "completed");

  return { query, caption };
};

// ---------- tools ----------

const tools = {
  search_tasks: {
    description:
      "List individual tasks/leads matching filters. Use for questions like 'show urgent tasks', 'overdue callbacks', 'leads Priya converted this week', 'tasks never called'.",
    jsonSchema: {
      type: "object",
      properties: {
        ...taskFilterJsonSchema,
        sortBy: { type: "string", enum: ["createdAt", "updatedAt", "callbackAt", "attempts", "lastContactedAt", "completedDate"] },
        sortOrder: { type: "string", enum: ["asc", "desc"] },
        limit: { type: "integer", description: `Max rows, 1-${MAX_ROWS} (default 25)` },
      },
    },
    schema: z.object({
      ...taskFilterShape,
      sortBy: z.enum(["createdAt", "updatedAt", "callbackAt", "attempts", "lastContactedAt", "completedDate"]).optional(),
      sortOrder: z.enum(["asc", "desc"]).optional(),
      limit: z.number().int().min(1).max(MAX_ROWS).optional(),
    }),
    run: async (args) => {
      const { query, caption } = await buildTaskQuery(args);
      const sortBy = args.sortBy || (args.callbackDue || args.hasCallback ? "callbackAt" : "createdAt");
      const sortOrder = args.sortOrder || (sortBy === "callbackAt" ? "asc" : "desc");
      const limit = args.limit || 25;

      const [total, tasks] = await Promise.all([
        Task.countDocuments(query),
        Task.find(query)
          .select(TASK_FIELDS)
          .populate("agent", "name email status")
          .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
          .limit(limit)
          .lean(),
      ]);

      return {
        entity: "task",
        caption: caption.length ? caption.join(" · ") : "all tasks",
        total,
        columns: [
          { key: "firstName", label: "Customer" },
          { key: "phone", label: "Phone" },
          { key: "category", label: "Category", type: "badge" },
          { key: "status", label: "Status", type: "badge" },
          { key: "outcome", label: "Last outcome", type: "badge" },
          { key: "agentName", label: "Agent" },
          { key: "attempts", label: "Calls", type: "number" },
          { key: sortBy === "createdAt" ? "createdAt" : sortBy, label: sortBy === "createdAt" ? "Created" : sortBy.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), type: sortBy === "attempts" ? "number" : "date" },
        ].filter((c, i, arr) => arr.findIndex((x) => x.key === c.key) === i),
        rows: tasks.map((t) => ({ ...t, _id: t._id.toString(), agentName: t.agent?.name || "—", callLogs: undefined })),
        records: tasks, // full task objects so the client can open task details
      };
    },
  },

  count_tasks: {
    description:
      "Count tasks, optionally grouped. Use for 'how many', totals, and breakdowns like 'tasks per category' or 'converted leads per agent this month'.",
    jsonSchema: {
      type: "object",
      properties: {
        ...taskFilterJsonSchema,
        groupBy: { type: "string", enum: ["none", "category", "status", "outcome", "agent"], description: "How to break down the count" },
      },
    },
    schema: z.object({ ...taskFilterShape, groupBy: z.enum(["none", "category", "status", "outcome", "agent"]).optional() }),
    run: async (args) => {
      const { query, caption } = await buildTaskQuery(args);
      const groupBy = args.groupBy || "none";
      const baseCaption = caption.length ? caption.join(" · ") : "all tasks";

      if (groupBy === "none") {
        const count = await Task.countDocuments(query);
        return {
          entity: "count",
          caption: baseCaption,
          total: 1,
          columns: [{ key: "count", label: "Tasks", type: "number" }],
          rows: [{ count }],
        };
      }

      const groups = await Task.aggregate([
        { $match: query },
        { $group: { _id: `$${groupBy}`, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: MAX_ROWS },
      ]);

      let labels = new Map();
      if (groupBy === "agent") {
        const agents = await Agent.find({ _id: { $in: groups.map((g) => g._id).filter(Boolean) } }).select("name").lean();
        labels = new Map(agents.map((a) => [a._id.toString(), a.name]));
      }

      return {
        entity: "breakdown",
        caption: `${baseCaption} · by ${groupBy}`,
        total: groups.length,
        columns: [
          { key: "group", label: groupBy.charAt(0).toUpperCase() + groupBy.slice(1), type: groupBy === "agent" ? "text" : "badge" },
          { key: "count", label: "Tasks", type: "number" },
        ],
        rows: groups.map((g) => ({
          group:
            groupBy === "agent"
              ? labels.get(g._id?.toString()) || "Unassigned / deleted"
              : g._id ?? (groupBy === "outcome" ? "none" : "—"),
          count: g.count,
        })),
      };
    },
  },

  agent_workload: {
    description:
      "Per-agent workload and performance: open, completed, converted tasks and overdue callbacks. Use for 'who is busiest', 'agent performance', 'which agents are available'.",
    jsonSchema: {
      type: "object",
      properties: {
        agentName: { type: "string", description: "Only agents whose name matches" },
        agentStatuses: { type: "array", items: { type: "string", enum: AGENT_STATUSES } },
        sortBy: { type: "string", enum: ["open", "completed", "converted", "callbacksDue", "total", "name"] },
      },
    },
    schema: z.object({
      agentName: nameText.optional(),
      agentStatuses: z.array(z.enum(AGENT_STATUSES)).max(3).optional(),
      sortBy: z.enum(["open", "completed", "converted", "callbacksDue", "total", "name"]).optional(),
    }),
    run: async (args) => {
      const agentQuery = {};
      const caption = [];
      if (args.agentName) {
        agentQuery.name = new RegExp(escapeRegex(args.agentName), "i");
        caption.push(`agent ~ "${args.agentName}"`);
      }
      if (args.agentStatuses?.length) {
        agentQuery.status = { $in: args.agentStatuses };
        caption.push(args.agentStatuses.join(", "));
      }

      // Only non-sensitive agent fields are ever selected
      const agents = await Agent.find(agentQuery).select("name email status").lean();
      const now = new Date();
      const stats = await Task.aggregate([
        { $match: { agent: { $in: agents.map((a) => a._id) } } },
        {
          $group: {
            _id: "$agent",
            total: { $sum: 1 },
            open: { $sum: { $cond: [{ $ne: ["$status", "completed"] }, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            converted: { $sum: { $cond: [{ $eq: ["$outcome", "converted"] }, 1, 0] } },
            callbacksDue: {
              $sum: {
                $cond: [
                  { $and: [{ $ne: ["$status", "completed"] }, { $ne: ["$callbackAt", null] }, { $lte: ["$callbackAt", now] }] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]);
      const byAgent = new Map(stats.map((s) => [s._id.toString(), s]));

      const sortBy = args.sortBy || "open";
      const rows = agents
        .map((a) => {
          const s = byAgent.get(a._id.toString()) || {};
          return {
            name: a.name,
            email: a.email,
            status: a.status,
            total: s.total || 0,
            open: s.open || 0,
            completed: s.completed || 0,
            converted: s.converted || 0,
            callbacksDue: s.callbacksDue || 0,
          };
        })
        .sort((x, y) => (sortBy === "name" ? x.name.localeCompare(y.name) : y[sortBy] - x[sortBy]))
        .slice(0, MAX_ROWS);

      return {
        entity: "agent",
        caption: `${caption.length ? caption.join(" · ") : "all agents"} · sorted by ${sortBy}`,
        total: rows.length,
        columns: [
          { key: "name", label: "Agent" },
          { key: "status", label: "Status", type: "badge" },
          { key: "open", label: "Open", type: "number" },
          { key: "completed", label: "Completed", type: "number" },
          { key: "converted", label: "Converted", type: "number" },
          { key: "callbacksDue", label: "Callbacks due", type: "number" },
          { key: "total", label: "Total", type: "number" },
        ],
        rows,
      };
    },
  },

  search_activity: {
    description:
      "Search the audit log of changes to tasks: who created, edited, reassigned, deleted, changed status or logged calls, and when.",
    jsonSchema: {
      type: "object",
      properties: {
        types: { type: "array", items: { type: "string", enum: ACTIVITY_TYPES } },
        actorName: { type: "string", description: "Name of the person who did it (partial match)" },
        customerName: { type: "string", description: "Customer/lead name (partial match)" },
        from: { type: "string", description: "ISO 8601 datetime" },
        to: { type: "string", description: "ISO 8601 datetime" },
        limit: { type: "integer", description: `Max rows, 1-${MAX_ROWS} (default 25)` },
      },
    },
    schema: z.object({
      types: z.array(z.enum(ACTIVITY_TYPES)).max(ACTIVITY_TYPES.length).optional(),
      actorName: nameText.optional(),
      customerName: nameText.optional(),
      from: isoDate.optional(),
      to: isoDate.optional(),
      limit: z.number().int().min(1).max(MAX_ROWS).optional(),
    }),
    run: async (args) => {
      const query = {};
      const caption = [];
      if (args.types?.length) {
        query.type = { $in: args.types };
        caption.push(args.types.join(", "));
      }
      if (args.actorName) {
        query["actor.name"] = new RegExp(escapeRegex(args.actorName), "i");
        caption.push(`by ~ "${args.actorName}"`);
      }
      if (args.customerName) {
        query.taskName = new RegExp(escapeRegex(args.customerName), "i");
        caption.push(`customer ~ "${args.customerName}"`);
      }
      if (args.from || args.to) {
        query.createdAt = { ...(args.from && { $gte: new Date(args.from) }), ...(args.to && { $lte: new Date(args.to) }) };
        caption.push("in date range");
      }
      const limit = args.limit || 25;
      const [total, activities] = await Promise.all([
        Activity.countDocuments(query),
        Activity.find(query).sort({ createdAt: -1 }).limit(limit).lean(),
      ]);
      return {
        entity: "activity",
        caption: caption.length ? caption.join(" · ") : "all activity",
        total,
        columns: [
          { key: "createdAt", label: "When", type: "date" },
          { key: "actorName", label: "Who" },
          { key: "type", label: "Action", type: "badge" },
          { key: "taskName", label: "Customer" },
          { key: "detail", label: "Detail" },
        ],
        rows: activities.map((a) => ({
          _id: a._id.toString(),
          createdAt: a.createdAt,
          actorName: a.actor?.role === "system" ? "TaskFlow AI" : a.actor?.name || "—",
          type: a.type,
          taskName: a.taskName || "—",
          detail:
            (a.changes || [])
              .map((c) => `${c.field}: ${typeof c.from === "object" ? c.from?.name ?? "—" : c.from ?? "—"} → ${typeof c.to === "object" ? c.to?.name ?? "—" : c.to ?? "—"}`)
              .join("; ") ||
            a.meta?.outcome ||
            "",
        })),
      };
    },
  },

  upload_history: {
    description: "CSV upload history: when files were imported, by whom, how many tasks were created, and failures.",
    jsonSchema: {
      type: "object",
      properties: {
        statuses: { type: "array", items: { type: "string", enum: ["processing", "success", "failed"] } },
        from: { type: "string", description: "ISO 8601 datetime" },
        to: { type: "string", description: "ISO 8601 datetime" },
        limit: { type: "integer", description: `Max rows, 1-${MAX_ROWS} (default 25)` },
      },
    },
    schema: z.object({
      statuses: z.array(z.enum(["processing", "success", "failed"])).max(3).optional(),
      from: isoDate.optional(),
      to: isoDate.optional(),
      limit: z.number().int().min(1).max(MAX_ROWS).optional(),
    }),
    run: async (args) => {
      const query = {};
      const caption = [];
      if (args.statuses?.length) {
        query.status = { $in: args.statuses };
        caption.push(args.statuses.join(", "));
      }
      if (args.from || args.to) {
        query.createdAt = { ...(args.from && { $gte: new Date(args.from) }), ...(args.to && { $lte: new Date(args.to) }) };
        caption.push("in date range");
      }
      const limit = args.limit || 25;
      const [total, uploads] = await Promise.all([
        Upload.countDocuments(query),
        Upload.find(query)
          .select("filename status tasksCreated rowCount errorMessage processingTime uploadedBy createdAt")
          .populate("uploadedBy", "name") // name only, never credentials
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean(),
      ]);
      return {
        entity: "upload",
        caption: caption.length ? caption.join(" · ") : "all uploads",
        total,
        columns: [
          { key: "createdAt", label: "When", type: "date" },
          { key: "filename", label: "File" },
          { key: "status", label: "Status", type: "badge" },
          { key: "tasksCreated", label: "Tasks created", type: "number" },
          { key: "uploadedByName", label: "Uploaded by" },
          { key: "errorMessage", label: "Error" },
        ],
        rows: uploads.map((u) => ({
          _id: u._id.toString(),
          createdAt: u.createdAt,
          filename: u.filename,
          status: u.status,
          tasksCreated: u.tasksCreated || 0,
          uploadedByName: u.uploadedBy?.name || "—",
          errorMessage: u.errorMessage || "",
        })),
      };
    },
  },

  reply: {
    description:
      "Use ONLY when the question cannot be answered with the other tools (off-topic, asks to change data, or too ambiguous). Ask a short clarifying question or explain what you can do.",
    jsonSchema: {
      type: "object",
      properties: { message: { type: "string", description: "Short reply to the admin" } },
      required: ["message"],
    },
    schema: z.object({ message: z.string().trim().min(1).max(500) }),
    run: async (args) => ({ entity: "message", message: args.message }),
  },
};

/** Function declarations in the shape Gemini expects. */
const functionDeclarations = Object.entries(tools).map(([name, t]) => ({
  name,
  description: t.description,
  parametersJsonSchema: t.jsonSchema,
}));

/**
 * Validate and run one tool call from the model.
 * Throws a ToolError (with a user-facing message) for unknown tools or invalid arguments.
 */
class ToolError extends Error {}

const runTool = async (name, rawArgs = {}) => {
  const tool = tools[name];
  if (!tool) throw new ToolError(`The assistant tried an unknown action (${name}).`);

  // Models sometimes send numbers as strings; coerce the common cases before validation
  const args = { ...rawArgs };
  ["limit", "notContactedForDays", "minAttempts", "maxAttempts"].forEach((k) => {
    if (typeof args[k] === "string" && /^\d+$/.test(args[k])) args[k] = Number(args[k]);
  });

  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ToolError(`I couldn't understand part of that question (${issue.path.join(".") || "input"}: ${issue.message}). Try rephrasing.`);
  }
  return { tool: name, args: parsed.data, result: await tool.run(parsed.data) };
};

module.exports = { functionDeclarations, runTool, ToolError, tools, buildTaskQuery, MAX_ROWS };
