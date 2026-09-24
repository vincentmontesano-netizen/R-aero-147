import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Image, Pressable, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { mediaSource, type Outputs } from "./api";
import { useTheme } from "./theme";
import { Action, Copy, Heading, Notice } from "./ui";

type Cue = NonNullable<Outputs["learning"]["slides"][number]["videoCues"]>[number];
function sourceFor(url: string) { try { return mediaSource(url); } catch { return null; } }

export function CourseImage({ url }: { url: string }) {
  const [failed, setFailed] = useState(false); const [revision, setRevision] = useState(0);
  const source = sourceFor(url);
  return !source ? <Notice>Cette image utilise une adresse non prise en charge.</Notice> : failed ? <><Notice>L’image n’a pas pu être chargée.</Notice><Action secondary title="Recharger l’image" onPress={() => {setRevision(n => n + 1);setFailed(false);}} /></> : <Image key={revision} source={source} resizeMode="contain" accessibilityLabel="Illustration de la formation" style={{ width: "100%", height: 220, borderRadius: 10 }} onError={() => setFailed(true)} />;
}

export function CourseAudio({ url }: { url: string }) {
  const source = useMemo(() => sourceFor(url), [url]);
  const player = useAudioPlayer(source); const status = useAudioPlayerStatus(player);
  useEffect(() => { const listener = AppState.addEventListener("change", state => { if (state !== "active") player.pause(); });return () => listener.remove(); }, [player]);
  if (!source) return <Notice>Cette piste audio est indisponible.</Notice>;
  return <View style={{ gap: 10 }}><Copy muted>Narration audio · {Math.floor(status.currentTime ?? 0)} s / {Math.floor(status.duration ?? 0)} s</Copy><Action secondary title={status.playing ? "Mettre la narration en pause" : "Écouter la narration"} onPress={() => { if(status.playing) player.pause();else { if(status.didJustFinish) void player.seekTo(0);player.play(); } }} /></View>;
}

