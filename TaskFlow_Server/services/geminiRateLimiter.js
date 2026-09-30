/**
 * Shared per-minute request budgets for Gemini, so categorization, RAG answers and
 * Call Assist draw from the same quota instead of each assuming they own it.
 *
 * Generation and embedding models have separate quotas on Gemini, hence two limiters.
 * Budgets are configurable for paid keys: GEMINI_RPM, GEMINI_EMBED_RPM.
 */
const createLimiter = (name, maxPerMinute) => {
  let count = 0;
  let resetAt = Date.now() + 60000;

  const roll = () => {
    const now = Date.now();
    if (now > resetAt) {
      count = 0;
      resetAt = now + 60000;
    }
  };

  return {
    name,
    max: maxPerMinute,
    /** True if a request may be made right now (does not consume budget). */
    check() {
      roll();
      return count < maxPerMinute;
    },
    /** Record a request that is about to be made. */
    increment() {
      roll();
      count++;
    },
    /** Consume one unit if available; returns false when the budget is spent. */
    tryAcquire() {
      roll();
      if (count >= maxPerMinute) return false;
      count++;
      return true;
    },
    /** Mark the budget as spent until the window resets (e.g. after a 429). */
    exhaust() {
      count = maxPerMinute;
      resetAt = Date.now() + 60000;
    },
    secondsUntilReset() {
      roll();
      return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    },
    /** Wait until a unit is available, then consume it. */
    async acquire() {
      while (!this.tryAcquire()) {
        await new Promise((resolve) => setTimeout(resolve, this.secondsUntilReset() * 1000));
      }
    },
  };
};

const generationLimiter = createLimiter("generation", Number(process.env.GEMINI_RPM) || 5);
const embeddingLimiter = createLimiter("embedding", Number(process.env.GEMINI_EMBED_RPM) || 90);

module.exports = { generationLimiter, embeddingLimiter };
