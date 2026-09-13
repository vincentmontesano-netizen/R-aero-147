import { useEffect, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import LiveReplayHistory from "@/components/LiveReplayHistory";
import LearningVideo from "@/components/LearningVideo";
import { Input } from "@/components/ui/input";
import { MessageSquare, HelpCircle, BarChart3, Users, Trophy, Send, Check, ArrowLeft, Radio } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { compactLivePollOptions } from '@shared/livePollOptions';
import { requestId as createRequestId } from '@/lib/requestId';

const BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const MUTED = "oklch(45% 0.02 240)";
const BORDER = "oklch(88% 0.015 88)";
const GREEN = "oklch(55% 0.18 145)";

type Room = { roomType: "webinar" | "session"; roomId: number; isModerator: boolean };

export default function LiveRoom() {
  const [, params] = useRoute("/live/:type/:id");
  const { user } = useAuth();
  return <LiveRoomSession key={`${user?.id ?? 'anonymous'}:${params?.type ?? ''}:${params?.id ?? ''}`} type={params?.type} id={params?.id} />;
}

function LiveRoomSession({ type, id }: { type?: string; id?: string }) {
  const { t, lang } = useI18n();
  const params = { type, id };
  const { user, isAuthenticated, loading } = useAuth();
  const roomType = (params?.type === "session" ? "session" : "webinar") as "webinar" | "session";
  const roomId = Number(params?.id ?? 0);
  const validRoom = (params?.type === 'session' || params?.type === 'webinar') && /^[1-9]\d*$/.test(params?.id ?? '') && Number.isSafeInteger(roomId);
  const accessQuery = trpc.live.access.useQuery({ roomType, roomId }, { enabled: isAuthenticated && validRoom, refetchInterval: 15000 });
  const { data: access, isLoading } = accessQuery;
  const accessDenied = ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND'].includes(accessQuery.error?.data?.code ?? '');
  const secureVideoContext = window.isSecureContext;
  const join = trpc.live.join.useMutation();
  const videoTicket = trpc.live.videoTicket.useMutation();
  const [videoError, setVideoError] = useState(false);
  const jitsiRef = useRef<HTMLDivElement | null>(null);

  const isReplay = access?.status === "completed" && !!access?.replayUrl;

  // Mount Jitsi (live mode) + presence heartbeat.
  useEffect(() => {
    const ticket = videoTicket.data;
    if (!access || accessDenied || !secureVideoContext || isReplay || !access.isRegistered || access.videoAdmission.state !== "open" || !ticket || ticket.roomId !== roomId || ticket.roomType !== roomType) return;
    if (ticket.moderator !== access.isModerator || new Date(ticket.expiresAt).getTime() <= Date.now()) { videoTicket.reset(); return; }
    setVideoError(false);
    let api: any;
    let disposed = false;
    let connected = false;
    let script: HTMLScriptElement | null = null;
    const heartbeat = () => { if (connected && !disposed) join.mutate({ roomType, roomId }); };
    const start = () => {
      if (disposed || !jitsiRef.current || !(window as any).JitsiMeetExternalAPI) return;
      try {
      api = new (window as any).JitsiMeetExternalAPI(ticket.domain, {
        roomName: ticket.roomName, jwt: ticket.jwt,
        parentNode: jitsiRef.current,
        userInfo: { displayName: access.displayName },
        configOverwrite: { prejoinPageEnabled: false, startWithAudioMuted: true, disableDeepLinking: true },
      });
      api.addListener("videoConferenceJoined", () => { connected = true; heartbeat(); });
      api.addListener("videoConferenceLeft", () => { connected = false; if (!disposed) videoTicket.reset(); });
      api.addListener("readyToClose", () => { connected = false; if (!disposed) videoTicket.reset(); });
      } catch { if (!disposed) setVideoError(true); }
    };
    const failed = () => { if (!disposed) setVideoError(true); };
    let s = document.getElementById("jaas-ext") as HTMLScriptElement | null;
    if (s && s.src !== ticket.scriptUrl) { s.remove(); s = null; }
    if (!s) { s = document.createElement("script"); s.id = "jaas-ext"; s.src = ticket.scriptUrl; s.async = true; document.body.appendChild(s); }
    script = s;
    const loaded = () => { if (script) script.dataset.ready = "true"; start(); };
    if (s.dataset.ready === "true") start(); else s.addEventListener("load", loaded);
    s.addEventListener("error", failed);
    const hb = setInterval(heartbeat, 30000);
    return () => { disposed = true; connected = false; clearInterval(hb); script?.removeEventListener("load", loaded); script?.removeEventListener("error", failed); try { api?.dispose(); } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoTicket.data?.jwt, roomId, roomType, isReplay, accessDenied, secureVideoContext, access?.isRegistered, access?.isModerator, access?.videoAdmission.state]);

  if (loading || isLoading) return <Centered>{t("liveRoom.loading")}</Centered>;
  if (!isAuthenticated) return <Centered><a href={getLoginUrl()}><Button style={{ background: BLUE, color: "white" }}>{t("liveRoom.login")}</Button></a></Centered>;
  if (!validRoom) return <Centered>{t('liveRoom.roomNotFound')}</Centered>;
  const accessError = <div className="p-4 space-y-3"><p role="alert">{t(accessDenied ? 'liveRoom.accessUnavailable' : 'liveRoom.accessLoadError')}</p><Button variant="outline" disabled={accessQuery.isFetching} onClick={() => { void accessQuery.refetch(); }}>{t(accessQuery.isFetching ? 'common.loading' : 'learningPlayer.save.retry')}</Button></div>;
  if (accessQuery.isError && (!access || accessDenied)) return <Centered>{accessError}</Centered>;
  if (!access) return <Centered>{t("liveRoom.roomNotFound")}</Centered>;
  if (!access.isRegistered) return <Centered>{t("liveRoom.notRegistered")}</Centered>;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BLUE }}>
      {accessQuery.isError && <div className="bg-white">{accessError}</div>}
      <div className="min-h-14 flex flex-wrap gap-3 items-center justify-between px-4 py-2 shrink-0" style={{ borderBottom: `1px solid oklch(100% 0 0 / 0.1)` }}>
        <div className="flex items-center gap-3 min-w-0">
          <Link href={roomType === "session" ? "/sessions" : "/webinars"}><button className="text-white/70 hover:text-white"><ArrowLeft className="w-5 h-5" /></button></Link>
          <span className="font-serif font-bold text-white truncate">{access.title}</span>
          {access.status === "live" && <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "oklch(55% 0.22 27)", color: "white" }}><Radio className="w-3 h-3" /> LIVE</span>}
          {isReplay && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: GOLD, color: BLUE }}>REPLAY</span>}
        </div>
        {access.isModerator && (isReplay
          ? <ReplayCorrection roomType={roomType} roomId={roomId} revision={access.replayRevision ?? 0} currentUrl={access.replayUrl!} />
          : <ReplaySetter roomType={roomType} roomId={roomId} revision={access.replayRevision ?? 0} />)}
      </div>

      {access.isModerator && <LiveReplayHistory roomType={roomType} roomId={roomId} />}
      <div className="flex-1 grid lg:grid-cols-[1fr_380px] min-h-0">
        {/* Stage: Jitsi (live) or replay video */}
        <div className="min-h-0 bg-black">
          {isReplay
            ? <LearningVideo key={access.replayUrl} src={access.replayUrl!} controls className="w-full h-full" style={{ maxHeight: "100%" }} />
            : <><div className="p-4 text-white space-y-3">
                {!secureVideoContext && <p role="alert">{t('liveRoom.secureVideoRequired')}</p>}
                {join.isError && <p role="alert">{t('liveRoom.presenceSaveFailed')}</p>}
                {(!videoTicket.data || videoTicket.data.roomId !== roomId || videoTicket.data.roomType !== roomType || videoError) && <Button disabled={!secureVideoContext || videoTicket.isPending || access.videoAdmission.state !== "open"} onClick={() => { const failedScript = document.getElementById("jaas-ext") as HTMLScriptElement | null; if (videoError) failedScript?.remove(); videoTicket.mutate({ roomType, roomId }); }}>{lang === "fr" ? "Rejoindre la visioconférence privée" : lang === "ar" ? "الانضمام إلى الاجتماع الخاص" : "Join private video meeting"}</Button>}
                <p className="text-sm text-white/80">{access.videoAdmission.opensAt && access.videoAdmission.closesAt ? `${lang === "fr" ? "Accès vidéo" : lang === "ar" ? "الوصول إلى الفيديو" : "Video access"}: ${new Date(access.videoAdmission.opensAt).toLocaleString(lang)} — ${new Date(access.videoAdmission.closesAt).toLocaleString(lang)}` : (lang === "fr" ? "L’organisateur doit compléter les horaires de la classe." : lang === "ar" ? "يجب على المنظم إكمال مواعيد الفصل." : "The organizer must complete the class schedule.")}</p>
                {videoTicket.error && <p role="alert">{videoTicket.error.message}</p>}
                {videoError && <p role="alert">{lang === "fr" ? "Le service vidéo n’a pas pu être chargé. Réessayez." : lang === "ar" ? "تعذر تحميل خدمة الفيديو. حاول مجدداً." : "The video service could not load. Please retry."}</p>}
              </div><div ref={jitsiRef} className="w-full h-full" style={{ minHeight: 360 }} /></>}
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

