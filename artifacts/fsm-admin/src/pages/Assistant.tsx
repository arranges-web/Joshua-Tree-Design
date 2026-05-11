import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Bot,
  User,
  Send,
  AlertCircle,
  Wand2,
  RefreshCw,
} from "lucide-react";
import {
  useAssistantChat,
  type AssistantChatMessage,
} from "@/lib/extra-api";

// Same shape we send to the API but with a stable id so React can
// keep its mind straight when we append optimistically.
type LocalMessage = AssistantChatMessage & { id: string };

const QUICK_PROMPTS: { label: string; prompt: string }[] = [
  {
    label: "Generate a weekly status report",
    prompt:
      "Generate a weekly status report for the leadership team: revenue YTD vs. last 30 days, biggest maintenance money pits, and the watch list of overdue invoices and at-risk pipeline.",
  },
  {
    label: "Money-by-asset-type breakdown",
    prompt:
      "Break down lifetime maintenance spend by asset type (Trucks, Trailers, Handheld, Custom) and per department. Call out the top 3 individual money pits.",
  },
  {
    label: "Department-by-department summary",
    prompt:
      "Give me a per-department operating summary: active members, crews, fleet count, last-30-day maintenance, and YTD spend. Note which departments are punching above or below their weight.",
  },
  {
    label: "What needs my attention right now?",
    prompt:
      "What should I look at right now? Surface anything urgent — overdue invoices >60 days, fleet items overdue for service, leads sitting in the inbox, retired-but-not-marked assets, etc.",
  },
];

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function Assistant() {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const chat = useAssistantChat();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Keep the message thread pinned to the bottom as new turns land
  // (user message, then assistant response).
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, chat.isPending]);

  async function send(content: string) {
    setErrorBanner(null);
    const trimmed = content.trim();
    if (!trimmed) return;
    const userMessage: LocalMessage = {
      id: newId(),
      role: "user",
      content: trimmed,
    };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput("");
    try {
      const apiMessages: AssistantChatMessage[] = next.map(({ role, content }) => ({
        role,
        content,
      }));
      const result = await chat.mutateAsync(apiMessages);
      const replyText = result.reply?.trim() ?? "";
      if (!replyText) {
        setErrorBanner("The assistant returned an empty response — please try again.");
        setMessages((prev) => prev.slice(0, -1));
        setInput(trimmed);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", content: replyText },
      ]);
    } catch (err) {
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? (err as { status?: number }).status
          : undefined;
      const fallback =
        status === 503
          ? "The assistant returned an empty response — please try again."
          : status === 429
            ? "The assistant is rate-limited right now. Try again in a minute."
            : status === 403
              ? "Only admins and accounting managers can use the assistant."
              : "The assistant request failed. Please try again.";
      setErrorBanner(fallback);
      // Roll back the optimistic user message so the prompt stays in
      // the input box for retry.
      setMessages((prev) => prev.slice(0, -1));
      setInput(trimmed);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (chat.isPending) return;
    void send(input);
  }

  function reset() {
    setMessages([]);
    setInput("");
    setErrorBanner(null);
  }

  return (
    <div className="flex h-full max-h-[calc(100vh-7rem)] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Sparkles className="h-7 w-7 text-accent-foreground" />
            Operations Assistant
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask anything about your data — fleet, accounting, departments,
            crews — or have it draft a status report. Powered by OpenAI.
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            New conversation
          </Button>
        )}
      </div>

      {errorBanner && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorBanner}</AlertDescription>
        </Alert>
      )}

      <Card className="flex flex-1 min-h-0 flex-col border-border/60">
        <CardContent className="flex flex-1 flex-col gap-3 p-0 min-h-0">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-5 py-5"
            data-testid="assistant-thread"
          >
            {messages.length === 0 ? (
              <EmptyState onPrompt={send} disabled={chat.isPending} />
            ) : (
              <div className="space-y-5">
                {messages.map((m) => (
                  <ChatBubble key={m.id} message={m} />
                ))}
                {chat.isPending && <ChatBubble loading />}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 border-t bg-muted/20 px-4 py-3"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your data — e.g. 'how is the Pest department doing this month?'"
              rows={2}
              disabled={chat.isPending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!chat.isPending) void send(input);
                }
              }}
              className="min-h-[44px] flex-1 resize-none"
            />
            <Button
              type="submit"
              disabled={chat.isPending || !input.trim()}
              className="h-11"
            >
              <Send className="mr-2 h-4 w-4" />
              {chat.isPending ? "Thinking…" : "Send"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({
  onPrompt,
  disabled,
}: {
  onPrompt: (prompt: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl py-6 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Bot className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-semibold">Ask, summarize, report.</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The assistant has a live snapshot of your operational data each turn —
        customers, jobs, fleet, maintenance, accounting, departments, and
        crews. Try one of these to get started:
      </p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={disabled}
            onClick={() => onPrompt(p.prompt)}
            className="group rounded-lg border border-border/60 bg-card p-3 text-left transition hover:border-accent hover:shadow-sm disabled:opacity-50"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Wand2 className="h-3.5 w-3.5 text-accent-foreground" />
              {p.label}
            </div>
            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {p.prompt}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  loading,
}: {
  message?: LocalMessage;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Bot className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    );
  }
  if (!message) return null;
  const isUser = message.role === "user";
  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-accent text-accent-foreground"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted/40 text-foreground"
        }`}
      >
        <FormattedReply text={message.content} />
      </div>
    </div>
  );
}

// Lightweight markdown-ish renderer. Avoids pulling in a full library
// and gives us bold, inline code, fenced code blocks, headings, and
// bullets — which is what Claude's report output uses.
function FormattedReply({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i++;
      }
      i++;
      blocks.push(
        <pre
          key={key++}
          className="my-2 overflow-x-auto rounded-md bg-background px-3 py-2 text-xs font-mono"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(
        <h4 key={key++} className="mt-3 text-sm font-semibold">
          {renderInline(line.slice(4))}
        </h4>,
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={key++} className="mt-3 text-base font-semibold">
          {renderInline(line.slice(3))}
        </h3>,
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={key++} className="mt-3 text-lg font-semibold">
          {renderInline(line.slice(2))}
        </h2>,
      );
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-1.5 list-disc space-y-0.5 pl-5">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (line.trim() === "") {
      blocks.push(<div key={key++} className="h-2" />);
      i++;
      continue;
    }
    blocks.push(
      <p key={key++} className="my-1 leading-relaxed">
        {renderInline(line)}
      </p>,
    );
    i++;
  }
  return <div className="space-y-0.5">{blocks}</div>;
}

// Inline markdown: **bold**, *italic*, `code`. Keep this small —
// pulling in react-markdown for the assistant page would be a step
// up in dependency cost.
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/;
  while (remaining.length > 0) {
    const match = remaining.match(pattern);
    if (!match || match.index === undefined) {
      parts.push(remaining);
      break;
    }
    if (match.index > 0) {
      parts.push(remaining.slice(0, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={key++} className="rounded bg-background px-1 font-mono text-xs">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={key++} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    remaining = remaining.slice(match.index + token.length);
  }
  return <>{parts}</>;
}
