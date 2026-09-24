import { readableError } from "../../src/errors";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  BackHandler,
  Modal,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { api, apiClient, sessionToken, type Outputs } from "../../src/api";
import {
  Action,
  Card,
  Copy,
  Field,
  Heading,
  Loading,
  Meter,
  Notice,
  Screen,
} from "../../src/ui";
import { Choice } from "../../src/Media";
import {
  isAnswered,
  selectMatch,
  selectOption,
  type Answer,
  type Answers,
} from "../../src/examAnswers";
import { createExamCountdown } from "../../../shared/examCountdown";
import { useTheme } from "../../src/theme";

type Session = NonNullable<Outputs["learning"]["startExam"]>;
type Result = NonNullable<Outputs["learning"]["submitQuiz"]>;

export default function Exam() {
  const params = useLocalSearchParams<{ id: string; module?: string }>();
  const id = Number(params.id);
  const moduleId = params.module ? Number(params.module) : undefined;
  const valid =
    Number.isSafeInteger(id) &&
    id > 0 &&
    (moduleId === undefined ||
      (Number.isSafeInteger(moduleId) && moduleId > 0));
  const enrollment = api.dashboard.enrollment.useQuery(
    { id },
    { enabled: valid }
  );
  const modules = api.learning.modules.useQuery(
    { trainingId: enrollment.data?.trainingId ?? 0, enrollmentId: id },
    { enabled: !!enrollment.data }
  );
  const attempts = api.learning.quizAttempts.useQuery(
    { enrollmentId: id, moduleId },
    { enabled: !!enrollment.data }
  );
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const begin = async () => {
    if (!enrollment.data) return;
    setBusy(true);
    setError("");
    try {
      const data = await apiClient.learning.startExam.mutate({
        enrollmentId: id,
        trainingId: enrollment.data.trainingId,
        moduleId,
        attemptNumber: (attempts.data?.length ?? 0) + 1,
      });
      if (!data) throw new Error("L’évaluation n’est pas disponible.");
      setSession(data);
    } catch (e) {
      setError(readableError(e, "L’évaluation n’a pas pu démarrer."));
    } finally {
      setBusy(false);
    }
  };
  if (!valid)
    return (
      <Screen>
        <Notice>Référence d’évaluation invalide.</Notice>
        <Action title="Mes formations" onPress={() => router.replace("/")} />
      </Screen>
    );
  if (enrollment.data === null)
    return (
      <Screen>
        <Notice>Inscription introuvable.</Notice>
        <Action title="Mes formations" onPress={() => router.replace("/")} />
      </Screen>
    );
  if (!enrollment.data || !attempts.data || !modules.data)
    return (
      <Screen>
        {enrollment.isError || attempts.isError || modules.isError ? (
          <>
            <Notice>
              Impossible de charger les informations de l’évaluation.
            </Notice>
            <Action
              title="Réessayer"
              onPress={() => {
                void enrollment.refetch();
                void attempts.refetch();
                void modules.refetch();
              }}
            />
          </>
        ) : (
          <Loading />
        )}
        <Action
          secondary
          title="Retour à la formation"
          onPress={() => router.back()}
        />
      </Screen>
    );
  const module = modules.data.find(value => value.id === moduleId);
  const training = enrollment.data.training;
  if (moduleId && !module)
    return (
      <Screen>
        <Notice>Ce chapitre n’appartient pas à cette formation.</Notice>
        <Action title="Retour" onPress={() => router.back()} />
      </Screen>
    );
  const title = module?.title ?? "Évaluation finale";
  const max = module?.quizMaxAttempts ?? training?.maxAttempts ?? 3;
  const score = module?.quizPassingScore ?? training?.passingScore ?? 75;
  const time = module?.quizTimeLimitMin ?? training?.examTimeLimitMin;
  if (session)
    return (
      <ExamSession
        key={session.sessionId}
        session={session}
        enrollmentId={id}
        trainingId={enrollment.data.trainingId}
        moduleId={moduleId}
        title={title}
      />
    );
  const passed = attempts.data.some(attempt => attempt.isPassed);
  return (
    <Screen>
      <Action
        secondary
        title="Retour à la formation"
        onPress={() => router.back()}
      />
      <Heading>{title}</Heading>
      <Card>
        <Copy>
          {score} % requis · {max} tentatives maximum
        </Copy>
        <Copy muted>
          {time
            ? `Temps disponible : ${time} minutes.`
            : "La durée et les consignes sont celles de votre parcours."}
        </Copy>
        <Notice>
          Le temps continue lorsque vous quittez l’écran ou passez l’application
          en arrière-plan. Les réponses enregistrées sont récupérées à la
          reprise. Les passages en arrière-plan sont signalés dans le suivi de
          l’examen.
        </Notice>
        <Copy muted>
          Assurez-vous de disposer d’une connexion stable. Une perte de
          connexion ne suspend pas l’échéance du serveur.
        </Copy>
      </Card>
      {!!error && <Notice>{error}</Notice>}
      {passed ? (
        <Notice>Cette évaluation est validée.</Notice>
      ) : attempts.data.length >= max ? (
        <Notice>
          Vous avez utilisé les tentatives disponibles. Contactez l’équipe
          pédagogique.
        </Notice>
      ) : (
        <Action
          title="Commencer / reprendre l’évaluation"
          busy={busy}
          onPress={() => {
            void begin();
          }}
          testID="exam-start"
        />
      )}
      {!!attempts.data.length && (
        <Card>
          <Heading small>Mes tentatives</Heading>
          {attempts.data.map(attempt => (
            <View key={attempt.id} style={{ gap: 6 }}>
              <Copy>
                Tentative {attempt.attemptNumber} · {attempt.score} /{" "}
                {attempt.maxScore} ·{" "}
                {attempt.isPassed ? "Validée" : "À reprendre"}
              </Copy>
              <Copy muted>
                {attempt.completedAt
                  ? new Date(attempt.completedAt).toLocaleString("fr-FR")
                  : ""}
              </Copy>
              {attempt.feedback?.map(feedback => (
                <Copy key={feedback.questionId} muted>
                  {feedback.isCorrect ? "✓" : "○"}{" "}
                  {feedback.question ?? `Question ${feedback.questionId}`}
                  {feedback.explanation ? ` — ${feedback.explanation}` : ""}
                </Copy>
              ))}
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function ExamSession({
  session: initial,
  enrollmentId,
  trainingId,
  moduleId,
  title,
}: {
  session: Session;
  enrollmentId: number;
  trainingId: number;
  moduleId?: number;
  title: string;
}) {
  useKeepAwake();
  const { colors } = useTheme();
  const utils = api.useUtils();
  const [session, setSession] = useState(initial);
  const [answers, setAnswers] = useState<Answers>(
    initial.savedAnswers as Answers
  );
  const current = useRef<Answers>(initial.savedAnswers as Answers);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submitBusy = useRef(false);
  const submitted = useRef(false);
  const frozen = useRef<Answers | null>(null);
  const [saveState, setSaveState] = useState<
    "saved" | "saving" | "error" | "conflict"
  >("saved");
  const revision = useRef(initial.answerRevision);
  const fingerprint = useRef(JSON.stringify(initial.savedAnswers));
  const saving = useRef<Promise<void> | null>(null);
  const conflicted = useRef(false);
  const [saveTick, setSaveTick] = useState(0);
  const clock = useRef<(() => number) | null>(
    initial.expiresAt
      ? createExamCountdown(
          new Date(initial.expiresAt).getTime(),
          initial.serverNow
        )
      : null
  );
  const [remaining, setRemaining] = useState<number | null>(
    clock.current?.() ?? null
  );
  const active = useRef(true);
  const [matchLeft, setMatchLeft] = useState<number | null>(null);
  const [certificateError, setCertificateError] = useState("");
  const [certificateBusy, setCertificateBusy] = useState(false);
  const [certificate, setCertificate] = useState<
    Outputs["learning"]["issueCertificate"] | null
  >(null);

  useEffect(
    () => () => {
      active.current = false;
    },
    []
  );
  const generateCertificate = async () => {
    setCertificateBusy(true);
    setCertificateError("");
    try {
      setCertificate(
        await apiClient.learning.issueCertificate.mutate({ enrollmentId })
      );
      void utils.dashboard.certificates.invalidate();
    } catch {
      setCertificateError(
        "Votre résultat est enregistré, mais le certificat n’a pas pu être récupéré."
      );
    } finally {
      setCertificateBusy(false);
    }
  };
  const submit = async () => {
    if (submitBusy.current || submitted.current) return;
    frozen.current ??= current.current;
    submitBusy.current = true;
    setSubmitting(true);
    setSubmitError("");
    const credential = sessionToken();
    try {
      const data = await apiClient.learning.submitQuiz.mutate({
        enrollmentId,
        trainingId,
        sessionId: session.sessionId,
        attemptNumber: session.attemptNumber,
        answers: frozen.current,
      });
      if (!data) throw new Error("Le résultat n’est pas encore disponible.");
      if (!active.current || credential !== sessionToken()) return;
      submitted.current = true;
      setResult(data);
      void utils.dashboard.enrollments.invalidate();
      void utils.dashboard.enrollment.invalidate();
      void utils.learning.moduleProgress.invalidate();
      void utils.learning.quizAttempts.invalidate();
      void utils.learning.objectiveProgress.invalidate();
      if (data.isPassed && moduleId === undefined) void generateCertificate();
    } catch (e) {
      if (active.current)
        setSubmitError(
          readableError(
            e,
            "Vos réponses n’ont pas pu être transmises. Réessayez."
          )
        );
    } finally {
      submitBusy.current = false;
      if (active.current) setSubmitting(false);
    }
  };

  const save = async () => {
    // A navigation-triggered save also waits for an older request, then flushes
    // the latest answer. Otherwise a quick edit + Back could lose that edit.
    while (saving.current) await saving.current;
    if (
      !active.current ||
      submitted.current ||
      frozen.current ||
      conflicted.current
    )
      return;
    const snapshot = current.current;
    const serialized = JSON.stringify(snapshot);
    if (serialized === fingerprint.current) return;
    let release!: () => void;
    saving.current = new Promise<void>(resolve => {
      release = resolve;
    });
    setSaveState("saving");
    try {
      const data = await apiClient.learning.saveExamAnswers.mutate({
        sessionId: session.sessionId,
        revision: revision.current,
        answers: snapshot,
      });
      if (active.current) {
        revision.current = data.revision;
        fingerprint.current = serialized;
        setSaveState(
          JSON.stringify(current.current) === serialized ? "saved" : "saving"
        );
        setSaveTick(t => t + 1);
      }
    } catch (e) {
      conflicted.current = (e as any)?.data?.code === "CONFLICT";
      if (active.current)
        setSaveState(conflicted.current ? "conflict" : "error");
    } finally {
      saving.current = null;
      release();
    }
  };
  useEffect(() => {
    if (submitted.current || frozen.current || saveState === "conflict") return;
    if (JSON.stringify(answers) === fingerprint.current) return;
    setSaveState("saving");
    const timer = setTimeout(() => {
      void save();
    }, 400);
    return () => clearTimeout(timer);
  }, [answers, saveTick]);

  useEffect(() => {
    const tick = () => {
      if (!clock.current || submitted.current) return;
      const left = clock.current();
      setRemaining(left);
      if (left === 0 && !frozen.current) void submit();
    };
    if (initial.completed) {
      frozen.current = {};
      void submit();
    } else tick();
    const interval = setInterval(tick, 500);
    const app = AppState.addEventListener("change", state => {
      if (submitted.current) return;
      if (state !== "active") {
        void save();
        void apiClient.learning.logProctoringEvent
          .mutate({
            sessionId: session.sessionId,
            type: "mobile_background",
            detail: "L’application est passée en arrière-plan.",
          })
          .catch(() => {});
      } else tick();
    });
    return () => {
      clearInterval(interval);
      app.remove();
    };
  }, [session.sessionId]);

  const leave = () => {
    if (result) {
      router.back();
      return;
    }
    Alert.alert(
      "Quitter l’évaluation ?",
      "Le temps continue. Seules les réponses enregistrées pourront être reprises.",
      [
        { text: "Rester", style: "cancel" },
        {
          text: "Quitter",
          onPress: () => {
            void save().finally(() => router.back());
          },
        },
      ]
    );
  };
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      leave();
      return true;
    });
    return () => listener.remove();
  }, [result]);
  const reload = async () => {
    try {
      const data = await apiClient.learning.startExam.mutate({
        enrollmentId,
        trainingId,
        moduleId,
        attemptNumber: session.attemptNumber,
        resumeSessionId: session.sessionId,
      });
      if (!data) throw new Error("Session indisponible");
      current.current = data.savedAnswers as Answers;
      setAnswers(current.current);
      revision.current = data.answerRevision;
      fingerprint.current = JSON.stringify(data.savedAnswers);
      conflicted.current = false;
      setSaveState("saved");
      setSession(data);
      clock.current = data.expiresAt
        ? createExamCountdown(
            new Date(data.expiresAt).getTime(),
            data.serverNow
          )
        : null;
      if (data.completed) {
        frozen.current = {};
        void submit();
      }
    } catch {
      setSaveState("error");
    }
  };
  const change = (value: Answer) => {
    if (
      frozen.current ||
      submitted.current ||
      remaining === 0 ||
      saveState === "conflict"
    )
      return;
    const next = { ...current.current, [session.questions[index].id]: value };
    current.current = next;
    setAnswers(next);
  };
  const answered = session.questions.filter(question =>
    isAnswered(question, answers[question.id])
  ).length;
  const question = session.questions[index];
  const answer = answers[question?.id];
  const locked =
    submitting ||
    !!frozen.current ||
    remaining === 0 ||
    saveState === "conflict";
  if (result)
    return (
      <Screen>
        <Stack.Screen options={{ gestureEnabled: true }} />
        <Heading>
          {result.isPassed ? "Évaluation validée" : "Évaluation terminée"}
        </Heading>
        <Card>
          <Heading small>
            {result.score} / {result.maxScore}
          </Heading>
          <Copy>
            {result.isPassed
              ? "Votre résultat a été enregistré dans votre parcours."
              : "Consultez le résultat avant une nouvelle tentative, si votre parcours le permet."}
          </Copy>
          {result.feedback?.map(feedback => (
            <Copy key={feedback.questionId}>
              {feedback.isCorrect ? "✓" : "○"}{" "}
              {feedback.question ?? `Question ${feedback.questionId}`}
              {feedback.explanation ? ` — ${feedback.explanation}` : ""}
            </Copy>
          ))}
        </Card>
        {!!certificateError && (
          <>
            <Notice>{certificateError}</Notice>
            <Action
              title="Récupérer mon certificat"
              busy={certificateBusy}
              onPress={() => {
                void generateCertificate();
              }}
            />
          </>
        )}
        {certificateBusy && <Loading message="Préparation du certificat…" />}
        {certificate && (
          <Notice>
            Certificat {certificate.certificateNumber} disponible dans votre
            espace.
          </Notice>
        )}
        <Action title="Retour à ma formation" onPress={() => router.back()} />
        {result.isPassed && moduleId === undefined && (
          <Action
            secondary
            title="Mes certificats"
            onPress={() => router.replace("/certificates")}
          />
        )}
      </Screen>
    );
  if (!question)
    return (
      <Screen>
        <Notice>Aucune question n’est disponible.</Notice>
        <Action title="Retour à la formation" onPress={leave} />
      </Screen>
    );
  return (
    <Screen>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <Action secondary title="Retour à la formation" onPress={leave} />
      <Heading>{title}</Heading>
      <Card>
        <Copy>
          Tentative {session.attemptNumber} · {session.passingScore} % requis
        </Copy>
        {remaining !== null && (
          <Text
            accessibilityLiveRegion="polite"
            style={{
              fontSize: 30,
              fontWeight: "700",
              color: remaining <= 60 ? colors.error : colors.gold,
            }}
          >
            {Math.floor(remaining / 60)}:
            {String(remaining % 60).padStart(2, "0")}
          </Text>
        )}
        <Copy muted>
          {answered} / {session.questions.length} réponses renseignées ·{" "}
          {saveState === "saved"
            ? "Enregistrées"
            : saveState === "saving"
              ? "Enregistrement…"
              : saveState === "conflict"
                ? "Modification depuis un autre appareil"
                : "Enregistrement à réessayer"}
        </Copy>
        <Meter value={(answered / session.questions.length) * 100} />
      </Card>
      {saveState === "error" && !frozen.current && (
        <>
          <Notice>La dernière réponse n’est pas encore enregistrée.</Notice>
          <Action
            secondary
            title="Réessayer l’enregistrement"
            onPress={() => {
              void save();
            }}
          />
        </>
      )}
      {saveState === "conflict" && !frozen.current && (
        <>
          <Notice>
            La session a changé sur un autre appareil ou est terminée. Rechargez
            les réponses du serveur avant de continuer.
          </Notice>
          <Action
            title="Recharger la session"
            onPress={() =>
              Alert.alert(
                "Recharger les réponses",
                "Les modifications locales non enregistrées seront remplacées par les réponses du serveur.",
                [
                  { text: "Annuler", style: "cancel" },
                  {
                    text: "Recharger",
                    onPress: () => {
                      void reload();
                    },
                  },
                ]
              )
            }
          />
        </>
      )}
      <Card>
        <Copy muted>
          Question {index + 1} sur {session.questions.length}
        </Copy>
        <Heading small>{question.question}</Heading>
        {question.type === "free_text" ? (
          <Field
            label="Votre réponse"
            multiline
            style={{ minHeight: 130, textAlignVertical: "top" }}
            value={typeof answer === "string" ? answer : ""}
            onChangeText={change}
            editable={!locked}
            maxLength={10000}
          />
        ) : question.type === "matching" ? (
          (question.options ?? []).map((left, li) => {
            const value = Array.isArray(answer)
              ? answer.find(pair => Array.isArray(pair) && pair[0] === li)
              : undefined;
            const ri = Array.isArray(value) ? value[1] : undefined;
            return (
              <Action
                key={li}
                secondary
                title={`${left} → ${ri === undefined ? "Choisir une correspondance" : (question.optionsRight?.[ri] ?? "Choisir")}`}
                disabled={locked}
                onPress={() => setMatchLeft(li)}
              />
            );
          })
        ) : (
          (question.options ?? []).map((option, oi) => (
            <Choice
              key={oi}
              label={option}
              selected={
                Array.isArray(answer) && answer.some(value => value === oi)
              }
              disabled={locked}
              onPress={() => change(selectOption(question, answer, oi))}
            />
          ))
        )}
        {question.type === "qcm" && (
          <Copy muted>Plusieurs réponses peuvent être correctes.</Copy>
        )}
      </Card>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Action
            secondary
            title="Précédente"
            disabled={index === 0}
            onPress={() => setIndex(i => i - 1)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Action
            secondary
            title="Suivante"
            disabled={index === session.questions.length - 1}
            onPress={() => setIndex(i => i + 1)}
          />
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {session.questions.map((q, qi) => (
          <Action
            key={q.id}
            secondary={qi !== index}
            title={`${isAnswered(q, answers[q.id]) ? "✓ " : ""}${qi + 1}`}
            onPress={() => setIndex(qi)}
          />
        ))}
      </View>
      {!!submitError && <Notice>{submitError}</Notice>}
      <Action
        title={
          frozen.current
            ? "Réessayer l’envoi des réponses"
            : "Terminer et envoyer mes réponses"
        }
        busy={submitting}
        disabled={!frozen.current && answered !== session.questions.length}
        onPress={() => {
          if (frozen.current) void submit();
          else
            Alert.alert(
              "Envoyer l’évaluation",
              "Les réponses ne pourront plus être modifiées après l’envoi.",
              [
                { text: "Vérifier mes réponses", style: "cancel" },
                {
                  text: "Envoyer",
                  onPress: () => {
                    void submit();
                  },
                },
              ]
            );
        }}
        testID="exam-submit"
      />
      <Modal
        visible={matchLeft !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMatchLeft(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 24,
            backgroundColor: "#0009",
          }}
        >
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 20,
              maxHeight: "85%",
              gap: 16,
            }}
          >
            <Heading small>{question.options?.[matchLeft ?? 0]}</Heading>
            <ScrollView contentContainerStyle={{ gap: 10 }}>
              {(question.optionsRight ?? []).map((right, ri) => (
                <Action
                  key={ri}
                  secondary
                  title={right}
                  onPress={() => {
                    if (matchLeft !== null)
                      change(selectMatch(answer, matchLeft, ri));
                    setMatchLeft(null);
                  }}
                />
              ))}
            </ScrollView>
            <Action
              secondary
              title="Annuler"
              onPress={() => setMatchLeft(null)}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