type ReplayEditorProps = {roomType:'webinar'|'session';roomId:number;revision:number};
function ReplayCorrection({currentUrl,...room}:ReplayEditorProps & {currentUrl:string}) {
  const {t}=useI18n();
  const [editing,setEditing]=useState<{revision:number;url:string}|null>(null);
  const [saved,setSaved]=useState(false);
  if(editing)return <ReplaySetter {...room} revision={editing.revision} currentUrl={editing.url} onCancel={()=>setEditing(null)} onSaved={()=>{setEditing(null);setSaved(true);}}/>;
  return <div className="space-y-2">
    <Button variant="outline" onClick={()=>{setSaved(false);setEditing({revision:room.revision,url:currentUrl});}}>{t('liveRoom.correctReplay')}</Button>
    {saved&&<p role="status" className="text-xs text-white">{t('liveRoom.replayCorrected')}</p>}
  </div>;
}

function ReplaySetter({ roomType, roomId, revision, currentUrl, onCancel, onSaved }: ReplayEditorProps & {currentUrl?:string;onCancel?:()=>void;onSaved?:()=>void}) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const saving = useRef(false);
  const expectedRevision = useRef(revision);
  const utils = trpc.useUtils();
  const setReplay = trpc.live.setReplay.useMutation({
    onSuccess: async () => { toast.success(t(currentUrl ? "liveRoom.replayCorrected" : "liveRoom.replaySaved")); await Promise.all([utils.live.access.invalidate({ roomType, roomId }), utils.live.replayHistory.invalidate({ roomType, roomId })]); onSaved?.(); },
    onSettled: () => { saving.current = false; },
  });
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving.current || !url.trim()) return;
    if (!window.confirm(t(currentUrl ? 'liveRoom.confirmReplayCorrection' : 'liveRoom.confirmReplay', { url: url.trim(), previous:currentUrl ?? '' }))) return;
    saving.current = true;
    setReplay.mutate({ roomType, roomId, url: url.trim(), expectedRevision:expectedRevision.current });
  };
  return (
    <form onSubmit={submit} aria-busy={setReplay.isPending} className="space-y-2">
      {currentUrl&&<p className="text-xs text-white max-w-md break-words">{t('liveRoom.replayCurrent')}: <bdi>{currentUrl}</bdi></p>}
      <div className="flex flex-wrap items-center gap-2">
        <Input type="url" required pattern="https://.*" maxLength={512} aria-label={t("liveRoom.replayUrlPlaceholder")} disabled={setReplay.isPending} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("liveRoom.replayUrlPlaceholder")} className="h-8 w-56 bg-white/10 text-white border-white/20 placeholder:text-white/40" />
        <Button type="submit" size="sm" disabled={!url.trim() || url.trim() === currentUrl || setReplay.isPending} style={{ background: GOLD, color: BLUE }}>{t(setReplay.isPending ? 'common.loading' : currentUrl ? "liveRoom.replaceReplay" : "liveRoom.closeAndReplay")}</Button>
      </div>
      {onCancel&&<Button type="button" variant="outline" size="sm" disabled={setReplay.isPending} onClick={onCancel}>{t("liveRoom.cancel")}</Button>}
      {setReplay.isError && <p role="alert" className="text-xs text-white max-w-md">{t(setReplay.error?.data?.code === 'CONFLICT' ? 'liveRoom.replayConflict' : 'liveRoom.replayUnconfirmed')}</p>}
    </form>
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
  const activeTab = visibleTabs.some(item => item.key === tab) ? tab : visibleTabs[0].key;
  return (
    <div className="flex flex-col min-h-0" style={{ background: "white", borderLeft: `1px solid ${BORDER}` }}>
      <div className="flex shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
        {visibleTabs.map((tabItem) => (
          <button key={tabItem.key} type="button" aria-pressed={activeTab === tabItem.key} onClick={() => setTab(tabItem.key)} className="flex-1 py-2.5 flex items-center justify-center gap-1 text-xs font-semibold transition-colors"
            style={{ color: activeTab === tabItem.key ? BLUE : MUTED, borderBottom: activeTab === tabItem.key ? `2px solid ${GOLD}` : "2px solid transparent" }}>
            <tabItem.icon className="w-3.5 h-3.5" /> {t(tabItem.labelKey)}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {(activeTab === "chat") && <ChatQA room={room} kind="chat" userId={userId} />}
        {(activeTab === "qa") && <ChatQA room={room} kind="qa" userId={userId} />}
        {(activeTab === "polls") && <PollsPanel room={room} />}
        {(activeTab === "people") && <ParticipantsPanel room={room} />}
        {(activeTab === "score") && <EngagementPanel room={room} />}
      </div>
    </div>
  );
}

function ChatQA({ room, kind, userId }: { room: Room; kind: "chat" | "qa"; userId: number }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const messagesQuery = trpc.live.messages.useQuery({ roomType: room.roomType, roomId: room.roomId }, { refetchInterval: 4000 });
  const { data } = messagesQuery;
  const list = (kind === "chat" ? data?.chat : data?.qa) ?? [];
  const [text, setText] = useState("");
  const draftRevision = useRef(0);
  const sendingRevision = useRef<number | null>(null);
  const pendingMessage = useRef<{ signature: string; requestId: string } | null>(null);
  const [postUnconfirmed, setPostUnconfirmed] = useState(false);
  const refreshMessages = () => { void utils.live.messages.invalidate(); };
  const post = trpc.live.postMessage.useMutation({
    onSuccess: result => {
      if (!result?.success) setPostUnconfirmed(true);
      else {
        pendingMessage.current = null;
        if (draftRevision.current === sendingRevision.current) setText('');
      }
      refreshMessages();
    },
    onError: () => { setPostUnconfirmed(true); refreshMessages(); },
    onSettled: () => { sendingRevision.current = null; },
  });
  const markAnswered = trpc.live.markAnswered.useMutation({ onSuccess: refreshMessages, onError: refreshMessages });
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messagesQuery.isLoading && <p role="status">{t('common.loading')}</p>}
        {messagesQuery.isError && <div className="space-y-2"><p role="alert">{t('liveRoom.messagesLoadError')}</p><Button size="sm" variant="outline" disabled={messagesQuery.isFetching} onClick={() => { void messagesQuery.refetch(); }}>{t('learningPlayer.save.retry')}</Button></div>}
        {!messagesQuery.isLoading && !messagesQuery.isError && list.length === 0 && <p className="text-xs text-center mt-6" style={{ color: MUTED }}>{kind === "chat" ? t("liveRoom.noMessages") : t("liveRoom.noQuestions")}</p>}
        {list.map((m: any) => (
          <div key={m.id} className="text-sm">
            <span className="font-semibold" style={{ color: BLUE }}>{m.authorName}</span>
            {kind === "qa" && m.isAnswered && <span className="ml-1 text-[10px] px-1.5 rounded-full" style={{ background: "oklch(55% 0.18 145 / 0.15)", color: GREEN }}>{t("liveRoom.answered")}</span>}
            <div style={{ color: "oklch(28% 0.03 252)" }}>{m.content}</div>
            {kind === "qa" && room.isModerator && !m.isAnswered && (
              <button disabled={markAnswered.isPending || messagesQuery.isError} onClick={() => markAnswered.mutate({ messageId: m.id })} className="text-[11px] mt-0.5 inline-flex items-center gap-1 disabled:opacity-50" style={{ color: GOLD }}><Check className="w-3 h-3" /> {t("liveRoom.markAnswered")}</button>
            )}
            {markAnswered.isError && markAnswered.variables?.messageId === m.id && <p role="alert" className="text-xs text-red-700">{markAnswered.error.message}</p>}
          </div>
        ))}
      </div>
      {postUnconfirmed && <p role="alert" className="p-2 text-xs text-red-700">{t('liveRoom.messageUnconfirmed')}</p>}
      <form className="p-2 flex gap-2 shrink-0" style={{ borderTop: `1px solid ${BORDER}` }}
        onSubmit={(e) => {
          e.preventDefault();
          const content = text.trim();
          if (!content || sendingRevision.current !== null || messagesQuery.isError) return;
          const signature = JSON.stringify([room.roomType, room.roomId, kind, content]);
          if (pendingMessage.current?.signature !== signature) pendingMessage.current = { signature, requestId: createRequestId() };
          sendingRevision.current = draftRevision.current; setPostUnconfirmed(false);
          post.mutate({ roomType: room.roomType, roomId: room.roomId, kind, content, requestId: pendingMessage.current.requestId });
        }}>
        <Input maxLength={4000} value={text} onChange={(e) => { draftRevision.current++; setText(e.target.value); }} aria-label={kind === "chat" ? t("liveRoom.messagePlaceholder") : t("liveRoom.questionPlaceholder")} placeholder={kind === "chat" ? t("liveRoom.messagePlaceholder") : t("liveRoom.questionPlaceholder")} className="h-9" />
        <Button type="submit" size="sm" aria-label={t('liveRoom.sendMessage')} disabled={!text.trim() || post.isPending || messagesQuery.isError} style={{ background: BLUE, color: "white" }}><Send aria-hidden="true" className="w-4 h-4" /></Button>
      </form>
    </div>
  );
}

