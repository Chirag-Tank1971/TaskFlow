import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRequire } from "module";

// Load through Node's CommonJS require so the test and geminiGenerate share one module instance
const require = createRequire(import.meta.url);
const gemini = require("../services/geminiClient");
const { generationLimiter } = require("../services/geminiRateLimiter");
const { generateContent, AiBusyError, AiUnavailableError, isTransientError } = require("../services/geminiGenerate");

const MODELS = ["primary-model", "fallback-a", "fallback-b"];

const overloaded = () => Object.assign(new Error('{"error":{"code":503,"status":"UNAVAILABLE","message":"high demand"}}'), { status: 503 });
const dailyQuota = () =>
  Object.assign(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}}'), { status: 429 });
const minuteQuota = () => Object.assign(new Error("RESOURCE_EXHAUSTED: GenerateRequestsPerMinute"), { status: 429 });
const notFound = () => Object.assign(new Error("model not found"), { status: 404 });

/**
 * Stub the Gemini client. `byModel` maps a model name to a list of per-call behaviours
 * (an Error to throw, or text to return); the last behaviour repeats. Calls are recorded.
 */
const stubGemini = (byModel) => {
  const calls = [];
  const used = {};
  gemini.getGeminiClient = () => ({
    models: {
      generateContent: async ({ model }) => {
        calls.push(model);
        const script = byModel[model] || ["ok"];
        const step = script[Math.min(used[model] || 0, script.length - 1)];
        used[model] = (used[model] || 0) + 1;
        if (step instanceof Error) throw step;
        return { text: step };
      },
    },
  });
  return calls;
};

describe("geminiGenerate resilience", () => {
  const original = {
    client: gemini.getGeminiClient,
    chain: gemini.getModelChain,
    unavailable: gemini.markModelUnavailable,
    working: gemini.markModelWorking,
    tryAcquire: generationLimiter.tryAcquire,
  };
  let skipped;

  beforeEach(() => {
    skipped = [];
    gemini.getModelChain = () => MODELS;
    gemini.markModelUnavailable = (model, ms, reason) => skipped.push({ model, ms, reason });
    gemini.markModelWorking = () => {};
    generationLimiter.tryAcquire = () => true; // unlimited budget for these tests
  });

  afterEach(() => {
    gemini.getGeminiClient = original.client;
    gemini.getModelChain = original.chain;
    gemini.markModelUnavailable = original.unavailable;
    gemini.markModelWorking = original.working;
    generationLimiter.tryAcquire = original.tryAcquire;
  });

  it("retries a 503 on the same model and succeeds", async () => {
    const calls = stubGemini({ "primary-model": [overloaded(), "ok"] });
    const { response, model } = await generateContent({ contents: "hi" });
    expect(response.text).toBe("ok");
    expect(model).toBe("primary-model");
    expect(calls).toEqual(["primary-model", "primary-model"]);
  });

  it("falls back to the next model when the primary stays overloaded", async () => {
    const calls = stubGemini({ "primary-model": [overloaded()], "fallback-a": ["from fallback"] });
    const { response, model } = await generateContent({ contents: "hi" });
    expect(response.text).toBe("from fallback");
    expect(model).toBe("fallback-a");
    expect(calls).toEqual(["primary-model", "primary-model", "primary-model", "fallback-a"]);
  });

  it("switches model immediately when the primary's daily quota is used up, and skips it for an hour", async () => {
    const calls = stubGemini({ "primary-model": [dailyQuota()], "fallback-a": ["ok"] });
    const { model } = await generateContent({ contents: "hi" });
    expect(model).toBe("fallback-a");
    expect(calls).toEqual(["primary-model", "fallback-a"]); // no pointless retries on a quota error
    expect(skipped).toEqual([{ model: "primary-model", ms: 3600000, reason: "daily quota used up" }]);
  });

  it("skips a per-minute quota for about a minute only", async () => {
    stubGemini({ "primary-model": [minuteQuota()], "fallback-a": ["ok"] });
    await generateContent({ contents: "hi" });
    expect(skipped[0]).toMatchObject({ model: "primary-model", ms: 60000 });
  });

  it("skips models that don't exist for this key", async () => {
    stubGemini({ "primary-model": [notFound()], "fallback-a": ["ok"] });
    const { model } = await generateContent({ contents: "hi" });
    expect(model).toBe("fallback-a");
    expect(skipped[0].reason).toMatch(/not available/);
  });

  it("reports a clear daily-quota message when every model is used up", async () => {
    stubGemini({ "primary-model": [dailyQuota()], "fallback-a": [dailyQuota()], "fallback-b": [minuteQuota()] });
    const err = await generateContent({ contents: "hi" }).catch((e) => e);
    expect(err).toBeInstanceOf(AiBusyError);
    expect(err.message).toMatch(/daily free quota is used up/);
    expect(err.retryAfter).toBeGreaterThanOrEqual(60);
  });

  it("gives a friendly AiUnavailableError when every model is overloaded", async () => {
    stubGemini({ "primary-model": [overloaded()], "fallback-a": [overloaded()], "fallback-b": [overloaded()] });
    await expect(generateContent({ contents: "hi" })).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it("does not retry or fall back on non-transient errors (e.g. bad request)", async () => {
    const calls = stubGemini({ "primary-model": [Object.assign(new Error("INVALID_ARGUMENT"), { status: 400 })] });
    await expect(generateContent({ contents: "hi" })).rejects.toThrow("INVALID_ARGUMENT");
    expect(calls).toHaveLength(1);
  });

  it("respects the shared per-minute budget before calling Google", async () => {
    const calls = stubGemini({});
    generationLimiter.tryAcquire = () => false;
    await expect(generateContent({ contents: "hi" })).rejects.toBeInstanceOf(AiBusyError);
    expect(calls).toHaveLength(0);
  });

  it("classifies transient errors", () => {
    expect(isTransientError(overloaded())).toBe(true);
    expect(isTransientError(new Error("AI response timed out"))).toBe(true);
    expect(isTransientError(Object.assign(new Error("bad"), { status: 400 }))).toBe(false);
  });
});

describe("geminiClient model chain", () => {
  it("skips a model marked unavailable, then restores it once it works again", () => {
    const { getModelChain, markModelUnavailable, markModelWorking, PRIMARY_MODEL } = gemini;
    markModelUnavailable(PRIMARY_MODEL, 60000, "test");
    expect(getModelChain()).not.toContain(PRIMARY_MODEL);
    markModelWorking(PRIMARY_MODEL);
    expect(getModelChain()[0]).toBe(PRIMARY_MODEL);
  });
});
