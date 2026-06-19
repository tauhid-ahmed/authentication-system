"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Components } from "react-markdown";
import { Check, Copy } from "lucide-react";

// Code block with copy button
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group rounded-lg overflow-hidden my-4 border border-border">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-border">
        <span className="text-xs text-zinc-400 font-mono">{language || "code"}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus as any}
        language={language || "text"}
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: 0, background: "#1a1a2e" }}
        codeTagProps={{ style: { fontFamily: "JetBrains Mono, Fira Code, monospace", fontSize: "0.8rem" } }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

const MARKDOWN_COMPONENTS: Components = {
  code({ node, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const isBlock = !props.hasOwnProperty("inline") && match;
    if (isBlock) {
      return <CodeBlock language={match![1]} code={String(children).replace(/\n$/, "")} />;
    }
    return (
      <code className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono text-primary" {...props}>
        {children}
      </code>
    );
  },
  h1: ({ children }) => <h1 className="text-3xl font-bold tracking-tight mt-0 mb-6 pb-4 border-b">{children}</h1>,
  h2: ({ children }) => <h2 className="text-2xl font-semibold mt-10 mb-4 scroll-mt-20">{children}</h2>,
  h3: ({ children }) => <h3 className="text-xl font-semibold mt-8 mb-3">{children}</h3>,
  p: ({ children }) => <p className="leading-7 text-muted-foreground my-4">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  ul: ({ children }) => <ul className="my-4 space-y-2 list-none">{children}</ul>,
  ol: ({ children }) => <ol className="my-4 space-y-2 list-decimal list-inside text-muted-foreground">{children}</ol>,
  li: ({ children }) => (
    <li className="flex items-start gap-2 text-muted-foreground">
      <span className="mt-1.5 w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
      <span>{children}</span>
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/50 pl-4 py-1 my-4 bg-primary/5 rounded-r-lg text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-border" />,
  a: ({ href, children }) => (
    <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-6">
      <table className="w-full border-collapse border border-border rounded-lg overflow-hidden">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="px-4 py-2 bg-muted text-left font-semibold text-sm border border-border">{children}</th>,
  td: ({ children }) => <td className="px-4 py-2 text-sm text-muted-foreground border border-border">{children}</td>,
};

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
      {content}
    </ReactMarkdown>
  );
}
