/**
 * Call outcomes an agent can record, and the task status each one moves the task to.
 * "Closed" outcomes complete the task; the rest keep it open for another attempt.
 */
const CALL_OUTCOMES = {
  "no-answer": { status: "in-progress" },
  busy: { status: "in-progress" },
  callback: { status: "in-progress" }, // requires a callback time
  interested: { status: "in-progress" },
  converted: { status: "completed" },
  "not-interested": { status: "completed" },
  "wrong-number": { status: "completed" },
};

const OUTCOME_KEYS = Object.keys(CALL_OUTCOMES);

module.exports = { CALL_OUTCOMES, OUTCOME_KEYS };
