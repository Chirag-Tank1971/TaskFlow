// Must match TaskFlow_Server/constants/callOutcomes.js
export const CALL_OUTCOMES = {
  "no-answer": { label: "No Answer", color: "bg-slate-500/15 text-slate-300 border-slate-500/30", closes: false },
  busy: { label: "Busy", color: "bg-slate-500/15 text-slate-300 border-slate-500/30", closes: false },
  callback: { label: "Call Back", color: "bg-violet-500/15 text-violet-300 border-violet-500/30", closes: false },
  interested: { label: "Interested", color: "bg-sky-500/15 text-sky-300 border-sky-500/30", closes: false },
  converted: { label: "Converted", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", closes: true },
  "not-interested": { label: "Not Interested", color: "bg-amber-500/15 text-amber-300 border-amber-500/30", closes: true },
  "wrong-number": { label: "Wrong Number", color: "bg-rose-500/15 text-rose-300 border-rose-500/30", closes: true },
};

// A callback is "due" when its time has passed and the task is still open
export const isCallbackDue = (task, now = Date.now()) =>
  !!task.callbackAt && task.status !== "completed" && new Date(task.callbackAt).getTime() <= now;

export const hasOpenCallback = (task) => !!task.callbackAt && task.status !== "completed";

export const formatCallbackTime = (date) =>
  new Date(date).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
