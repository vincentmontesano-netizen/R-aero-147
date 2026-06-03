import { useEffect, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, HelpCircle, BarChart3, Users, Trophy, Send, Check, ArrowLeft, Radio } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

const BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const MUTED = "oklch(45% 0.02 240)";
const BORDER = "oklch(88% 0.015 88)";
const GREEN = "oklch(55% 0.18 145)";

type Room = { roomType: "webinar" | "session"; roomId: number; isModerator: boolean };

export default function LiveRoom() {
  const { t } = useI18n();
  const [, params] = useRoute("/live/:type/:id");
  const { user, isAuthenticated, loading } = useAuth();
  const roomType = (params?.type === "session" ? "session" : "webinar") as "webinar" | "session";
  const roomId = Number(params?.id ?? 0);
  const { data: access, isLoading } = trpc.live.access.useQuery({ roomType, roomId }, { enabled: isAuthenticated && roomId > 0 });
  const join = trpc.live.join.useMutation();
  const jitsiRef = useRef<HTMLDivElement | null>(null);

  const isReplay = access?.status === "completed" && !!access?.replayUrl;

  // Mount Jitsi (live mode) + presence heartbeat.
  useEffect(() => {
    if (!access || isReplay || !access.isRegistered || !access.roomName) return;
    let api: any;
    const start = () => {
      if (!jitsiRef.current || !(window as any).JitsiMeetExternalAPI) return;
      api = new (window as any).JitsiMeetExternalAPI("meet.jit.si", {
        roomName: access.roomName,
        parentNode: jitsiRef.current,
        userInfo: { displayName: access.displayName },
        configOverwrite: { prejoinPageEnabled: false, startWithAudioMuted: true, disableDeepLinking: true },
      });
    };
    if ((window as any).JitsiMeetExternalAPI) start();
    else {
      let s = document.getElementById("jitsi-ext") as HTMLScriptElement | null;
      if (!s) { s = document.createElement("script"); s.id = "jitsi-ext"; s.src = "https://meet.jit.si/external_api.js"; s.async = true; document.body.appendChild(s); }
      s.addEventListener("load", start);
    }
    join.mutate({ roomType, roomId });
    const hb = setInterval(() => join.mutate({ roomType, roomId }), 30000);
    return () => { clearInterval(hb); try { api?.dispose(); } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access?.roomName, isReplay]);

  if (loading || isLoading) return <Centered>{t("liveRoom.loading")}</Centered>;
  if (!isAuthenticated) return <Centered><a href={getLoginUrl()}><Button style={{ background: BLUE, color: "white" }}>{t("liveRoom.login")}</Button></a></Centered>;
  if (!access) return <Centered>{t("liveRoom.roomNotFound")}</Centered>;
  if (!access.isRegistered) return <Centered>{t("liveRoom.notRegistered")}</Centered>;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BLUE }}>
      <div className="h-14 flex items-center justify-between px-4 shrink-0" style={{ borderBottom: `1px solid oklch(100% 0 0 / 0.1)` }}>
        <div className="flex items-center gap-3 min-w-0">
          <Link href={roomType === "session" ? "/sessions" : "/webinars"}><button className="text-white/70 hover:text-white"><ArrowLeft className="w-5 h-5" /></button></Link>
          <span className="font-serif font-bold text-white truncate">{access.title}</span>
          {access.status === "live" && <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "oklch(55% 0.22 27)", color: "white" }}><Radio className="w-3 h-3" /> LIVE</span>}
          {isReplay && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: GOLD, color: BLUE }}>REPLAY</span>}
        </div>
        {access.isModerator && !isReplay && <ReplaySetter roomType={roomType} roomId={roomId} />}
      </div>

      <div className="flex-1 grid lg:grid-cols-[1fr_380px] min-h-0">
        {/* Stage: Jitsi (live) or replay video */}
        <div className="min-h-0 bg-black">
          {isReplay
            ? <video src={access.replayUrl!} controls className="w-full h-full" style={{ maxHeight: "100%" }} />
            : <div ref={jitsiRef} className="w-full h-full" style={{ minHeight: 360 }} />}
        </div>
        {/* Engagement side panel */}
        <SidePanel room={{ roomType, roomId, isModerator: access.isModerator }} replay={isReplay} userId={user?.id ?? 0} />
      </div>
    </div>
  );
}

