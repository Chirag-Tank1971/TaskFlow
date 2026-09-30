import { describe, it, expect } from "vitest";
import { api, as } from "./helpers";
import { chunkText } from "../services/chunker";
import { fileKind } from "../services/knowledgeService";
import { generationLimiter } from "../services/geminiRateLimiter";
import { toSimilarity, describeChromaError, getChromaStatus } from "../config/chroma";

describe("chunker", () => {
  it("returns no chunks for empty text", () => {
    expect(chunkText("   \n\n ")).toEqual([]);
  });

  it("keeps short text in one chunk", () => {
    expect(chunkText("Refunds are allowed within 30 days.")).toEqual(["Refunds are allowed within 30 days."]);
  });

  it("splits long text into bounded, overlapping chunks without losing content", () => {
    const paragraphs = Array.from({ length: 40 }, (_, i) => `Paragraph ${i}. ` + "word ".repeat(40).trim() + ".");
    const text = paragraphs.join("\n\n");
    const chunks = chunkText(text, { chunkSize: 1000, overlap: 150 });

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(1000 + 150 + 2));
    // Every paragraph marker appears somewhere
    paragraphs.forEach((_, i) => expect(chunks.some((c) => c.includes(`Paragraph ${i}.`))).toBe(true));
    // Consecutive chunks share some text (overlap)
    const tail = chunks[0].slice(-60).trim().split(" ").slice(-3).join(" ");
    expect(chunks[1]).toContain(tail);
  });

  it("hard-splits a single enormous paragraph", () => {
    const chunks = chunkText("x".repeat(5000), { chunkSize: 1000, overlap: 100 });
    expect(chunks.length).toBeGreaterThanOrEqual(5);
  });
});

describe("knowledge file types", () => {
  it("accepts supported extensions only", () => {
    expect(fileKind("Pricing.PDF")).toBe("pdf");
    expect(fileKind("policy.docx")).toBe("docx");
    expect(fileKind("faq.md")).toBe("text");
    expect(fileKind("notes.txt")).toBe("text");
    expect(fileKind("sheet.xlsx")).toBeNull();
    expect(fileKind("script.exe")).toBeNull();
  });
});

describe("knowledge API access control & validation", () => {
  it("requires login to ask", async () => {
    const res = await api().post("/api/knowledge/ask").send({ question: "What is the refund policy?" });
    expect(res.status).toBe(401);
  });

  it("rejects too-short questions", async () => {
    const res = await as("agent").post("/api/knowledge/ask").send({ question: "?" });
    expect(res.status).toBe(400);
  });

  it("forbids agents from uploading documents", async () => {
    const res = await as("agent").post("/api/knowledge/documents").attach("file", Buffer.from("hello"), "faq.txt");
    expect(res.status).toBe(403);
  });

  it("forbids agents from reading the question log", async () => {
    const res = await as("agent").get("/api/knowledge/queries");
    expect(res.status).toBe(403);
  });

  it("rejects unsupported document types", async () => {
    const res = await as("admin").post("/api/knowledge/documents").attach("file", Buffer.from("MZ"), "virus.exe");
    expect(res.status).toBe(400);
  });

  it("rejects Call Assist with an invalid task id", async () => {
    const res = await as("agent").post("/api/tasks/nope/assist");
    expect(res.status).toBe(400);
  });
});

describe("Chroma Cloud helpers", () => {
  it("converts distances to similarity for each distance space", () => {
    // unit vectors with cosine similarity 0.8
    expect(toSimilarity("cosine", 0.2)).toBeCloseTo(0.8);
    expect(toSimilarity("ip", 0.2)).toBeCloseTo(0.8);
    expect(toSimilarity("l2", 0.4)).toBeCloseTo(0.8); // squared l2 = 2 - 2·cos
    expect(toSimilarity("cosine", null)).toBe(0);
  });

  it("explains missing configuration", () => {
    const msg = describeChromaError(Object.assign(new Error("Chroma Cloud is not configured: set CHROMA_API_KEY"), { code: "CHROMA_NOT_CONFIGURED" }));
    expect(msg).toMatch(/isn't set up.*CHROMA_API_KEY/);
  });

  it("explains rejected credentials, missing databases and connectivity problems", () => {
    expect(describeChromaError(Object.assign(new Error("Unauthorized"), { name: "ChromaAuthError" }))).toMatch(/rejected the API key/);
    expect(
      describeChromaError(Object.assign(new Error("You do not have permission to access the requested resource."), { name: "ChromaForbiddenError" }))
    ).toMatch(/isn't allowed to use tenant .* database .*case-sensitive/);
    expect(describeChromaError(Object.assign(new Error("Database taskflow not found"), { name: "ChromaNotFoundError" }))).toMatch(/wasn't found/);
    expect(describeChromaError(new TypeError("fetch failed"))).toMatch(/Can't reach Chroma Cloud/);
    expect(describeChromaError(new Error("something unrelated"))).toBeNull();
  });

  it("reports an unconfigured knowledge base instead of crashing", async () => {
    const saved = { ...process.env };
    delete process.env.CHROMA_API_KEY;
    const status = await getChromaStatus();
    Object.assign(process.env, saved);
    expect(status.ok).toBe(false);
    expect(status.error).toMatch(/isn't set up/);
  });
});

describe("shared Gemini rate limiter", () => {
  it("stops granting requests once the budget is spent", () => {
    generationLimiter.exhaust();
    expect(generationLimiter.tryAcquire()).toBe(false);
    expect(generationLimiter.secondsUntilReset()).toBeGreaterThan(0);
  });
});
