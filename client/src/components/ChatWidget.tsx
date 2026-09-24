import { useState, useRef, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useI18n } from "@/i18n";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Bot } from "lucide-react";

const BLUE = "var(--foreground)";
const GOLD = "var(--link)";
const MUTED = "var(--muted-foreground)";
const BORDER = "var(--border)";

type Msg = { role: "user" | "assistant"; content: string };

/** Turn a plain string into nodes, linkifying internal (/...) and external (http) URLs. */
function linkify(text: string, kp: string): ReactNode[] {
  return text.split(/(\s+)/).map((tok, i) => {
    if (/^\/[\w\-/]+$/.test(tok)) return <Link key={`${kp}-${i}`} href={tok} className="underline font-medium" style={{ color: "var(--foreground)" }}>{tok}</Link>;
    if (/^https?:\/\/\S+$/.test(tok)) return <a key={`${kp}-${i}`} href={tok} target="_blank" rel="noreferrer" className="underline font-medium" style={{ color: "var(--foreground)" }}>{tok}</a>;
    return <span key={`${kp}-${i}`}>{tok}</span>;
  });
}

/** Inline markdown: **bold**, *italic*, `code`, + linkified plain runs. */
function inline(text: string, kp: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(...linkify(text.slice(last, m.index), `${kp}-t${i++}`));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={`${kp}-b${i++}`}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={`${kp}-c${i++}`} className="px-1 rounded text-[0.85em]" style={{ background: "var(--muted)" }}>{t.slice(1, -1)}</code>);
    else out.push(<em key={`${kp}-e${i++}`}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(...linkify(text.slice(last), `${kp}-t${i++}`));
  return out;
}

/** Minimal markdown renderer for assistant messages: paragraphs, bullet/numbered lists, headings. */
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0; let k = 0;
  const isBullet = (l: string) => /^\s*[-*]\s+/.test(l);
  const isNum = (l: string) => /^\s*\d+\.\s+/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (isBullet(line)) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      blocks.push(<ul key={k++} className="list-disc pl-5 space-y-0.5 my-1">{items.map((it, j) => <li key={j}>{inline(it, `u${k}-${j}`)}</li>)}</ul>);
    } else if (isNum(line)) {
      const items: string[] = [];
      while (i < lines.length && isNum(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s+/, ""));
      blocks.push(<ol key={k++} className="list-decimal pl-5 space-y-0.5 my-1">{items.map((it, j) => <li key={j}>{inline(it, `o${k}-${j}`)}</li>)}</ol>);
    } else if (/^#{1,3}\s+/.test(line)) {
      blocks.push(<div key={k++} className="font-semibold mt-1">{inline(line.replace(/^#{1,3}\s+/, ""), `h${k}`)}</div>);
      i++;
    } else if (line.trim() === "") {
      i++;
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() !== "" && !isBullet(lines[i]) && !isNum(lines[i]) && !/^#{1,3}\s+/.test(lines[i])) para.push(lines[i++]);
      blocks.push(<p key={k++}>{para.map((pl, j) => <span key={j}>{inline(pl, `p${k}-${j}`)}{j < para.length - 1 ? <br /> : null}</span>)}</p>);
    }
  }
  return <div className="space-y-1.5">{blocks}</div>;
}

/** Floating landing-page assistant (LLM + tools). Toggles open/close, bottom-right. */
const HIDE_ON = ["/admin", "/entreprise", "/dashboard", "/maker", "/live", "/profil", "/support", "/mes-devis"];

export default function ChatWidget() {
  const { t } = useI18n();
  const GREETING: Msg = { role: "assistant", content: t("chatWidget.greeting") };
  const [loc] = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const send = trpc.chat.send.useMutation();

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const submit = async () => {
    const text = input.trim();
    if (!text || send.isPending) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    const payload = next.filter((m, i) => !(i === 0 && m.role === "assistant")).map((m) => ({ role: m.role, content: m.content }));
    try {
      const res = await send.mutateAsync({ messages: payload });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: e?.message ?? t("chatWidget.unavailable") }]);
    }
  };

  // Public-facing assistant: hidden on the connected back-office / learner areas.
  if (HIDE_ON.some((p) => loc.startsWith(p))) return null;

  return (
    <>
      {/* Panel */}
      {open && (
        <div
          className="fixed z-50 flex flex-col rounded-2xl overflow-hidden shadow-2xl"
          style={{ bottom: "5.5rem", right: "1.5rem", width: "min(370px, calc(100vw - 2rem))", height: "min(540px, calc(100vh - 8rem))", background: "var(--card)", border: `1px solid ${"var(--border)"}` }}
        >
          <div className="flex items-center gap-2 px-4 py-3" style={{ background: "var(--surface-strong)" }}>
            <Bot className="w-5 h-5" style={{ color: "var(--link)" }} />
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">{t("chatWidget.title")}</div>
              <div className="text-xs text-muted-foreground">{t("chatWidget.subtitle")}</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label={t("chatWidget.close")} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2" style={{ background: "var(--background)" }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`rounded-2xl px-3 py-2 max-w-[85%] text-sm break-words leading-relaxed ${m.role === "user" ? "whitespace-pre-wrap" : ""}`}
                  style={m.role === "user"
                    ? { background: "var(--surface-strong)", color: "var(--foreground)" }
                    : { background: "var(--card)", color: "var(--muted-foreground)", border: `1px solid ${"var(--border)"}` }}>
                  {m.role === "assistant" ? <Markdown text={m.content} /> : m.content}
                </div>
              </div>
            ))}
            {send.isPending && (
              <div className="flex justify-start"><div className="rounded-2xl px-3 py-2 text-sm" style={{ background: "var(--card)", color: "var(--muted-foreground)", border: `1px solid ${"var(--border)"}` }}>…</div></div>
            )}
          </div>

          <div className="flex gap-2 p-2.5" style={{ borderTop: `1px solid ${"var(--border)"}` }}>
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("chatWidget.inputPlaceholder")} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
            <Button disabled={!input.trim() || send.isPending} onClick={submit} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}><Send className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? t("chatWidget.closeChat") : t("chatWidget.openChat")}
        className="fixed z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-transform hover:scale-105"
        style={{ bottom: "1.5rem", right: "1.5rem", background: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </>
  );
}