function Centered({ children }: { children: any }) {
  return <div className="min-h-screen flex items-center justify-center p-6 text-center text-sm" style={{ background: "oklch(97% 0.01 88)", color: MUTED }}><div className="max-w-sm">{children}</div></div>;
}

function ReplaySetter({ roomType, roomId }: { roomType: "webinar" | "session"; roomId: number }) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const utils = trpc.useUtils();
  const setReplay = trpc.live.setReplay.useMutation({ onSuccess: () => { toast.success(t("liveRoom.replaySaved")); utils.live.access.invalidate(); }, onError: (e) => toast.error(e.message) });
  return (
    <div className="flex items-center gap-2">
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("liveRoom.replayUrlPlaceholder")} className="h-8 w-56 bg-white/10 text-white border-white/20 placeholder:text-white/40" />
      <Button size="sm" disabled={!url || setReplay.isPending} onClick={() => setReplay.mutate({ roomType, roomId, url })} style={{ background: GOLD, color: BLUE }}>{t("liveRoom.closeAndReplay")}</Button>
    </div>
  );
}

const TABS = [
  { key: "chat", labelKey: "liveRoom.tabChat", icon: MessageSquare },
  { key: "qa", labelKey: "liveRoom.tabQa", icon: HelpCircle },
  { key: "polls", labelKey: "liveRoom.tabPolls", icon: BarChart3 },
  { key: "people", labelKey: "liveRoom.tabPeople", icon: Users },
  { key: "score", labelKey: "liveRoom.tabScore", icon: Trophy, mod: true },
] as const;

function SidePanel({ room, replay, userId }: { room: Room; replay: boolean; userId: number }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<string>(replay ? "qa" : "chat");
  const visibleTabs = TABS.filter((tabItem) => (!("mod" in tabItem) || !tabItem.mod || room.isModerator) && (!replay || tabItem.key === "qa" || (tabItem.key === "score" && room.isModerator)));
  return (
    <div className="flex flex-col min-h-0" style={{ background: "white", borderLeft: `1px solid ${BORDER}` }}>
      <div className="flex shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
        {visibleTabs.map((tabItem) => (
          <button key={tabItem.key} onClick={() => setTab(tabItem.key)} className="flex-1 py-2.5 flex items-center justify-center gap-1 text-xs font-semibold transition-colors"
            style={{ color: tab === tabItem.key ? BLUE : MUTED, borderBottom: tab === tabItem.key ? `2px solid ${GOLD}` : "2px solid transparent" }}>
            <tabItem.icon className="w-3.5 h-3.5" /> {t(tabItem.labelKey)}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {(tab === "chat") && <ChatQA room={room} kind="chat" userId={userId} />}
        {(tab === "qa") && <ChatQA room={room} kind="qa" userId={userId} />}
        {(tab === "polls") && <PollsPanel room={room} />}
        {(tab === "people") && <ParticipantsPanel room={room} />}
        {(tab === "score") && <EngagementPanel room={room} />}
      </div>
    </div>
  );
}

function ChatQA({ room, kind, userId }: { room: Room; kind: "chat" | "qa"; userId: number }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data } = trpc.live.messages.useQuery({ roomType: room.roomType, roomId: room.roomId }, { refetchInterval: 4000 });
  const list = (kind === "chat" ? data?.chat : data?.qa) ?? [];
  const [text, setText] = useState("");
  const post = trpc.live.postMessage.useMutation({ onSuccess: () => { setText(""); utils.live.messages.invalidate(); }, onError: (e) => toast.error(e.message) });
  const markAnswered = trpc.live.markAnswered.useMutation({ onSuccess: () => utils.live.messages.invalidate() });
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {list.length === 0 && <p className="text-xs text-center mt-6" style={{ color: MUTED }}>{kind === "chat" ? t("liveRoom.noMessages") : t("liveRoom.noQuestions")}</p>}
        {list.map((m: any) => (
          <div key={m.id} className="text-sm">
            <span className="font-semibold" style={{ color: BLUE }}>{m.authorName}</span>
            {kind === "qa" && m.isAnswered && <span className="ml-1 text-[10px] px-1.5 rounded-full" style={{ background: "oklch(55% 0.18 145 / 0.15)", color: GREEN }}>{t("liveRoom.answered")}</span>}
            <div style={{ color: "oklch(28% 0.03 252)" }}>{m.content}</div>
            {kind === "qa" && room.isModerator && !m.isAnswered && (
              <button onClick={() => markAnswered.mutate({ messageId: m.id })} className="text-[11px] mt-0.5 inline-flex items-center gap-1" style={{ color: GOLD }}><Check className="w-3 h-3" /> {t("liveRoom.markAnswered")}</button>
            )}
          </div>
        ))}
      </div>
      <form className="p-2 flex gap-2 shrink-0" style={{ borderTop: `1px solid ${BORDER}` }}
        onSubmit={(e) => { e.preventDefault(); if (text.trim()) post.mutate({ roomType: room.roomType, roomId: room.roomId, kind, content: text.trim() }); }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === "chat" ? t("liveRoom.messagePlaceholder") : t("liveRoom.questionPlaceholder")} className="h-9" />
        <Button type="submit" size="sm" disabled={!text.trim() || post.isPending} style={{ background: BLUE, color: "white" }}><Send className="w-4 h-4" /></Button>
      </form>
    </div>
  );
}

function ParticipantsPanel({ room }: { room: Room }) {
  const { t } = useI18n();
  const { data: people = [] } = trpc.live.participants.useQuery({ roomType: room.roomType, roomId: room.roomId }, { refetchInterval: 15000 });
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
      {people.length === 0 && <p className="text-xs text-center mt-6" style={{ color: MUTED }}>{t("liveRoom.noParticipants")}</p>}
      {people.map((p: any) => (
        <div key={p.userId} className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full" style={{ background: p.online ? GREEN : "oklch(80% 0.02 240)" }} />
          <span style={{ color: BLUE }}>{p.name}</span>
        </div>
      ))}
    </div>
  );
}

