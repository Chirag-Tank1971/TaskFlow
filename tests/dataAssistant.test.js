import { describe, it, expect } from "vitest";
import { api, as } from "./helpers";
import { runTool, ToolError, buildTaskQuery, functionDeclarations, tools } from "../services/dataQueryTools";
import { buildSystemPrompt } from "../services/dataAssistantService";

describe("data assistant API", () => {
  it("is restricted to admins and managers", async () => {
    const res = await as("agent").post("/api/data/ask").send({ question: "show urgent tasks" });
    expect(res.status).toBe(403);
  });

  it("requires login", async () => {
    const res = await api().post("/api/data/ask").send({ question: "show urgent tasks" });
    expect(res.status).toBe(401);
  });

  it("validates the question", async () => {
    const res = await as("admin").post("/api/data/ask").send({ question: "x" });
    expect(res.status).toBe(400);
  });
});

describe("read-only tool safety", () => {
  it("exposes only read tools to the model", () => {
    const names = functionDeclarations.map((f) => f.name).sort();
    expect(names).toEqual(["agent_workload", "count_tasks", "reply", "search_activity", "search_tasks", "upload_history"]);
    // No tool name suggests a write
    names.forEach((n) => expect(n).not.toMatch(/create|update|delete|assign|set|remove/));
  });

  it("rejects unknown tools", async () => {
    await expect(runTool("delete_all_tasks", {})).rejects.toBeInstanceOf(ToolError);
  });

  it("rejects values outside the allowed enums", async () => {
    await expect(runTool("search_tasks", { categories: ["Urgent", "$where"] })).rejects.toBeInstanceOf(ToolError);
  });

  it("rejects Mongo operators smuggled in as parameters", async () => {
    await expect(runTool("search_tasks", { customerName: { $ne: null } })).rejects.toBeInstanceOf(ToolError);
  });

  it("caps result size", async () => {
    await expect(runTool("search_tasks", { limit: 5000 })).rejects.toBeInstanceOf(ToolError);
  });

  it("accepts limits within the cap", () => {
    const parsed = tools.search_tasks.schema.safeParse({ limit: 10 });
    expect(parsed.success).toBe(true);
  });

  it("reply tool returns a message without touching the database", async () => {
    const { result } = await runTool("reply", { message: "This assistant is read-only." });
    expect(result).toEqual({ entity: "message", message: "This assistant is read-only." });
  });

  it("agent tool never selects password fields", () => {
    const src = tools.agent_workload.run.toString();
    expect(src).toMatch(/select\("name email status"\)/);
    expect(src).not.toMatch(/password/);
  });
});

describe("filter translation", () => {
  it("builds an urgent + open query", async () => {
    const { query, caption } = await buildTaskQuery({ categories: ["Urgent"], statuses: ["pending", "in-progress"] });
    expect(query).toEqual({ category: { $in: ["Urgent"] }, status: { $in: ["pending", "in-progress"] } });
    expect(caption.join(" · ")).toBe("Urgent · pending + in-progress");
  });

  it("escapes free text so it can't act as a regex", async () => {
    const { query } = await buildTaskQuery({ text: "a.*(" });
    const rx = query.$and[0].$or[0].firstName;
    expect(rx.source).toBe("a\\.\\*\\(");
  });

  it("overdue callbacks exclude completed tasks", async () => {
    const { query } = await buildTaskQuery({ callbackDue: true });
    expect(query.status).toEqual({ $ne: "completed" });
    expect(query.callbackAt.$lte).toBeInstanceOf(Date);
  });

  it("'never called' maps to outcome none", async () => {
    const { query } = await buildTaskQuery({ outcomes: ["none"] });
    expect(query.$and[0]).toEqual({ $or: [{ outcome: null }] });
  });
});

describe("system prompt", () => {
  it("includes the admin's local time and timezone", () => {
    const prompt = buildSystemPrompt("Asia/Kolkata");
    expect(prompt).toContain("Asia/Kolkata");
    expect(prompt).toMatch(/UTC now \d{4}-\d{2}-\d{2}T/);
  });
});
