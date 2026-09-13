import { useI18n } from '@/i18n';

type Attempt = {
  id: number; attemptNumber: number | null; score: number | null; maxScore: number | null; isPassed: boolean | null;
  feedback: Array<{questionId: number; question?: string; isCorrect: boolean; explanation?: string | null}> | null;
};

/** Read recorded results only; expanding a row never starts or submits an exam. */
export default function ExamAttemptHistory({ attempts, title }: { attempts: Attempt[]; title?: string }) {
  const { t } = useI18n();
  if (!attempts.length) return null;
  return <section className="my-6 space-y-3 text-start" aria-label={title ?? t('examHistory.title')}>
    <h3 className="font-semibold">{title ?? t('examHistory.title')}</h3>
    {attempts.map(attempt => <details key={attempt.id} className="rounded-lg border bg-white p-4">
      <summary className="cursor-pointer font-medium">
        {t('examHistory.attempt', {number: attempt.attemptNumber ?? '—', score: attempt.score ?? '—', max: attempt.maxScore ?? '—'})}
        {' · '}{t(attempt.isPassed ? 'examHistory.passed' : 'examHistory.failed')}
      </summary>
      {attempt.feedback === null ? <p className="mt-3 text-sm">{t('learningPlayer.historicalFeedbackUnavailable')}</p> : <ol className="mt-4 space-y-4">
        {attempt.feedback.map((item, index) => <li key={item.questionId}>
          <p className="text-sm font-medium">{item.question ?? t('examHistory.question', {number: index + 1})}</p>
          <p className="text-sm">{t(item.isCorrect ? 'examHistory.correct' : 'examHistory.incorrect')}</p>
          {item.explanation && <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{item.explanation}</p>}
        </li>)}
      </ol>}
    </details>)}
  </section>;
}
