import { describe, it, expect } from "vitest";
import { api, as, tokenFor } from "./helpers";

describe("platform", () => {
  it("serves /health with Helmet security headers", async () => {
    const res = await api().get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", service: "TaskFlow_Server" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("returns JSON 404 for unknown API routes", async () => {
    const res = await api().get("/api/does-not-exist-xyz");
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/route not found/i);
  });

  it("does not trust arbitrary *.vercel.app origins", async () => {
    const res = await api().get("/health").set("Origin", "https://attacker.vercel.app");
    expect(res.status).toBe(403);
  });
});

describe("authentication", () => {
  it("validates the login body", async () => {
    const res = await api().post("/api/auth/login").send({ email: "invalid-email-format", password: "123" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
  });

  it("protects /api/tasks", async () => {
    const res = await api().get("/api/tasks");
    expect(res.status).toBe(401);
    expect(res.body.message).toContain("Access Denied");
  });

  it("protects /api/upload", async () => {
    const res = await api().post("/api/upload");
    expect(res.status).toBe(401);
  });

  it("does not accept a token in the query string", async () => {
    const res = await api().get(`/api/tasks?token=${tokenFor("admin")}`);
    expect(res.status).toBe(401);
  });

  it("rejects tokens without a role instead of guessing one", async () => {
    const res = await as("admin", { id: undefined, role: undefined, email: "someone@example.com" }).get("/api/tasks");
    expect(res.status).toBe(401);
  });

  it("rejects public signup as manager", async () => {
    const res = await api()
      .post("/api/auth/signup")
      .send({ name: "Mallory", email: "mallory@example.com", password: "secret123", role: "manager" });
    expect(res.status).toBe(400);
  });
});
