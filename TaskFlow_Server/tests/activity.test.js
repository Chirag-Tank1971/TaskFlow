import { describe, it, expect } from "vitest";
import { api, as, IDS } from "./helpers";
import { diffFields } from "../services/activityService";

describe("activity log API", () => {
  it("forbids agents from reading the global audit log", async () => {
    const res = await as("agent").get("/api/activity");
    expect(res.status).toBe(403);
  });

  it("requires authentication for task history", async () => {
    const res = await api().get(`/api/tasks/${IDS.user}/activity`);
    expect(res.status).toBe(401);
  });

  it("rejects task history requests with an invalid id", async () => {
    const res = await as("admin").get("/api/tasks/nope/activity");
    expect(res.status).toBe(400);
  });
});

describe("diffFields", () => {
  it("reports only real changes", () => {
    const changes = diffFields(
      { firstName: "Ann", phone: "123", notes: "", category: "General" },
      { firstName: "Ann", phone: "456", notes: undefined, category: "Sales" },
      ["firstName", "phone", "notes", "category"]
    );
    expect(changes).toEqual([
      { field: "phone", from: "123", to: "456" },
      { field: "category", from: "General", to: "Sales" },
    ]);
  });
});
