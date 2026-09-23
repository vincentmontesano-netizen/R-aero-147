import LearningImage from "@/components/LearningImage";
import LearningVideo from "./LearningVideo";
import { placeVideoItem } from "../../../shared/videoPlacement";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { ChevronLeft, ChevronRight, Volume2, CheckCircle, XCircle, Check, Trophy } from "lucide-react";

const DEEP_BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const IVORY = "oklch(97% 0.01 88)";
const MUTED = "oklch(45% 0.02 240)";
const GREEN = "oklch(55% 0.18 145)";
const RED = "oklch(55% 0.22 27)";

export type DeckSlide = {
  id?: number;
  title?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
  videoCues?: {
    atSeconds: number;
    kind?: "quiz" | "branch" | "hotspot" | "dragdrop";
    question?: string | null;
    options?: string[] | null;
    correct?: number[] | null;
    explanation?: string | null;
    onCorrectSeek?: number | null;
    branches?: { label: string; seekTo: number }[] | null;
    hotspots?: { xPct: number; yPct: number; label?: string; correct?: boolean; seekTo?: number }[] | null;
    dragItems?: { id: string; label: string }[] | null;
    dropZones?: { id: string; label?: string; xPct: number; yPct: number; wPct: number; hPct: number; correctItemId: string }[] | null;
  }[] | null;
  quizQuestion?: string | null;
  quizOptions?: string[] | null;
  quizCorrect?: number[] | null;
  quizExplanation?: string | null;
};

