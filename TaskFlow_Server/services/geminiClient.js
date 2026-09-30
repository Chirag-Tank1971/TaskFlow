const { GoogleGenAI } = require("@google/genai");

/**
 * Gemini client and model selection, shared by every AI feature.
 *
 *   GEMINI_MODEL            primary model (default gemini-2.5-flash)
 *   GEMINI_FALLBACK_MODELS  comma-separated models tried in order when the primary is
 *                           out of quota or overloaded. Each model has its OWN free-tier
 *                           quota, so fallbacks keep the app working when one runs out.
 *
 * No test/probe requests are made: probing costs quota, which is scarce on the free tier.
 */
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-flash-latest")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m && m !== PRIMARY_MODEL);

let client = null;

const getGeminiClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }
  if (!client) client = new GoogleGenAI({}); // reads GEMINI_API_KEY from the environment
  return client;
};

// model -> timestamp until which we skip it (quota exhausted / not available)
const unavailableUntil = new Map();
let lastWorkingModel = null;

const isModelAvailable = (model) => (unavailableUntil.get(model) || 0) <= Date.now();

const markModelUnavailable = (model, ms, reason) => {
  unavailableUntil.set(model, Date.now() + ms);
  console.warn(`[Gemini] Skipping ${model} for ${Math.round(ms / 60000)} min (${reason})`);
};

const markModelWorking = (model) => {
  lastWorkingModel = model;
  unavailableUntil.delete(model);
};

/** Models to try, in order, skipping ones known to be out of quota. */
const getModelChain = () => [PRIMARY_MODEL, ...FALLBACK_MODELS].filter(isModelAvailable);

/** Earliest time any model becomes available again (ms from now), for "try again in" messages. */
const msUntilAnyModelAvailable = () => {
  const times = [PRIMARY_MODEL, ...FALLBACK_MODELS].map((m) => unavailableUntil.get(m) || 0);
  return Math.max(0, Math.min(...times) - Date.now());
};

const getModelStatus = () => ({
  primary: PRIMARY_MODEL,
  fallbacks: FALLBACK_MODELS,
  lastWorkingModel,
  skipped: [...unavailableUntil.entries()]
    .filter(([, until]) => until > Date.now())
    .map(([model, until]) => ({ model, until: new Date(until).toISOString() })),
});

module.exports = {
  getGeminiClient,
  getModelChain,
  markModelUnavailable,
  markModelWorking,
  msUntilAnyModelAvailable,
  getModelStatus,
  PRIMARY_MODEL,
  FALLBACK_MODELS,
};
