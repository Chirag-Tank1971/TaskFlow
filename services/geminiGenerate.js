// Accessed through the module object (not destructured) so tests can stub the client
const gemini = require("./geminiClient");
const { generationLimiter } = require("./geminiRateLimiter");

/**
 * Resilient Gemini generation, used by every AI feature (categorization, knowledge base,
 * Call Assist, data assistant).
 *
 * Per model, in order (primary, then GEMINI_FALLBACK_MODELS):
 * - 429 quota        → skip this model (1 h for a daily quota, ~1 min for a per-minute one), try the next
 * - 500/503 overload → retry briefly, then try the next model
 * - 404 not found    → skip this model for a day, try the next
 * - other errors     → fail immediately (retrying won't help)
 * All models unavailable → AiBusyError (quota) or AiUnavailableError (overload), with friendly messages.
 */
const TIMEOUT_MS = 20000;
const RETRY_DELAYS_MS = process.env.NODE_ENV === "test" ? [1, 1] : [800, 2000]; // per model, for transient overloads
const HOUR = 60 * 60 * 1000;

class AiBusyError extends Error {
  constructor(retryAfterSeconds, message) {
    super(message || `The AI assistant is busy. Try again in ${retryAfterSeconds} seconds.`);
    this.retryAfter = retryAfterSeconds;
  }
}

class AiUnavailableError extends Error {
  constructor() {
    super("Google's AI service is overloaded right now. Please try again in a minute.");
  }
}

const statusOf = (err) => Number(err?.status ?? err?.code ?? err?.error?.code);
const isQuotaError = (err) => statusOf(err) === 429 || /RESOURCE_EXHAUSTED|quota/i.test(err?.message || "");
// Overloaded / temporarily unavailable / internal / timed out: worth retrying or switching model
const isTransientError = (err) =>
  [500, 502, 503, 504].includes(statusOf(err)) ||
  /UNAVAILABLE|overloaded|high demand|INTERNAL|timed out/i.test(err?.message || "");

// Daily quotas reset at midnight Pacific; per-minute ones within a minute
const isDailyQuota = (err) => /PerDay|per day|daily/i.test(err?.message || "");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {object} request - generateContent params without `model` ({ contents, config })
 * @returns {Promise<{ response, model }>} the raw SDK response and the model that answered
 */
const generateContent = async (request) => {
  // Our own per-minute budget: one unit per user action, however many models we try
  if (!generationLimiter.tryAcquire()) {
    throw new AiBusyError(generationLimiter.secondsUntilReset());
  }

  const ai = gemini.getGeminiClient();
  const models = gemini.getModelChain();
  let sawQuota = false;
  let sawDailyQuota = false;
  let lastError;

  for (const model of models) {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const response = await Promise.race([
          ai.models.generateContent({ ...request, model }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("AI response timed out")), TIMEOUT_MS)),
        ]);
        gemini.markModelWorking(model);
        if (model !== models[0]) console.warn(`[Gemini] Answered with fallback model ${model}`);
        return { response, model };
      } catch (err) {
        lastError = err;
        if (isQuotaError(err)) {
          sawQuota = true;
          const daily = isDailyQuota(err);
          sawDailyQuota ||= daily;
          gemini.markModelUnavailable(model, daily ? HOUR : 60 * 1000, daily ? "daily quota used up" : "per-minute quota");
          break; // next model
        }
        if (statusOf(err) === 404) {
          gemini.markModelUnavailable(model, 24 * HOUR, "model not available for this API key");
          break;
        }
        if (!isTransientError(err)) throw err; // bad request etc.: retrying won't help
        if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  if (sawQuota || models.length === 0) {
    const retryAfter = Math.max(60, Math.ceil(gemini.msUntilAnyModelAvailable() / 1000));
    console.error(`[Gemini] All models out of quota${sawDailyQuota ? " (daily limit)" : ""}`);
    throw new AiBusyError(
      retryAfter,
      sawDailyQuota || models.length === 0
        ? "The AI's daily free quota is used up. It resets at midnight Pacific time (or add a paid Gemini key)."
        : undefined
    );
  }

  console.error("[Gemini] All models unavailable:", lastError?.message?.slice(0, 200));
  throw new AiUnavailableError();
};

module.exports = { generateContent, AiBusyError, AiUnavailableError, isTransientError, isQuotaError };
