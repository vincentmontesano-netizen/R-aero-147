import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
export default function ExamFinalizationAlerts() {
  const { t, lang } = useI18n();
  const failures = trpc.admin.examFinalizationFailures.useQuery(undefined, { refetchInterval: 60000 });
  if (failures.isError) return <p role="alert">{failures.error.message}</p>;
  if (!failures.data?.length) return null;
  return <section className="border rounded-lg p-4 mb-4 bg-amber-50">
    <h3 className="font-semibold">{t("examFinalization.title")}</h3>
    <p className="text-sm mb-2">{t("examFinalization.help")}</p>
    {failures.data.map(row => <p key={row.sessionId} className="text-xs py-1">{t("examFinalization.row", { session: row.sessionId, enrollment: row.enrollmentId, count: row.failureCount })} · {t("examFinalization.retry", { date: new Date(row.retryAfter).toLocaleString(lang) })}</p>)}
  </section>;
}