function LiveActivityError({ busy, retry }: { busy: boolean; retry: () => void }) {
  const { t } = useI18n();
  return <div className="space-y-2 py-2">
    <p role="alert" className="text-xs">{t('liveRoom.activityLoadError')}</p>
    <Button size="sm" variant="outline" disabled={busy} onClick={retry}>{t('learningPlayer.save.retry')}</Button>
  </div>;
}

function ParticipantsPanel({ room }: { room: Room }) {
  const { t } = useI18n();
  const peopleQuery = trpc.live.participants.useQuery({ roomType: room.roomType, roomId: room.roomId }, { refetchInterval: 15000 });
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
      {peopleQuery.isLoading && <p role="status">{t('common.loading')}</p>}
      {peopleQuery.isError && <LiveActivityError busy={peopleQuery.isFetching} retry={() => { void peopleQuery.refetch(); }} />}
      {!peopleQuery.isLoading && !peopleQuery.isError && peopleQuery.data?.length === 0 && <p className="text-xs text-center mt-6" style={{ color: MUTED }}>{t("liveRoom.noParticipants")}</p>}
      {!peopleQuery.isError && peopleQuery.data?.map(p => (
        <div key={p.userId} className="flex items-center gap-2 text-sm">
          <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: p.online ? GREEN : "oklch(80% 0.02 240)" }} />
          <span className="min-w-0 break-words" style={{ color: BLUE }}>{p.name}</span>
          <span className="text-[10px] ml-auto" style={{ color: MUTED }}>{t(p.online ? 'liveRoom.presenceRecent' : 'liveRoom.presenceUnconfirmed')}</span>
        </div>
      ))}
    </div>
  );
}

