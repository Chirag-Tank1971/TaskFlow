import {
  PlusCircle,
  UploadCloud,
  Pencil,
  RefreshCcw,
  UserCheck,
  PhoneCall,
  Sparkles,
  Trash2,
} from "lucide-react";
import { CALL_OUTCOMES, formatCallbackTime } from "./callOutcomes";

// Must match ACTIVITY_TYPES in TaskFlow_Server/models/Activity.js
export const ACTIVITY_TYPES = {
  created: { label: "Created", icon: PlusCircle, color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
  imported: { label: "Imported", icon: UploadCloud, color: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30" },
  updated: { label: "Edited", icon: Pencil, color: "text-slate-300 bg-slate-500/15 border-slate-500/30" },
  status_changed: { label: "Status", icon: RefreshCcw, color: "text-sky-400 bg-sky-500/15 border-sky-500/30" },
  reassigned: { label: "Reassigned", icon: UserCheck, color: "text-violet-300 bg-violet-500/15 border-violet-500/30" },
  call_logged: { label: "Call", icon: PhoneCall, color: "text-indigo-300 bg-indigo-500/15 border-indigo-500/30" },
  categorized: { label: "AI Category", icon: Sparkles, color: "text-fuchsia-300 bg-fuchsia-500/15 border-fuchsia-500/30" },
  deleted: { label: "Deleted", icon: Trash2, color: "text-rose-400 bg-rose-500/15 border-rose-500/30" },
  ai_assist: { label: "Call Assist", icon: Sparkles, color: "text-violet-300 bg-violet-500/15 border-violet-500/30" },
};

const FIELD_LABELS = {
  firstName: "name",
  phone: "phone",
  notes: "notes",
  category: "category",
  status: "status",
  agent: "agent",
};

const STATUS_LABELS = { pending: "Pending", "in-progress": "In Progress", completed: "Completed" };

const formatValue = (field, value) => {
  if (value === null || value === undefined || value === "") return "empty";
  if (field === "agent") return value.name || "an agent";
  if (field === "status") return STATUS_LABELS[value] || value;
  return String(value);
};

/**
 * Turn one change into a short phrase, e.g. "phone from 123 to 456".
 * Notes can be long, so only say that they changed.
 */
export const describeChange = (change) => {
  const label = FIELD_LABELS[change.field] || change.field;
  if (change.field === "notes") return "edited the notes";
  return `${label} from “${formatValue(change.field, change.from)}” to “${formatValue(change.field, change.to)}”`;
};

/**
 * One-line summary of an activity entry (without the actor's name).
 */
export const describeActivity = (activity, { subject = "this task" } = {}) => {
  const { type, changes = [], meta = {} } = activity;
  switch (type) {
    case "created":
      return `created ${subject}${meta.agent?.name ? `, ${meta.autoAssigned ? "auto-assigned" : "assigned"} to ${meta.agent.name}` : ""}`;
    case "imported":
      return `imported ${subject}${meta.filename ? ` from ${meta.filename}` : ""}${meta.agent?.name ? `, assigned to ${meta.agent.name}` : ""}`;
    case "updated":
      return `changed ${changes.map(describeChange).join(", ")}`;
    case "status_changed":
      return `moved status ${changes.map(describeChange).join(", ").replace(/^status /, "")}`;
    case "reassigned":
      return `reassigned ${changes.map(describeChange).join(", ").replace(/^agent /, "")}`;
    case "call_logged": {
      const outcome = CALL_OUTCOMES[meta.outcome]?.label || meta.outcome;
      const callback = meta.callbackAt ? ` · callback ${formatCallbackTime(meta.callbackAt)}` : "";
      return `logged call #${meta.attempt || "?"}: ${outcome}${callback}`;
    }
    case "categorized":
      return `categorized as “${changes[0]?.to || "?"}”${meta.source === "ai" ? " (AI)" : ""}`;
    case "ai_assist":
      return `asked Call Assist for suggestions${meta.sources ? ` (${meta.sources} knowledge source${meta.sources > 1 ? "s" : ""})` : ""}`;
    case "deleted":
      return `deleted ${subject}${meta.reason ? ` (${meta.reason})` : ""}`;
    default:
      return type;
  }
};

export const actorLabel = (actor) => {
  if (!actor || actor.role === "system") return "TaskFlow AI";
  return actor.name || "Someone";
};

export const timeAgo = (date) => {
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};