export function CourseVideo({ url, cues = [] }: { url: string; cues?: Cue[] | null }) {
  const source = useMemo(() => sourceFor(url), [url]); const { colors } = useTheme();
  const player = useVideoPlayer(source, value => { value.timeUpdateEventInterval = 0.25; });
  const [active, setActive] = useState<number | null>(null); const activeRef = useRef<number | null>(null);
  const answered = useRef(new Set<number>()); const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<number[]>([]); const [checked, setChecked] = useState(false);
  const [feedback, setFeedback] = useState(""); const [item, setItem] = useState<string | null>(null); const [drops, setDrops] = useState<Record<string, string>>({});
  const cue = active == null ? null : cues?.[active];
  useEffect(() => {
    const progress = player.addListener("timeUpdate", ({ currentTime }) => {
      if(activeRef.current !== null) return;
      const index = (cues ?? []).findIndex((value, i) => currentTime >= value.atSeconds && !answered.current.has(i));
      if(index < 0) return;
      player.pause();activeRef.current = index;setActive(index);setSelected([]);setChecked(false);setFeedback("");setItem(null);setDrops({});
    });
    const status = player.addListener("statusChange", ({ status }) => setFailed(status === "error"));
    const app = AppState.addEventListener("change", state => { if(state !== "active") player.pause(); });
    return () => {progress.remove();status.remove();app.remove();};
  }, [player, cues]);
  const proceed = (seek?: number) => {
    if (activeRef.current == null) return;
    answered.current.add(activeRef.current);activeRef.current = null;setActive(null);
    if (seek != null && Number.isFinite(seek)) player.currentTime = Math.max(0, seek);
    player.play();
  };
  const correct = cue?.kind === "dragdrop"
    ? (cue.dropZones ?? []).length > 0 && (cue.dropZones ?? []).every(zone => drops[zone.id] === zone.correctItemId)
    : (cue?.correct ?? []).length === selected.length && (cue?.correct ?? []).every(value => selected.includes(value));
  if (!source) return <Notice>Cette vidéo utilise une adresse non prise en charge.</Notice>;
  return <View style={{ gap: 14 }}>
    <View style={{ borderRadius: 10, overflow: "hidden", backgroundColor: "#000" }}>
      <VideoView player={player} style={{ width: "100%", aspectRatio: 16 / 9 }} surfaceType="textureView" nativeControls={!cue} fullscreenOptions={{ enable: !cues?.length }} contentFit="contain" />
      {cue?.kind === "hotspot" && <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}>
        {(cue.hotspots ?? []).map((hotspot, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={hotspot.label ?? `Zone ${index + 1}`} onPress={() => hotspot.correct !== false ? proceed(hotspot.seekTo) : setFeedback("Cette zone ne correspond pas. Essayez à nouveau.")} style={{ position: "absolute", left: `${Math.max(0, Math.min(88, hotspot.xPct))}%`, top: `${Math.max(0, Math.min(75, hotspot.yPct))}%`, minHeight: 44, minWidth: 44, borderRadius: 24, backgroundColor: colors.gold, justifyContent: "center", alignItems: "center", padding: 8 }}><Text style={{ fontWeight: "700", color: colors.buttonText }}>{index + 1}</Text></Pressable>)}
      </View>}
    </View>
    {failed && <><Notice>La vidéo n’a pas pu être chargée.</Notice><Action secondary title="Recharger la vidéo" onPress={() => {setFailed(false);void player.replaceAsync(source);}} /></>}
    {cue && <View style={{ gap: 12, borderWidth: 1, borderColor: colors.gold, padding: 16, borderRadius: 12 }}>
      <Heading small>{cue.question ?? "À vous de jouer"}</Heading>
      {cue.kind === "branch" ? (cue.branches ?? []).map((branch, index) => <Action key={index} secondary title={branch.label} onPress={() => proceed(branch.seekTo)} />)
        : cue.kind === "hotspot" ? <><Copy muted>Touchez une zone sur la vidéo ou choisissez son libellé ci-dessous.</Copy>{(cue.hotspots ?? []).map((hotspot,index) => <Action secondary key={index} title={`${index + 1} · ${hotspot.label ?? "Zone"}`} onPress={() => hotspot.correct !== false ? proceed(hotspot.seekTo) : setFeedback("Cette zone ne correspond pas. Essayez à nouveau.")} />)}</>
        : cue.kind === "dragdrop" ? <><Copy muted>Sélectionnez un élément puis touchez sa destination.</Copy>{(cue.dragItems ?? []).map(value => <Action key={value.id} secondary={item !== value.id} title={value.label} disabled={checked} onPress={() => setItem(value.id)} />)}{(cue.dropZones ?? []).map(zone => <Action key={zone.id} secondary title={`${zone.label ?? zone.id} : ${(cue.dragItems ?? []).find(value => value.id === drops[zone.id])?.label ?? "Choisir"}`} disabled={checked || !item} onPress={() => {if(item) {setDrops(previous => ({...previous,[zone.id]:item}));setItem(null);}}} />)}</>
        : (cue.options ?? []).map((option, index) => <Choice key={index} label={option} selected={selected.includes(index)} disabled={checked} onPress={() => setSelected(previous => (cue.correct?.length ?? 1) > 1 ? previous.includes(index) ? previous.filter(v => v !== index) : [...previous,index] : [index])} />)}
      {cue.kind !== "branch" && cue.kind !== "hotspot" && (!checked ? <Action title="Vérifier ma réponse" onPress={() => setChecked(true)} disabled={cue.kind === "dragdrop" ? !Object.keys(drops).length : !selected.length} /> : <><Notice>{correct ? "Bonne réponse." : "Revoyez votre réponse."}{cue.explanation ? ` ${cue.explanation}` : ""}</Notice>{correct ? <Action title="Poursuivre la vidéo" onPress={() => proceed(cue.onCorrectSeek)} /> : <Action secondary title="Réessayer" onPress={() => setChecked(false)} />}</>)}
      {!!feedback && <Notice>{feedback}</Notice>}
    </View>}
  </View>;
}

export function Choice({ label, selected, disabled = false, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  const { colors } = useTheme();return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress} style={{ padding: 14, minHeight: 48, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.gold : colors.line, borderRadius: 10, backgroundColor: colors.card, flexDirection: "row", gap: 12 }}><Text style={{ color: selected ? colors.gold : colors.muted, fontSize: 18 }}>{selected ? "☑" : "○"}</Text><Text style={{ color: colors.text, fontSize: 16, lineHeight: 23, flex: 1 }}>{label}</Text></Pressable>;
}
