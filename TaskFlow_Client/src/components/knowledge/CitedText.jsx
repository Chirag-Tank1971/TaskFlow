import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Recursively traverses React nodes / string children to replace [1], [2] with
 * interactive, clickable citation pill badges that highlight the referenced source.
 */
const injectCitationBadges = (children, onCite) => {
  if (typeof children === "string") {
    const parts = children.split(/(\[\d+\])/g);
    if (parts.length === 1) return children;
    return parts.map((part, idx) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (!match) return part;
      const ref = Number(match[1]);
      return (
        <button
          key={idx}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCite?.(ref);
          }}
          className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 mx-0.5 text-[10px] font-bold rounded-md bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/50 hover:text-white hover:border-indigo-400 transition-all cursor-pointer align-baseline"
          title={`View citation source [${ref}]`}
        >
          {ref}
        </button>
      );
    });
  }

  if (Array.isArray(children)) {
    return React.Children.map(children, (child) => injectCitationBadges(child, onCite));
  }

  if (React.isValidElement(children) && children.props?.children) {
    return React.cloneElement(children, {
      ...children.props,
      children: injectCitationBadges(children.props.children, onCite),
    });
  }

  return children;
};

/**
 * Render Markdown-formatted AI text with inline interactive citations [1] shown as clickable badges.
 */
const CitedText = ({ text, onCite, className = "" }) => {
  const content = String(text || "");

  const components = {
    p: ({ children }) => (
      <p className="mb-2.5 last:mb-0 leading-relaxed text-slate-200">
        {injectCitationBadges(children, onCite)}
      </p>
    ),
    h1: ({ children }) => (
      <h1 className="text-sm font-bold text-white mt-3 mb-1.5 first:mt-0 flex items-center gap-1.5">
        {injectCitationBadges(children, onCite)}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xs font-bold text-white mt-2.5 mb-1.5 first:mt-0 flex items-center gap-1.5">
        {injectCitationBadges(children, onCite)}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-xs font-semibold text-slate-100 mt-2 mb-1 first:mt-0">
        {injectCitationBadges(children, onCite)}
      </h3>
    ),
    strong: ({ children }) => (
      <strong className="font-bold text-white">
        {injectCitationBadges(children, onCite)}
      </strong>
    ),
    em: ({ children }) => (
      <em className="italic text-slate-300">
        {injectCitationBadges(children, onCite)}
      </em>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-outside pl-4 space-y-1.5 my-2 text-slate-200">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside pl-4 space-y-1.5 my-2 text-slate-200">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="leading-relaxed">
        {injectCitationBadges(children, onCite)}
      </li>
    ),
    code: ({ inline, className, children, ...props }) => {
      if (inline || (typeof children === "string" && !children.includes("\n"))) {
        return (
          <code
            className="px-1.5 py-0.5 mx-0.5 text-[11px] font-mono rounded bg-slate-800/90 text-indigo-300 border border-slate-700/60 font-medium"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code className="text-[11px] font-mono text-slate-300" {...props}>
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="p-3 my-2.5 rounded-xl bg-slate-950/90 border border-slate-800/90 overflow-x-auto text-[11px] font-mono text-slate-300">
        {children}
      </pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-indigo-500/70 pl-3 my-2 text-slate-400 italic">
        {injectCitationBadges(children, onCite)}
      </blockquote>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
      >
        {children}
      </a>
    ),
  };

  return (
    <div className={`text-xs text-slate-200 leading-relaxed ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default CitedText;