function EngagementPanel({ room }: { room: Room }) {
  const { t } = useI18n();
  const scoresQuery = trpc.live.engagement.useQuery({ roomType: room.roomType, roomId: room.roomId }, { refetchInterval: 10000 });
  return (
    <div className="flex-1 overflow-y-auto p-3">
      <p className="text-[11px] mb-2" style={{ color: MUTED }}>{t("liveRoom.scoreFormula")}</p>
      <p className="text-[11px] mb-2" style={{ color: MUTED }}>{t("liveRoom.presenceEstimate")}</p>
      <PresenceHistory room={room} />
      {scoresQuery.isLoading && <p role="status">{t('common.loading')}</p>}
      {scoresQuery.isError && <LiveActivityError busy={scoresQuery.isFetching} retry={() => { void scoresQuery.refetch(); }} />}
      {!scoresQuery.isLoading && !scoresQuery.isError && scoresQuery.data?.length === 0 && <p className="text-xs text-center mt-6" style={{ color: MUTED }}>{t("liveRoom.noData")}</p>}
      {!scoresQuery.isError && scoresQuery.data?.map((s, i) => (
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
  const pollQuery = trpc.live.polls.useQuery({ roomType: room.roomType, roomId: room.roomId }, { refetchInterval: 4000 });
  const { data: polls = [] } = pollQuery;
  const invalidate = () => utils.live.polls.invalidate();
  const vote = trpc.live.votePoll.useMutation({ onSuccess: invalidate, onError: invalidate });
  const close = trpc.live.closePoll.useMutation({ onSuccess: invalidate, onError: invalidate });
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {room.isModerator && (creating
        ? <CreatePoll room={room} onDone={() => { setCreating(false); invalidate(); }} />
        : <Button size="sm" variant="outline" className="w-full" onClick={() => setCreating(true)}><BarChart3 className="w-4 h-4 mr-1" /> {t("liveRoom.launchPollQuiz")}</Button>)}
      {pollQuery.isLoading && <p role="status">{t('common.loading')}</p>}
      {pollQuery.isError && <div className="space-y-2"><p role="alert">{t('liveRoom.pollLoadError')}</p><Button size="sm" variant="outline" disabled={pollQuery.isFetching} onClick={() => { void pollQuery.refetch(); }}>{t('learningPlayer.save.retry')}</Button></div>}
      {!pollQuery.isLoading && !pollQuery.isError && polls.length === 0 && <p className="text-xs text-center mt-4" style={{ color: MUTED }}>{t("liveRoom.noPolls")}</p>}
      {polls.map((p: any) => {
        const total = p.totalVotes || 0;
        const showResults = room.isModerator || p.kind !== 'quiz' || !p.isOpen;
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
                  <button key={i} type="button" aria-pressed={(p.myChoices ?? []).includes(i)} disabled={!p.isOpen || vote.isPending || pollQuery.isError} onClick={() => vote.mutate({ pollId: p.id, choices: [i] })}
                    className="w-full text-left rounded-md overflow-hidden relative" style={{ border: `1px solid ${BORDER}` }}>
                    <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: isCorrect ? "oklch(55% 0.18 145 / 0.18)" : "oklch(68% 0.1 78 / 0.18)" }} />
                    <div className="relative flex justify-between px-2.5 py-1.5 text-sm" style={{ color: BLUE }}>
                      <span>{String.fromCharCode(65 + i)}. {opt}{isCorrect ? " ✓" : ""}{isCorrect && <span className="sr-only"> {t('liveRoom.correctAnswer')}</span>}</span>
                      {showResults && <span className="text-xs" style={{ color: MUTED }}>{pct}% ({count})</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            {(p.myChoices ?? []).length > 0 && <p role="status" className="text-xs mt-2">{t('liveRoom.savedChoices', { choices: p.myChoices.map((index: number) => String.fromCharCode(65 + index)).join(', ') })}</p>}
            {((vote.isError && vote.variables?.pollId === p.id) || (close.isError && close.variables?.pollId === p.id)) && <p role="alert" className="text-xs text-red-700 mt-2">{t('liveRoom.pollActionUnconfirmed')}</p>}
            {room.isModerator && p.isOpen && <button type="button" disabled={close.isPending || pollQuery.isError} onClick={() => close.mutate({ pollId: p.id })} className="text-[11px] mt-2 disabled:opacity-50" style={{ color: MUTED }}>{t("liveRoom.closeVote")}</button>}
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
    const prepared = compactLivePollOptions(options, kind === 'quiz' ? correct : []);
    if (!prepared || (kind === 'quiz' && prepared.correct.length !== 1)) return toast.error(t('liveRoom.correctOptionRequired'));
    if (!question.trim() || prepared.options.length < 2) return toast.error(t("liveRoom.questionMinOptions"));
    create.mutate({ roomType: room.roomType, roomId: room.roomId, kind, question: question.trim(), options: prepared.options, correct: kind === "quiz" ? prepared.correct : undefined });
  };
  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: "oklch(97% 0.01 88)", border: `1px solid ${BORDER}` }}>
      <div className="flex gap-2">
        {(["poll", "quiz"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className="flex-1 py-1 rounded text-xs font-semibold" style={{ background: kind === k ? BLUE : "white", color: kind === k ? "white" : MUTED, border: `1px solid ${BORDER}` }}>{k === "poll" ? t("liveRoom.kindPoll") : t("liveRoom.kindQuiz")}</button>
        ))}
      </div>
      <Input maxLength={1000} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("liveRoom.questionInputPlaceholder")} className="h-8" />
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          {kind === "quiz" && <button type="button" aria-pressed={correct.includes(i)} aria-label={`${t('liveRoom.correctAnswer')} ${i + 1}`} onClick={() => setCorrect([i])} title={t("liveRoom.correctAnswer")} className="w-4 h-4 rounded-full border shrink-0" style={{ borderColor: correct.includes(i) ? GREEN : BORDER, background: correct.includes(i) ? GREEN : "transparent" }} />}
          <Input maxLength={500} value={o} onChange={(e) => setOptions((s) => s.map((x, j) => (j === i ? e.target.value : x)))} placeholder={t("liveRoom.optionPlaceholder", { num: i + 1 })} className="h-8" />
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" disabled={options.length >= 10} onClick={() => setOptions((s) => [...s, ""])} className="text-[11px] disabled:opacity-50" style={{ color: GOLD }}>{t("liveRoom.addOption")}</button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onDone}>{t("liveRoom.cancel")}</Button>
          <Button size="sm" disabled={create.isPending} onClick={submit} style={{ background: BLUE, color: "white" }}>{t("liveRoom.launch")}</Button>
        </div>
      </div>
    </div>
  );
}

function PresenceHistory({ room }: { room: Room }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [beforeId, setBeforeId] = useState<number>();
  const history = trpc.live.presenceHistory.useQuery({ roomType: room.roomType, roomId: room.roomId, beforeId }, { enabled: open });
  return <details className="text-xs mb-3" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer underline">{t("liveRoom.presenceJournal")}</summary>
    {open && history.isLoading && <p role="status">{t('common.loading')}</p>}
    {history.isError && <LiveActivityError busy={history.isFetching} retry={() => { void history.refetch(); }} />}
    {open && !history.isLoading && !history.isError && history.data?.entries.length === 0 && <p>{t('liveRoom.noData')}</p>}
    {!history.isError && history.data?.entries.map(row => <p key={row.id} className="py-1 border-b">#{row.userId} · {new Date(row.startedAt).toLocaleString(lang)}–{new Date(row.endedAt).toLocaleString(lang)} · {Math.floor(row.creditedMilliseconds / 1000)} s</p>)}
    <div className="flex gap-2 mt-2">
      {beforeId && <Button variant="outline" size="sm" disabled={history.isFetching} onClick={() => setBeforeId(undefined)}>{t("liveRoom.presenceLatest")}</Button>}
      {!history.isError && history.data?.nextCursor && <Button variant="outline" size="sm" disabled={history.isFetching} onClick={() => setBeforeId(history.data!.nextCursor!)}>{t("liveRoom.presenceOlder")}</Button>}
    </div>
  </details>;
}