function EngagementPanel({ room }: { room: Room }) {
  const { t } = useI18n();
  const { data: scores = [] } = trpc.live.engagement.useQuery({ roomType: room.roomType, roomId: room.roomId }, { refetchInterval: 10000 });
  return (
    <div className="flex-1 overflow-y-auto p-3">
      <p className="text-[11px] mb-2" style={{ color: MUTED }}>{t("liveRoom.scoreFormula")}</p>
      {scores.length === 0 && <p className="text-xs text-center mt-6" style={{ color: MUTED }}>{t("liveRoom.noData")}</p>}
      {scores.map((s: any, i: number) => (
        <div key={s.userId} className="flex items-center gap-2 p-2 rounded-lg mb-1" style={{ background: "oklch(97% 0.01 88)" }}>
          <span className="w-5 text-xs font-bold" style={{ color: GOLD }}>{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: BLUE }}>{s.name}</div>
            <div className="text-[11px]" style={{ color: MUTED }}>{s.attendanceMin}min · {s.chat}💬 · {s.qa}❓ · {s.votes}🗳 · {s.quizCorrect}✓</div>
          </div>
          <span className="font-serif font-bold" style={{ color: BLUE }}>{s.score}</span>
        </div>
      ))}
    </div>
  );
}

function PollsPanel({ room }: { room: Room }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: polls = [] } = trpc.live.polls.useQuery({ roomType: room.roomType, roomId: room.roomId }, { refetchInterval: 4000 });
  const invalidate = () => utils.live.polls.invalidate();
  const vote = trpc.live.votePoll.useMutation({ onSuccess: invalidate });
  const close = trpc.live.closePoll.useMutation({ onSuccess: invalidate });
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {room.isModerator && (creating
        ? <CreatePoll room={room} onDone={() => { setCreating(false); invalidate(); }} />
        : <Button size="sm" variant="outline" className="w-full" onClick={() => setCreating(true)}><BarChart3 className="w-4 h-4 mr-1" /> {t("liveRoom.launchPollQuiz")}</Button>)}
      {polls.length === 0 && <p className="text-xs text-center mt-4" style={{ color: MUTED }}>{t("liveRoom.noPolls")}</p>}
      {polls.map((p: any) => {
        const total = p.totalVotes || 0;
        return (
          <div key={p.id} className="rounded-lg p-3" style={{ background: "oklch(97% 0.01 88)" }}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-semibold" style={{ color: BLUE }}>{p.kind === "quiz" ? "🎯 " : "📊 "}{p.question}</span>
              {!p.isOpen && <span className="text-[10px]" style={{ color: MUTED }}>{t("liveRoom.closed")}</span>}
            </div>
            <div className="space-y-1.5">
              {(p.options ?? []).map((opt: string, i: number) => {
                const count = p.counts?.[i] ?? 0;
                const pct = total ? Math.round((count / total) * 100) : 0;
                const isCorrect = p.kind === "quiz" && (p.correct ?? []).includes(i);
                return (
                  <button key={i} disabled={!p.isOpen || vote.isPending} onClick={() => vote.mutate({ pollId: p.id, choices: [i] })}
                    className="w-full text-left rounded-md overflow-hidden relative" style={{ border: `1px solid ${BORDER}` }}>
                    <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: isCorrect ? "oklch(55% 0.18 145 / 0.18)" : "oklch(68% 0.1 78 / 0.18)" }} />
                    <div className="relative flex justify-between px-2.5 py-1.5 text-sm" style={{ color: BLUE }}>
                      <span>{String.fromCharCode(65 + i)}. {opt}{isCorrect && room.isModerator ? " ✓" : ""}</span>
                      <span className="text-xs" style={{ color: MUTED }}>{pct}% ({count})</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {room.isModerator && p.isOpen && <button onClick={() => close.mutate({ pollId: p.id })} className="text-[11px] mt-2" style={{ color: MUTED }}>{t("liveRoom.closeVote")}</button>}
          </div>
        );
      })}
    </div>
  );
}

