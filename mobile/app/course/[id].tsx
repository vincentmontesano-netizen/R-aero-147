import { readableError } from "../../src/errors";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import {
  Action,
  Card,
  Copy,
  Heading,
  Loading,
  Meter,
  Notice,
  Screen,
} from "../../src/ui";
import { CourseVideo } from "../../src/Media";
import { Slides } from "../../src/Slides";
import { sharePdf } from "../../src/files";

type Position = { module: number; slides: Record<string, number> };
export default function Course() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const valid = Number.isSafeInteger(id) && id > 0;
  const { user } = useAuth();
  const enrollment = api.dashboard.enrollment.useQuery(
    { id },
    { enabled: valid }
  );
  const input = {
    trainingId: enrollment.data?.trainingId ?? 0,
    enrollmentId: id,
  };
  const enabled = !!enrollment.data;
  const modules = api.learning.modules.useQuery(input, { enabled });
  const slides = api.learning.slides.useQuery(input, { enabled });
  const progress = api.learning.moduleProgress.useQuery(
    { enrollmentId: id },
    { enabled }
  );
  const attempts = api.learning.quizAttempts.useQuery(
    { enrollmentId: id },
    { enabled }
  );
  const objectives = api.learning.objectiveProgress.useQuery(
    { enrollmentId: id },
    { enabled }
  );
  const questions = api.learning.quizQuestions.useQuery(input, { enabled });
  const queries = [
    enrollment,
    modules,
    slides,
    progress,
    attempts,
    objectives,
    questions,
  ];
  const [position, setPosition] = useState<Position | null>(null);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const target = useRef(0);
  const saveRevision = useRef(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const utils = api.useUtils();
  const update = api.dashboard.updateProgress.useMutation();
  const key = `raero.position.${user?.id}.${id}`;

  useFocusEffect(
    useCallback(() => {
      void enrollment.refetch();
      void progress.refetch();
      void attempts.refetch();
      void objectives.refetch();
    }, [id])
  );
  useEffect(() => {
    if (!modules.data || !progress.data) return;
    let disposed = false;
    void AsyncStorage.getItem(key)
      .then(value => {
        if (disposed) return;
        const firstIncomplete = Math.max(
          0,
          modules.data.findIndex(
            module =>
              !progress.data.some(
                row => row.moduleId === module.id && row.isCompleted
              )
          )
        );
        let stored: Position = { module: firstIncomplete, slides: {} };
        if (value)
          try {
            const parsed = JSON.parse(value);
            if (
              Number.isInteger(parsed.module) &&
              parsed.module >= 0 &&
              parsed.module < modules.data.length
            )
              stored.module = parsed.module;
            if (parsed.slides && typeof parsed.slides === "object")
              stored.slides = Object.fromEntries(
                Object.entries(parsed.slides).filter(
                  ([, index]) =>
                    Number.isSafeInteger(index) && Number(index) >= 0
                )
              ) as Record<string, number>;
          } catch {}
        setPosition(current => current ?? stored);
      })
      .catch(() => {
        if (!disposed) setPosition({ module: 0, slides: {} });
      });
    return () => {
      disposed = true;
    };
  }, [key, modules.data, progress.data]);

  const remember = (next: Position) => {
    setPosition(next);
    void AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
  };
  const saveProgress = async (percent: number) => {
    target.current = Math.max(
      target.current,
      percent,
      enrollment.data?.progressPercent ?? 0
    );
    const revision = ++saveRevision.current;
    try {
      await update.mutateAsync({
        enrollmentId: id,
        progressPercent: target.current,
        status: "in_progress",
      });
      if (revision === saveRevision.current) setSaveFailed(false);
      void utils.dashboard.enrollments.invalidate();
    } catch {
      if (revision === saveRevision.current) setSaveFailed(true);
    }
  };
  const openPdf = async (url: string, title: string) => {
    setPdfBusy(true);
    setError("");
    try {
      await sharePdf(url, title);
    } catch (e) {
      setError(readableError(e, "Document indisponible."));
    } finally {
      setPdfBusy(false);
    }
  };
  if (!valid)
    return (
      <Screen>
        <Notice>Référence de formation invalide.</Notice>
        <Action title="Mes formations" onPress={() => router.replace("/")} />
      </Screen>
    );
  if (enrollment.data === null)
    return (
      <Screen>
        <Notice>
          Cette inscription n’est pas disponible dans votre compte.
        </Notice>
        <Action title="Mes formations" onPress={() => router.replace("/")} />
      </Screen>
    );
  if (queries.some(q => q.data === undefined) || !position)
    return (
      <Screen>
        <Action
          secondary
          title="Mes formations"
          onPress={() => router.back()}
        />
        {queries.some(q => q.isError) ? (
          <>
            <Notice>
              La formation n’a pas pu être chargée. Vérifiez votre connexion et
              vos droits d’accès.
            </Notice>
            <Action
              title="Réessayer"
              onPress={() => {
                for (const query of queries) void query.refetch();
              }}
            />
          </>
        ) : (
          <Loading message="Ouverture de votre formation…" />
        )}
      </Screen>
    );
  const training = enrollment.data!.training;
  const chapters = modules.data!;
  const allSlides = slides.data!;
  const rows = progress.data!;
  const active = chapters[position.module];
  const completed = (moduleId: number) =>
    rows.some(row => row.moduleId === moduleId && row.isCompleted);
  const locked = chapters.some(
    module => module.isRequired !== false && !completed(module.id)
  );
  const percent = chapters.length
    ? Math.round(
        (chapters.filter(module => completed(module.id)).length /
          chapters.length) *
          100
      )
    : (enrollment.data!.progressPercent ?? 0);
  const chapterSlides = active
    ? allSlides.filter(
        slide =>
          slide.moduleId === active.id ||
          (slide.moduleId == null && position.module === 0)
      )
    : allSlides;
  const slot = String(active?.id ?? "all");
  const passed = attempts.data!.some(attempt => attempt.isPassed);
  const goToExam = () =>
    router.push({ pathname: "/exam/[id]", params: { id: String(id) } });
  return (
    <Screen>
      <Action secondary title="Mes formations" onPress={() => router.back()} />
      <Heading>{training?.title ?? "Ma formation"}</Heading>
      <Copy muted>
        {percent} % · {training?.durationHours ?? "—"} h ·{" "}
        {training?.language?.toUpperCase() ?? "FR"}
      </Copy>
      <Meter value={percent} />
      {queries.some(q => q.isError) && (
        <Notice>
          Dernières données disponibles. L’actualisation a échoué ; les
          validations nécessitent une connexion.
        </Notice>
      )}
      {saveFailed && (
        <>
          <Notice>Votre dernière progression n’a pas été enregistrée.</Notice>
          <Action
            title="Réessayer la synchronisation"
            onPress={() => {
              void saveProgress(target.current);
            }}
            busy={update.isPending}
          />
        </>
      )}
      {!!error && <Notice>{error}</Notice>}
      {!!chapters.length && (
        <Card>
          <Heading small>Mon parcours</Heading>
          {chapters.map((module, index) => (
            <Action
              key={module.id}
              secondary={index !== position.module}
              title={`${completed(module.id) ? "✓" : ""} ${index + 1}. ${module.title}`}
              onPress={() => {
                remember({ ...position, module: index });
                setFinished(false);
              }}
            />
          ))}
        </Card>
      )}
      {active && (
        <Card>
          <Heading small>{active.title}</Heading>
          {!!active.description && <Copy muted>{active.description}</Copy>}
          {!!active.content && <Copy>{active.content}</Copy>}
          {!!active.videoUrl && (
            <CourseVideo key={`${active.id}:video`} url={active.videoUrl} />
          )}
          {!!active.pdfUrl && (
            <Action
              secondary
              title="Télécharger le support PDF"
              busy={pdfBusy}
              onPress={() => {
                void openPdf(active.pdfUrl!, active.title);
              }}
            />
          )}
        </Card>
      )}
      {!!chapterSlides.length && (
        <Card>
          <Slides
            key={`${id}:${slot}`}
            slides={chapterSlides}
            initialIndex={
              position.slides[slot] ??
              (chapters.length
                ? 0
                : Math.max(
                    0,
                    Math.floor((percent / 100) * chapterSlides.length) - 1
                  ))
            }
            language={training?.language}
            onEnter={index => {
              remember({
                ...position,
                slides: { ...position.slides, [slot]: index },
              });
              if (!chapters.length)
                void saveProgress(
                  Math.min(
                    99,
                    Math.round(((index + 1) / chapterSlides.length) * 100)
                  )
                );
            }}
            onFinish={() => {
              setFinished(true);
              if (!chapters.length) void saveProgress(100);
            }}
          />
          {finished && (
            <Notice>
              Vous avez atteint la fin de ces diapositives. Passez à
              l’évaluation pour valider vos acquis.
            </Notice>
          )}
        </Card>
      )}
      {active && (
        <Card>
          <Heading small>Évaluation du chapitre</Heading>
          <Copy muted>
            {completed(active.id)
              ? "Chapitre validé."
              : `${active.quizPassingScore} % requis · ${active.quizMaxAttempts} tentatives maximum`}
          </Copy>
          <Action
            title={
              completed(active.id)
                ? "Voir mon résultat"
                : "Commencer / reprendre l’évaluation"
            }
            onPress={() =>
              router.push({
                pathname: "/exam/[id]",
                params: { id: String(id), module: String(active.id) },
              })
            }
          />
        </Card>
      )}
      <Card>
        <Heading small>Évaluation finale</Heading>
        <Copy muted>
          {passed
            ? "Votre formation est validée."
            : locked
              ? "Validez les chapitres obligatoires avant de commencer l’évaluation finale."
              : `${training?.passingScore ?? 75} % requis · ${training?.maxAttempts ?? 3} tentatives maximum`}
        </Copy>
        {questions.data!.length ? (
          <Action
            title={
              passed
                ? "Voir mes résultats"
                : "Commencer / reprendre l’examen final"
            }
            disabled={locked && !passed}
            onPress={goToExam}
          />
        ) : (
          <Notice>
            L’évaluation finale n’est pas encore disponible pour cette
            formation.
          </Notice>
        )}
      </Card>
      {!!objectives.data?.length && (
        <Card>
          <Heading small>Objectifs pédagogiques</Heading>
          {objectives.data.map(objective => (
            <View key={objective.id}>
              <Copy>
                {objective.isCompleted ? "✓ " : "○ "}
                {objective.code ? `${objective.code} · ` : ""}
                {objective.title}
              </Copy>
            </View>
          ))}
        </Card>
      )}
      {passed && (
        <Action
          title="Mes certificats"
          onPress={() => router.push("/certificates")}
        />
      )}
    </Screen>
  );
}
