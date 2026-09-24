import { useEffect, useState } from "react";
import { View } from "react-native";
import * as Speech from "expo-speech";
import type { Outputs } from "./api";
import { Action, Copy, Heading, Meter, Notice } from "./ui";
import { Choice, CourseAudio, CourseImage, CourseVideo } from "./Media";

type Slide = Outputs["learning"]["slides"][number];
export function Slides({
  slides,
  initialIndex = 0,
  language,
  onEnter,
  onFinish,
}: {
  slides: Slide[];
  initialIndex?: number;
  language?: string | null;
  onEnter?: (index: number) => void;
  onFinish?: () => void;
}) {
  const [index, setIndex] = useState(
    Math.min(Math.max(initialIndex, 0), slides.length - 1)
  );
  const [selected, setSelected] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const slide = slides[index];
  useEffect(() => {
    setSelected([]);
    setChecked(false);
    setSpeaking(false);
    void Speech.stop();
    onEnter?.(index);
  }, [index]);
  useEffect(
    () => () => {
      void Speech.stop();
    },
    []
  );
  if (!slide) return <Notice>Aucune diapositive disponible.</Notice>;
  const hasQuiz = !!slide.quizQuestion && !!slide.quizOptions?.length;
  const correct =
    (slide.quizCorrect ?? []).length === selected.length &&
    (slide.quizCorrect ?? []).every(v => selected.includes(v));
  const speak = () => {
    if (speaking) {
      void Speech.stop();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      Speech.speak([slide.title, slide.body].filter(Boolean).join(". "), {
        language: language ?? "fr-FR",
        onDone: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    }
  };
  return (
    <View style={{ gap: 18 }}>
      <Copy muted>
        Diapositive {index + 1} sur {slides.length}
      </Copy>
      <Meter value={((index + 1) / slides.length) * 100} />
      {!!slide.title && <Heading small>{slide.title}</Heading>}
      {!!slide.imageUrl && (
        <CourseImage key={slide.imageUrl} url={slide.imageUrl} />
      )}
      {!!slide.videoUrl && (
        <CourseVideo
          key={`${slide.id}:video`}
          url={slide.videoUrl}
          cues={slide.videoCues}
        />
      )}
      {!!slide.audioUrl && !slide.videoUrl && (
        <CourseAudio key={slide.audioUrl} url={slide.audioUrl} />
      )}
      {!!slide.body && <Copy>{slide.body}</Copy>}
      {(slide.title || slide.body) && (
        <Action
          secondary
          title={speaking ? "Arrêter la lecture" : "Écouter le texte"}
          onPress={speak}
        />
      )}
      {hasQuiz && (
        <View style={{ gap: 12 }}>
          <Heading small>{slide.quizQuestion}</Heading>
          {slide.quizOptions!.map((option, i) => (
            <Choice
              key={i}
              label={option}
              selected={selected.includes(i)}
              disabled={checked}
              onPress={() =>
                setSelected(previous =>
                  (slide.quizCorrect?.length ?? 1) > 1
                    ? previous.includes(i)
                      ? previous.filter(v => v !== i)
                      : [...previous, i]
                    : [i]
                )
              }
            />
          ))}
          {!checked ? (
            <Action
              title="Vérifier ma réponse"
              onPress={() => setChecked(true)}
              disabled={!selected.length}
            />
          ) : (
            <>
              <Notice>
                {correct ? "Bonne réponse." : "Cette réponse est à revoir."}
                {slide.quizExplanation ? ` ${slide.quizExplanation}` : ""}
              </Notice>
              {!correct && (
                <Action
                  secondary
                  title="Réessayer"
                  onPress={() => setChecked(false)}
                />
              )}
            </>
          )}
        </View>
      )}
      <Action
        title={
          index === slides.length - 1
            ? "Terminer ces diapositives"
            : "Diapositive suivante"
        }
        disabled={hasQuiz && (!checked || !correct)}
        onPress={() => {
          if (index === slides.length - 1) onFinish?.();
          else setIndex(i => i + 1);
        }}
      />
      {index > 0 && (
        <Action
          secondary
          title="Diapositive précédente"
          onPress={() => setIndex(i => i - 1)}
        />
      )}
    </View>
  );
}