export default function SlideDeck({
  slides,
  title,
  onSlideEnter,
  onFinish,
  finishLabel,
  contentLanguage,
}: {
  slides: DeckSlide[];
  title?: string;
  onSlideEnter?: (index: number) => void;
  onFinish?: () => void;
  finishLabel?: string;
  contentLanguage?: string | null;
}) {
  const { t, lang } = useI18n();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [failedAudio,setFailedAudio]=useState<string|null>(null);
  const [activeCue, setActiveCue] = useState<number | null>(null);
  const [answeredCues, setAnsweredCues] = useState<Set<number>>(new Set());
  const [cueSelected, setCueSelected] = useState<number[]>([]);
  const [cueChecked, setCueChecked] = useState(false);
  const [cueDrops, setCueDrops] = useState<Record<string, string>>({}); // dragdrop: zoneId → itemId

  const [dragSelection, setDragSelection] = useState<string | null>(null);

  // ── Text-to-speech of the slide text (browser SpeechSynthesis, no server/cost) ──
  const [speaking, setSpeaking] = useState(false);
  const speak = (text: string) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synth) return;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    if (!text.trim()) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const courseLanguage=contentLanguage?.trim().toLowerCase().split("-")[0];
    const speechLanguage=courseLanguage === "fr" || courseLanguage === "en" || courseLanguage === "ar" ? courseLanguage : lang;
    u.lang = speechLanguage === "fr" ? "fr-FR" : speechLanguage === "ar" ? "ar-SA" : "en-US";
    u.rate = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  };
  // Stop narration when the slide changes or the component unmounts.
  useEffect(() => { window.speechSynthesis?.cancel(); setSpeaking(false); }, [index, contentLanguage]);
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  const slide = slides[index];
  const total = slides.length;
  const hasQuiz = !!(slide?.quizQuestion && slide.quizOptions && slide.quizOptions.length > 0);
  const isMulti = (slide?.quizCorrect?.length ?? 0) > 1;
  const progress = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;

  useEffect(() => {
    setSelected([]);
    setChecked(false);
    setActiveCue(null);
    setAnsweredCues(new Set());
    setCueSelected([]);
    setCueChecked(false);
    setDragSelection(null);
    setCueDrops({});
    onSlideEnter?.(index);
    // Try to play narration automatically when there is no video.
    if (slide?.audioUrl && !slide?.videoUrl && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const isCorrect = useMemo(() => {
    if (!hasQuiz) return true;
    const correct = slide?.quizCorrect ?? [];
    return correct.length === selected.length && correct.every((c) => selected.includes(c));
  }, [hasQuiz, slide, selected]);

  if (!slide) {
    return <div className="p-10 text-center text-sm" style={{ color: MUTED }}>{t("maker.noSlides")}</div>;
  }

  const toggle = (i: number) => {
    if (checked) return;
    if (isMulti) setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
    else setSelected([i]);
  };

  const canAdvance = !hasQuiz || (checked && isCorrect);
  const goNext = () => {
    if (index < total - 1) setIndex((i) => i + 1);
    else onFinish?.();
  };

  return (
    <div className="flex flex-col" style={{ background: IVORY, minHeight: "100%" }}>
      {/* Header / progress */}
      <div className="px-5 py-3 flex items-center gap-4" style={{ background: DEEP_BLUE }}>
        <span className="text-white font-medium text-sm truncate flex-1">{title}</span>
        <span className="text-xs" style={{ color: GOLD }}>
          {t("player.module")} {index + 1} / {total} · {progress}% {t("player.completed")}
        </span>
      </div>
      <div className="h-1 w-full" style={{ background: "oklch(88% 0.015 88)" }}>
        <div className="h-1 transition-all" style={{ width: `${progress}%`, background: GOLD }} />
      </div>

      <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
        {slide.title && <h2 className="font-serif text-2xl font-bold mb-4" style={{ color: DEEP_BLUE }}>{slide.title}</h2>}

        {/* Media */}
        {slide.videoUrl ? (
          <div className="relative mb-4">
            <LearningVideo key={slide.id}
              mediaRef={videoRef}
              src={slide.videoUrl}
              controls
              className="w-full rounded-xl"
              style={{ maxHeight: 380, background: "#000" }}
              onTimeUpdate={(e) => {
                const cues = slide.videoCues ?? [];
                if (activeCue !== null || cues.length === 0) return;
                const tt = e.currentTarget.currentTime;
                const idx = cues.findIndex((c, i) => !answeredCues.has(i) && tt >= c.atSeconds);
                if (idx >= 0) { setActiveCue(idx); setCueSelected([]); setCueChecked(false); setCueDrops({}); setDragSelection(null); e.currentTarget.pause(); }
              }}
            />
            {activeCue !== null && slide.videoCues?.[activeCue] && (() => {
              const cue = slide.videoCues![activeCue];
              const kind = cue.kind ?? "quiz";
              const resumeCue = (seekTo?: number | null) => {
                setAnsweredCues((s) => new Set(s).add(activeCue!));
                setActiveCue(null);
                const v = videoRef.current;
                if (v) { if (typeof seekTo === "number") v.currentTime = seekTo; v.play().catch(() => {}); }
              };

              // BRANCH — choose a path, jump to that point in the video.
              if (kind === "branch") {
                return (
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center p-4" style={{ background: "oklch(19% 0.08 252 / 0.92)" }}>
                    <div className="w-full max-w-md">
                      <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: GOLD }}>{t("slideDeck.scenarioChoose")}</div>
                      <div className="text-white font-semibold mb-3">{cue.question}</div>
                      <div className="space-y-2">
                        {(cue.branches ?? []).map((b, i) => (
                          <button key={i} onClick={() => resumeCue(b.seekTo)} className="w-full text-left px-3 py-2 rounded-lg border text-sm text-white" style={{ background: "oklch(100% 0 0 / 0.08)", borderColor: "oklch(100% 0 0 / 0.2)" }}>
                            {b.label} <span className="text-white/50">→ {Math.floor(b.seekTo / 60)}:{String(Math.round(b.seekTo % 60)).padStart(2, "0")}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }

              // HOTSPOT — click the right zone on the paused frame.
              if (kind === "hotspot") {
                return (
                  <div className="absolute inset-0 rounded-xl" style={{ background: "oklch(19% 0.08 252 / 0.3)" }}>
                    <div className="absolute top-2 inset-x-0 text-center text-xs font-semibold tracking-widest" style={{ color: GOLD }}>{cue.question || t("slideDeck.clickRightSpot")}</div>
                    {cueChecked && <div className="absolute bottom-2 inset-x-0 text-center text-xs" style={{ color: RED }}>{t("player.incorrect")}</div>}
                    {(cue.hotspots ?? []).map((h, i) => (
                      <button key={i} title={h.label}
                        onClick={() => { if (h.correct === false) { setCueChecked(true); } else { resumeCue(h.seekTo); } }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{ left: `${h.xPct}%`, top: `${h.yPct}%`, width: 44, height: 44, border: `2px solid ${GOLD}`, background: "oklch(68% 0.1 78 / 0.25)" }} />
                    ))}
                  </div>
                );
              }

              // DRAG & DROP — drag each item onto its correct zone on the frame.
              if (kind === "dragdrop") {
                const zones = cue.dropZones ?? [];
                const items = cue.dragItems ?? [];
                const dropped = (id:string) => Object.hasOwn(cueDrops,id) ? cueDrops[id] : undefined;
                const place = (zoneId:string,itemId:string) => { if(cueChecked)return; setCueDrops(d=>placeVideoItem(d,zoneId,itemId,zones.map(z=>z.id),items.map(i=>i.id))); setDragSelection(null); };
                const instructions = lang === "fr" ? "Sélectionnez un élément, puis sa zone, ou faites-le glisser." : lang === "ar" ? "اختر عنصراً ثم منطقته، أو اسحبه إليها." : "Select an item, then its zone, or drag it into place.";
                const placedIds = new Set(Object.values(cueDrops));
                const allFilled = zones.length > 0 && zones.every((z) => dropped(z.id));
                const allCorrect = zones.length > 0 && zones.every((z) => dropped(z.id) === z.correctItemId);
                return (
                  <div className="absolute inset-0 rounded-xl" style={{ background: "oklch(19% 0.08 252 / 0.55)" }}>
                    <div className="absolute top-2 inset-x-0 text-center text-xs font-semibold tracking-widest" style={{ color: GOLD }}>{cue.question || t("slideDeck.dragEachItem")}<p className="normal-case tracking-normal font-normal mt-1 text-white">{instructions}</p></div>
                    {zones.map((z) => {
                      const placed = items.find((it) => it.id === dropped(z.id));
                      const ok = cueChecked && dropped(z.id) === z.correctItemId;
                      const bad = cueChecked && !!dropped(z.id) && dropped(z.id) !== z.correctItemId;
                      return (
                        <button type="button" key={z.id} disabled={cueChecked}
                          aria-label={`${z.label || z.id}: ${placed?.label ?? "—"}`}
                          onClick={() => { if(dragSelection)place(z.id,dragSelection); }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); place(z.id,id); }}
                          className="absolute focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-lg flex items-center justify-center text-center text-[11px] px-1"
                          style={{ left: `${z.xPct}%`, top: `${z.yPct}%`, width: `${z.wPct}%`, height: `${z.hPct}%`, border: `2px dashed ${ok ? GREEN : bad ? RED : GOLD}`, background: "oklch(100% 0 0 / 0.12)", color: "white" }}>
                          {placed ? placed.label : (z.label ?? "")}
                        </button>
                      );
                    })}
                    <div className="absolute bottom-12 inset-x-2 flex flex-wrap gap-2 justify-center">
                      {items.filter((it) => !placedIds.has(it.id)).map((it) => (
                        <button type="button" key={it.id} disabled={cueChecked} aria-pressed={dragSelection===it.id} onClick={() => setDragSelection(d=>d===it.id?null:it.id)} draggable={!cueChecked} onDragStart={(e) => e.dataTransfer.setData("text/plain", it.id)}
                          className="px-2 py-1 rounded-md text-xs cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" style={{ background: GOLD, color: DEEP_BLUE, outline:dragSelection===it.id?"2px solid white":undefined }}>
                          {it.label}
                        </button>
                      ))}
                    </div>
                    <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-3">
                      {!cueChecked ? (
                        <Button disabled={!allFilled} onClick={() => setCueChecked(true)} style={{ background: GOLD, color: DEEP_BLUE }}>{t("player.checkAnswer")}</Button>
                      ) : allCorrect ? (
                        <Button onClick={() => resumeCue(cue.onCorrectSeek)} style={{ background: GREEN, color: "white" }}>{t("common.next")} ▶</Button>
                      ) : (
                        <><span className="text-sm" style={{ color: RED }}>{t("player.incorrect")}</span><button className="text-xs underline text-white/80" onClick={() => { setCueChecked(false); setCueDrops({}); setDragSelection(null); }}>{t("slideDeck.retry")}</button></>
                      )}
                    </div>
                  </div>
                );
              }

              // QUIZ (default) — check answer, optionally jump on correct.
              const correctArr = cue.correct ?? [];
              const cueMulti = correctArr.length > 1;
              const cueCorrect = correctArr.length === cueSelected.length && correctArr.every((c) => cueSelected.includes(c));
              return (
                <div className="absolute inset-0 rounded-xl flex items-center justify-center p-4" style={{ background: "oklch(19% 0.08 252 / 0.92)" }}>
                  <div className="w-full max-w-md">
                    <div className="text-xs font-semibold tracking-widest mb-2" style={{ color: GOLD }}>{t("slideDeck.videoQuiz")}</div>
                    <div className="text-white font-semibold mb-3">{cue.question}</div>
                    <div className="space-y-2">
                      {(cue.options ?? []).map((opt, i) => {
                        const sel = cueSelected.includes(i);
                        const correct = correctArr.includes(i);
                        let bg = "oklch(100% 0 0 / 0.08)", border = "oklch(100% 0 0 / 0.2)";
                        if (cueChecked && correct) { bg = "oklch(55% 0.18 145 / 0.25)"; border = GREEN; }
                        else if (cueChecked && sel && !correct) { bg = "oklch(55% 0.22 27 / 0.25)"; border = RED; }
                        else if (sel) { border = GOLD; }
                        return (
                          <button key={i} disabled={cueChecked}
                            onClick={() => { if (cueMulti) setCueSelected((s) => s.includes(i) ? s.filter((x) => x !== i) : [...s, i]); else setCueSelected([i]); }}
                            className="w-full text-left px-3 py-2 rounded-lg border text-sm text-white transition-colors"
                            style={{ background: bg, borderColor: border }}>
                            {String.fromCharCode(65 + i)}. {opt}
                          </button>
                        );
                      })}
                    </div>
                    {!cueChecked ? (
                      <Button className="mt-3" disabled={cueSelected.length === 0} onClick={() => setCueChecked(true)} style={{ background: GOLD, color: DEEP_BLUE }}>
                        {t("player.checkAnswer")}
                      </Button>
                    ) : cueCorrect ? (
                      <div className="mt-3">
                        {cue.explanation && <p className="text-xs text-white/70 mb-2">{cue.explanation}</p>}
                        <Button onClick={() => resumeCue(cue.onCorrectSeek)} style={{ background: GREEN, color: "white" }}>
                          {t("common.next")} ▶
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-sm" style={{ color: RED }}>{t("player.incorrect")}</span>
                        <button className="text-xs underline text-white/80" onClick={() => { setCueChecked(false); setCueSelected([]); }}>{t("slideDeck.retry")}</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : slide.imageUrl ? (
          <LearningImage key={`${slide.id}:${slide.imageUrl}`} src={slide.imageUrl} alt={slide.title ?? ""} />
        ) : null}

        {/* Narration audio (when no video) */}
        {slide.audioUrl && !slide.videoUrl && (
          <div className="mb-4 flex flex-wrap items-center gap-3 p-3 rounded-lg" style={{ background: "white", border: "1px solid oklch(88% 0.015 88)" }}>
            <Button size="sm" variant="outline" onClick={() => { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); } }}>
              <Volume2 className="w-4 h-4 mr-1" /> {t("player.playNarration")}
            </Button>
            <audio ref={audioRef} src={slide.audioUrl} onError={()=>setFailedAudio(slide.audioUrl??null)} onLoadedData={()=>setFailedAudio(null)} controls className="h-8 flex-1" />
            {failedAudio===slide.audioUrl&&<div role="alert" className="w-full text-sm space-y-2"><p>{t("learningMedia.audioError")}</p><Button variant="outline" onClick={()=>{setFailedAudio(null);audioRef.current?.load();}}>{t("learningMedia.reload")}</Button></div>}
          </div>
        )}

        {(slide.title || slide.body) && (
          <button
            onClick={() => speak([slide.title, slide.body].filter(Boolean).join(". "))}
            className="mb-4 inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-colors"
            style={{ border: `1px solid ${speaking ? DEEP_BLUE : "oklch(88% 0.015 88)"}`, background: speaking ? DEEP_BLUE : "transparent", color: speaking ? "white" : DEEP_BLUE }}
          >
            <Volume2 className="w-4 h-4" /> {speaking ? t("slideDeck.stopReading") : t("slideDeck.listenToText")}
          </button>
        )}
        {slide.body && <p className="text-base leading-relaxed whitespace-pre-line mb-6" style={{ color: "oklch(28% 0.03 252)" }}>{slide.body}</p>}

        {/* Mini-quiz */}
        {hasQuiz && (
          <div className="rounded-xl p-5 mb-4" style={{ background: "white", border: "1px solid oklch(88% 0.015 88)" }}>
            <div className="font-semibold mb-3" style={{ color: DEEP_BLUE }}>{slide.quizQuestion}</div>
            <div className="space-y-2">
              {(slide.quizOptions ?? []).map((opt, i) => {
                const sel = selected.includes(i);
                const correct = (slide.quizCorrect ?? []).includes(i);
                let border = "oklch(88% 0.015 88)", bg = "white";
                if (checked && correct) { border = GREEN; bg = "oklch(55% 0.18 145 / 0.08)"; }
                else if (checked && sel && !correct) { border = RED; bg = "oklch(55% 0.22 27 / 0.08)"; }
                else if (sel) { border = DEEP_BLUE; }
                return (
                  <button key={i} onClick={() => toggle(i)} disabled={checked}
                    className="w-full text-left px-4 py-2.5 rounded-lg border flex items-center gap-3 transition-colors"
                    style={{ borderColor: border, background: bg }}>
                    <span className="w-6 h-6 rounded-full border flex items-center justify-center text-xs shrink-0"
                      style={{ borderColor: sel ? DEEP_BLUE : "oklch(80% 0.02 240)", background: sel ? DEEP_BLUE : "transparent", color: sel ? "white" : MUTED }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-sm" style={{ color: "oklch(28% 0.03 252)" }}>{opt}</span>
                    {checked && correct && <Check className="w-4 h-4 ml-auto" style={{ color: GREEN }} />}
                  </button>
                );
              })}
            </div>
            {!checked ? (
              <Button className="mt-4" disabled={selected.length === 0} onClick={() => setChecked(true)} style={{ background: DEEP_BLUE, color: IVORY }}>
                {t("player.checkAnswer")}
              </Button>
            ) : (
              <div className="mt-4 flex items-start gap-2 text-sm p-3 rounded-lg" style={{ background: isCorrect ? "oklch(55% 0.18 145 / 0.08)" : "oklch(55% 0.22 27 / 0.08)", color: isCorrect ? GREEN : RED }}>
                {isCorrect ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                <div>
                  <div className="font-semibold">{isCorrect ? t("player.correct") : t("player.incorrect")}</div>
                  {slide.quizExplanation && <div className="mt-0.5" style={{ color: MUTED }}>{slide.quizExplanation}</div>}
                  {!isCorrect && <button className="mt-1 underline" onClick={() => { setChecked(false); setSelected([]); }}>↺ {t("slideDeck.retry")}</button>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-6 py-4 flex items-center justify-between border-t" style={{ borderColor: "oklch(88% 0.015 88)", background: "white" }}>
        <Button variant="outline" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
          <ChevronLeft className="w-4 h-4 mr-1" /> {t("common.previous")}
        </Button>
        {!canAdvance && <p id="slide-next-hint" className="text-xs text-center flex-1 px-3" style={{ color: "oklch(45% 0.02 240)" }}>{t("slideDeck.answerToContinue")}</p>}
        {index < total - 1 ? (
          <Button disabled={!canAdvance} aria-describedby={!canAdvance ? "slide-next-hint" : undefined} onClick={goNext} style={{ background: DEEP_BLUE, color: IVORY }}>
            {t("common.next")} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button disabled={!canAdvance} aria-describedby={!canAdvance ? "slide-next-hint" : undefined} onClick={goNext} style={{ background: GREEN, color: "white" }}>
            <Trophy className="w-4 h-4 mr-1" /> {finishLabel ?? t("player.finish")}
          </Button>
        )}
      </div>
    </div>
  );
}
