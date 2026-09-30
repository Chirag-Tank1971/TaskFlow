const { getGeminiClient } = require("./geminiClient");
const { embeddingLimiter } = require("./geminiRateLimiter");

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
// 768 dims keeps Chroma small and fast; changing it requires re-indexing everything
const EMBEDDING_DIMENSIONS = 768;
const BATCH_SIZE = 50;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRateLimitError = (err) =>
  err?.status === 429 || err?.code === 429 || /429|RESOURCE_EXHAUSTED|quota/i.test(err?.message || "");

// Reduced-dimension Gemini embeddings are not unit-length; normalize so cosine distance is reliable
const normalize = (vector) => {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
};

/**
 * Embed a list of texts with Gemini.
 * @param {string[]} texts
 * @param {"RETRIEVAL_DOCUMENT"|"RETRIEVAL_QUERY"} taskType - documents and queries are embedded differently
 * @returns {Promise<number[][]>}
 */
const embedTexts = async (texts, taskType = "RETRIEVAL_DOCUMENT") => {
  if (!texts.length) return [];
  const ai = getGeminiClient();
  const vectors = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    for (let attempt = 0; ; attempt++) {
      await embeddingLimiter.acquire();
      try {
        const res = await ai.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: batch,
          config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS },
        });
        const values = (res.embeddings || []).map((e) => e.values);
        if (values.length !== batch.length || values.some((v) => !v?.length)) {
          throw new Error("Gemini returned an incomplete embedding response");
        }
        vectors.push(...values.map(normalize));
        break;
      } catch (err) {
        if (isRateLimitError(err) && attempt < 3) {
          embeddingLimiter.exhaust();
          await sleep(embeddingLimiter.secondsUntilReset() * 1000);
          continue;
        }
        throw err;
      }
    }
  }

  return vectors;
};

const embedQuery = async (text) => (await embedTexts([text], "RETRIEVAL_QUERY"))[0];

module.exports = { embedTexts, embedQuery, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
