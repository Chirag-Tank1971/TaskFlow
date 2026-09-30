const { functionDeclarations, runTool } = require("./dataQueryTools");
const { generateContent } = require("./geminiGenerate");

const isValidTimeZone = (tz) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/**
 * Describe "now" in the admin's own timezone so "today" / "this week" resolve correctly.
 */
const describeNow = (timeZone) => {
  const now = new Date();
  const local = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "longOffset",
  }).format(now);
  return `${local} (timezone ${timeZone}; UTC now ${now.toISOString()})`;
};

const buildSystemPrompt = (timeZone) => `You are the data assistant inside TaskFlow, a call-centre lead management app. An admin asks questions about their data; you answer by calling exactly ONE of the provided tools with the right filters. You never see or invent data yourself.

Current time: ${describeNow(timeZone)}.

Domain facts:
- Tasks are customer leads assigned to agents. Status: pending, in-progress, completed. "Open" tasks = pending + in-progress.
- Categories: Support, Sales, Technical, Billing, Urgent, General.
- Call outcomes: no-answer, busy, callback, interested, converted, not-interested, wrong-number ("none" = never called).
- A callback is "due"/"overdue" when its scheduled time has passed and the task is still open.

Rules:
- Resolve relative dates ("today", "yesterday", "this week", "last month") into full ISO 8601 datetimes WITH the admin's UTC offset. Weeks start on Monday.
- For "urgent tasks" and similar, use category Urgent and only open statuses unless the admin asks for completed ones too.
- Use search_tasks to list tasks, count_tasks for "how many"/breakdowns, agent_workload for questions about agents, search_activity for who-did-what history, upload_history for CSV imports.
- If the admin asks you to create, change, assign or delete anything, call reply and explain this assistant is read-only and changes are made from the Tasks page.
- If the question is unrelated to TaskFlow data or truly ambiguous, call reply with a short clarifying question.`;

/**
 * Turn an admin's question into a validated, read-only tool call and run it.
 * Uses exactly one Gemini request.
 */
const askData = async (question, { timeZone } = {}) => {
  const tz = timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";

  // Retries and model fallback on Gemini overload are handled in geminiGenerate
  const { response } = await generateContent({
    contents: [{ role: "user", parts: [{ text: question }] }],
    config: {
      systemInstruction: buildSystemPrompt(tz),
      temperature: 0,
      tools: [{ functionDeclarations }],
      // Force a tool call: the model can't answer with free text (and so can't make data up)
      toolConfig: { functionCallingConfig: { mode: "ANY" } },
    },
  });

  const call = response.functionCalls?.[0];
  if (!call?.name) {
    return {
      tool: "reply",
      args: {},
      result: { entity: "message", message: "I couldn't work out how to answer that. Try asking about tasks, agents, callbacks, activity or uploads." },
    };
  }

  return runTool(call.name, call.args || {});
};

module.exports = { askData, buildSystemPrompt };
