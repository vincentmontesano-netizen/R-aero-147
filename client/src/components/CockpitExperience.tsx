import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { cockpitCopy } from "@/content/cockpit";
import { landingCopy } from "@/content/landing";
import {
  cockpitViewAtProgress,
  cockpitEntryProgress,
} from "@/lib/cockpitCamera";
import {
  advanceCockpitPlayback,
  initialCockpitPlayback,
} from "@/lib/cockpitPlayback";
import type { mountCockpit } from "@/lib/cockpitScene";

type Scene = ReturnType<typeof mountCockpit>;
export default function CockpitExperience({
  authenticated,
}: {
  authenticated: boolean;
}) {
  const { lang } = useI18n();
  const c = cockpitCopy[lang];
  const l = landingCopy[lang];
  const section = useRef<HTMLElement>(null),
    stage = useRef<HTMLDivElement>(null),
    host = useRef<HTMLDivElement>(null),
    scene = useRef<Scene | null>(null);
  const [active, setActive] = useState(0),
    [entered, setEntered] = useState(false),
    [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [attempt, setAttempt] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setProgress(0);
    void import("@/lib/cockpitScene")
      .then(({ mountCockpit }) => {
        if (cancelled || !host.current) return;
        scene.current = mountCockpit(host.current, {
          ready: () => {
            if (!cancelled) setStatus("ready");
          },
          progress: value => {
            if (!cancelled) setProgress(value);
          },
          error: () => {
            if (!cancelled) setStatus("error");
          },
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [attempt]);
  useEffect(() => {
    if (status === "error") {
      setPinned(false);
      return;
    }
    let frame = 0,
      lastTime = 0;
    let playback = initialCockpitPlayback();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const bounds = () => {
      const top = window.scrollY + section.current!.getBoundingClientRect().top;
      // The sticky element releases when its bottom reaches the section bottom.
      // Read its real height so short screens and text zoom use the same boundary.
      const end =
        top + section.current!.offsetHeight - stage.current!.offsetHeight - 64;
      return { top, end, distance: Math.max(1, end - top) };
    };
    // Preserve intentional deep links / browser restoration below the introduction.
    if (section.current && stage.current && window.scrollY > bounds().end) {
      playback = { progress: 1, finalHold: 1, released: true };
      setComplete(true);
    }
    const update = (time: number) => {
      frame = 0;
      if (!section.current || !stage.current) return;
      const { top, end, distance } = bounds();
      const y = window.scrollY;
      // Keep the introduction in place while its model loads; an error releases it.
      if (status === "loading" || !scene.current) {
        setPinned(y >= top && (y <= end || !playback.released));
        if (!playback.released && y > end)
          window.scrollTo({ top: end, behavior: "instant" });
        return;
      }
      const requested = Math.max(0, Math.min(1, (y - top) / distance));
      if (y <= top + 1 && playback.released) {
        playback = initialCockpitPlayback();
        setComplete(false);
      }
      const dt = lastTime ? (time - lastTime) / 1000 : 1 / 60;
      lastTime = time;
      playback = advanceCockpitPlayback(
        playback,
        requested,
        dt,
        scene.current.isSettled(),
        motion.matches
      );
      scene.current.travel(playback.progress);
      setEntered(playback.progress > 0.08);
      setActive(cockpitViewAtProgress(playback.progress));
      setComplete(playback.released);
      const withinTour = y >= top && (y <= end || !playback.released);
      setPinned(withinTour);
      // Discard excess wheel/touch momentum until view 05 has actually settled.
      if (!playback.released && y > end)
        window.scrollTo({ top: end, behavior: "instant" });
      if (
        Math.abs(playback.progress - requested) > 0.00001 ||
        !scene.current.isSettled() ||
        (playback.progress === 1 && !playback.released)
      )
        frame = requestAnimationFrame(update);
    };
    const schedule = () => {
      if (!frame) {
        lastTime = 0;
        frame = requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    motion.addEventListener("change", schedule);
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      motion.removeEventListener("change", schedule);
      cancelAnimationFrame(frame);
    };
  }, [status]);
  const enter = () => {
    if (!section.current) return;
    const distance = Math.max(
      1,
      section.current.offsetHeight -
        (stage.current?.offsetHeight ?? window.innerHeight - 64) -
        64
    );
    window.scrollTo({
      top:
        window.scrollY +
        section.current.getBoundingClientRect().top +
        distance * cockpitEntryProgress,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  return (
    <section
      ref={section}
      className={`flight-experience ${entered ? "is-entered" : ""} ${pinned ? "is-pinned" : ""}`}
      aria-label={c.explore}
    >
      <div className="flight-stage" ref={stage}>
        <div className="flight-grid" aria-hidden="true" />
        <div className="flight-orbit" aria-hidden="true" />
        <div className="flight-canvas" ref={host} aria-hidden="true" />
        {status !== "ready" && (
          <img
            className="flight-poster"
            src="/models/a320/exterior.webp"
            alt=""
          />
        )}
        <div className="flight-shade" aria-hidden="true" />
        <div className="academy-wrap flight-copy" inert={entered}>
          <p className="academy-eyebrow">
            <span className="flight-mark">R / A</span>
            {c.eyebrow}
          </p>
          <h1>
            {c.title}
            <br />
            <span>{c.accent}</span>
          </h1>
          <p className="flight-intro">{c.intro}</p>
          <div className="academy-actions">
            <button
              className="academy-button"
              onClick={enter}
              disabled={status !== "ready"}
            >
              {c.enter}
              <ArrowDown size={19} />
            </button>
            <Link
              className="flight-register"
              href={authenticated ? "/dashboard" : "/register"}
            >
              {l.signUp}
              <ArrowUpRight size={19} />
            </Link>
          </div>
          {status === "error" ? (
            <a className="flight-scroll" href="#formations">
              <ArrowDown size={18} />
              {c.skip}
            </a>
          ) : (
            <p className="flight-scroll">
              <ArrowDown size={18} />
              {c.scroll}
            </p>
          )}
        </div>
        <div className="flight-status" role="status" aria-live="polite">
          {status === "loading" ? (
            <>
              <span>{c.loading}</span>
              <strong>{progress}%</strong>
              <div className="flight-loading-track">
                <span style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : status === "error" ? (
            <>
              <span>{c.unavailable}</span>
              <button
                onClick={() => {
                  setEntered(false);
                  setActive(0);
                  setAttempt(a => a + 1);
                }}
              >
                {c.retry}
              </button>
            </>
          ) : null}
        </div>
        {entered && (
          <div className="flight-view-note">
            <span>0{active + 1} / R-AERO</span>
            <h2>{c.views[active]}</h2>
            <p>{c.notes[active]}</p>
            {complete ? (
              <a href="#formations">
                {c.skip}
                <ArrowUpRight size={18} />
              </a>
            ) : (
              <p className="flight-view-hint">{c.continueTour}</p>
            )}
          </div>
        )}
        <div className="flight-controls">
          <ol className="flight-stops" aria-label={c.explore}>
            {c.views.map((view, i) => (
              <li key={i} aria-current={active === i ? "step" : undefined}>
                <span>0{i + 1}</span>
                {view}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
