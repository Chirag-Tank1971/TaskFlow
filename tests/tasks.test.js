import { describe, it, expect } from "vitest";
import { as, IDS } from "./helpers";

describe("task management", () => {
  it("forbids agents from creating tasks", async () => {
    const res = await as("agent").post("/api/tasks").send({ firstName: "Jane" });
    expect(res.status).toBe(403);
  });

  it("validates task creation input", async () => {
    const res = await as("admin").post("/api/tasks").send({ firstName: "", phone: "call me maybe" });
    expect(res.status).toBe(400);
  });

  it("rejects edits with an invalid task id", async () => {
    const res = await as("admin").patch("/api/tasks/not-an-id").send({ notes: "hello" });
    expect(res.status).toBe(400);
  });

  it("forbids agents from bulk reassigning", async () => {
    const res = await as("agent")
      .post("/api/tasks/bulk/assign")
      .send({ taskIds: [IDS.task], agentId: IDS.otherAgent });
    expect(res.status).toBe(403);
  });
});

describe("call logging validation", () => {
  const logCall = (body) => as("agent").post(`/api/tasks/${IDS.task}/calls`).send(body);

  it("rejects unknown outcomes", async () => {
    const res = await logCall({ outcome: "hung-up-angrily" });
    expect(res.status).toBe(400);
  });

  it("requires a callback time for callback outcomes", async () => {
    const res = await logCall({ outcome: "callback" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/date and time/i);
  });

  it("rejects callbacks scheduled in the past", async () => {
    const res = await logCall({ outcome: "callback", callbackAt: new Date(Date.now() - 3600e3).toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/future/i);
  });

  it("rejects overly long call notes", async () => {
    const res = await logCall({ outcome: "no-answer", note: "x".repeat(1001) });
    expect(res.status).toBe(400);
  });
});