function CreatePoll({ room, onDone }: { room: Room; onDone: () => void }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<"poll" | "quiz">("poll");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [correct, setCorrect] = useState<number[]>([]);
  const create = trpc.live.createPoll.useMutation({ onSuccess: () => { toast.success(t("liveRoom.launched")); onDone(); }, onError: (e) => toast.error(e.message) });
  const submit = () => {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || opts.length < 2) return toast.error(t("liveRoom.questionMinOptions"));
    create.mutate({ roomType: room.roomType, roomId: room.roomId, kind, question, options: opts, correct: kind === "quiz" ? correct : undefined });
  };
  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: "oklch(97% 0.01 88)", border: `1px solid ${BORDER}` }}>
      <div className="flex gap-2">
        {(["poll", "quiz"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className="flex-1 py-1 rounded text-xs font-semibold" style={{ background: kind === k ? BLUE : "white", color: kind === k ? "white" : MUTED, border: `1px solid ${BORDER}` }}>{k === "poll" ? t("liveRoom.kindPoll") : t("liveRoom.kindQuiz")}</button>
        ))}
      </div>
      <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("liveRoom.questionInputPlaceholder")} className="h-8" />
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          {kind === "quiz" && <button onClick={() => setCorrect([i])} title={t("liveRoom.correctAnswer")} className="w-4 h-4 rounded-full border shrink-0" style={{ borderColor: correct.includes(i) ? GREEN : BORDER, background: correct.includes(i) ? GREEN : "transparent" }} />}
          <Input value={o} onChange={(e) => setOptions((s) => s.map((x, j) => (j === i ? e.target.value : x)))} placeholder={t("liveRoom.optionPlaceholder", { num: i + 1 })} className="h-8" />
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button onClick={() => setOptions((s) => [...s, ""])} className="text-[11px]" style={{ color: GOLD }}>{t("liveRoom.addOption")}</button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onDone}>{t("liveRoom.cancel")}</Button>
          <Button size="sm" disabled={create.isPending} onClick={submit} style={{ background: BLUE, color: "white" }}>{t("liveRoom.launch")}</Button>
        </div>
      </div>
    </div>
  );
}
