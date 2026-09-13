import LiveInstructorsDialog from "./LiveInstructorsDialog";
import SessionScheduleHistory from "./SessionScheduleHistory";
import SessionScheduleDialog from "./SessionScheduleDialog";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const DEEP_BLUE = "oklch(19% 0.08 252)";
const MUTED = "oklch(45% 0.02 240)";
const BORDER = "oklch(88% 0.015 88)";

export default function AdminSessions() {
  const { t, lang } = useI18n();
  const [instructorRoom,setInstructorRoom]=useState<number|null>(null);
  const [historyId,setHistoryId] = useState<number|null>(null);
  const [schedule,setSchedule] = useState<any>(null);
  const FORMATS = [["in_person", t("adminSessions.formatInPerson")], ["virtual", t("adminSessions.formatVirtual")], ["webinar", t("adminSessions.formatWebinar")]];
  const utils = trpc.useUtils();
  const { data: sessions = [] } = trpc.admin.sessions.list.useQuery();
  const { data: trainings = [] } = trpc.admin.trainings.list.useQuery();
  const [open, setOpen] = useState(false);
  const create = trpc.admin.sessions.create.useMutation({ onSuccess: () => { toast.success(t("adminSessions.toastCreated")); utils.admin.sessions.list.invalidate(); utils.public.sessions.invalidate(); setOpen(false); }, onError: (e) => toast.error(e.message) });
  const del = trpc.admin.sessions.delete.useMutation({ onSuccess: () => { toast.success(t("adminSessions.toastDeleted")); utils.admin.sessions.list.invalidate(); utils.public.sessions.invalidate(); } });

  const [form, setForm] = useState<any>({ title: "", trainingId: "", format: "in_person", location: "", instructorName: "", startDate: "", endDate: "", durationDays: "1", seats: 12, priceHt: "", language: "fr", cpfEligible: false });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.title || !form.startDate) return toast.error(t("adminSessions.toastTitleDateRequired"));
    if (!Number.isFinite(Date.parse(form.startDate)) || (form.endDate && !(Date.parse(form.endDate)>Date.parse(form.startDate))) || (form.format !== "in_person" && !form.endDate)) return toast.error(lang === "fr" ? "Renseignez une fin après le début pour la classe à distance." : lang === "ar" ? "أدخل وقت نهاية بعد البداية للفصل عن بعد." : "Enter an end after the start for the remote class.");
    create.mutate({
      title: form.title, trainingId: form.trainingId ? Number(form.trainingId) : null, format: form.format,
      location: form.location || undefined, instructorName: form.instructorName || undefined,
      startDate: new Date(form.startDate).toISOString(), endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
      durationDays: form.durationDays || undefined, seats: Number(form.seats), priceHt: form.priceHt || undefined,
      language: form.language, cpfEligible: !!form.cpfEligible,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold" style={{ color: DEEP_BLUE }}>{t("adminSessions.heading")}</h2>
        <Button size="sm" onClick={() => setOpen(true)} style={{ background: "oklch(68% 0.1 78)", color: DEEP_BLUE }}><Plus className="w-4 h-4 mr-1" /> {t("adminSessions.newSession")}</Button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <table className="w-full text-sm">
          <thead style={{ background: "oklch(93% 0.015 88)" }}><tr>{[t("adminSessions.colDate"), t("adminSessions.colTitle"), t("adminSessions.colFormat"), t("adminSessions.colLocation"), t("adminSessions.colSeats"), t("adminSessions.colPriceHt"), ""].map((h, idx) => <th key={idx} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: MUTED }}>{h}</th>)}</tr></thead>
          <tbody>
            {(sessions as any[]).map((s, i) => (
              <tr key={s.id} style={{ background: i % 2 ? "oklch(97% 0.01 88)" : "white", borderTop: `1px solid ${BORDER}` }}>
                <td className="px-4 py-3" style={{ color: MUTED }}>{new Date(s.startDate).toLocaleString(lang)}{s.endDate && <span className="block text-xs">→ {new Date(s.endDate).toLocaleString(lang)}</span>}</td>
                <td className="px-4 py-3 font-medium" style={{ color: DEEP_BLUE }}>{s.title}</td>
                <td className="px-4 py-3" style={{ color: MUTED }}>{(FORMATS.find((f) => f[0] === s.format) ?? [])[1] ?? s.format}</td>
                <td className="px-4 py-3" style={{ color: MUTED }}>{s.location ?? "—"}</td>
                <td className="px-4 py-3" style={{ color: MUTED }}>{s.seatsTaken}/{s.seats}</td>
                <td className="px-4 py-3" style={{ color: MUTED }}>{Number(s.priceHt) > 0 ? `${Number(s.priceHt).toFixed(0)} €` : t("adminSessions.free")}</td>
                <td className="px-4 py-3"><Button size="sm" variant="outline" onClick={()=>setInstructorRoom(s.id)}>{lang==='fr'?'Instructeurs':lang==='ar'?'المدربون':'Instructors'}</Button><Button size="sm" variant="outline" onClick={() => setHistoryId(s.id)}>{lang === "fr" ? "Historique" : lang === "ar" ? "السجل" : "History"}</Button><Button size="sm" variant="outline" disabled={s.status === "cancelled" || s.status === "completed"} onClick={() => setSchedule(s)}>{lang === "fr" ? "Horaires" : lang === "ar" ? "المواعيد" : "Schedule"}</Button><button title={t("sessions.cancelledClassAction")} disabled={s.status === "cancelled"} onClick={() => { if (confirm(t("adminSessions.confirmDelete"))) del.mutate({ id: s.id }); }} className="text-red-500"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {instructorRoom!=null&&<LiveInstructorsDialog key={instructorRoom} roomType="session" roomId={instructorRoom} onClose={()=>setInstructorRoom(null)}/>}
      {historyId != null && <SessionScheduleHistory key={historyId} id={historyId} onClose={() => setHistoryId(null)} />}
      {schedule && <SessionScheduleDialog key={schedule.id} session={schedule} onClose={() => setSchedule(null)} onSaved={() => {setSchedule(null);utils.admin.sessions.list.invalidate();utils.public.sessions.invalidate();utils.live.access.invalidate();utils.admin.sessions.scheduleHistory.invalidate();}} />}
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t("adminSessions.dialogTitle")}</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder={t("adminSessions.placeholderTitle")} value={form.title} onChange={(e) => set("title", e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.format} onChange={(e) => set("format", e.target.value)} className="h-9 rounded-md border px-3 text-sm" style={{ borderColor: BORDER }}>
                  {FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select value={form.trainingId} onChange={(e) => set("trainingId", e.target.value)} className="h-9 rounded-md border px-3 text-sm" style={{ borderColor: BORDER }}>
                  <option value="">{t("adminSessions.linkedTrainingOption")}</option>
                  {(trainings as any[]).map((t2) => <option key={t2.id} value={t2.id}>{t2.title}</option>)}
                </select>
              </div>
              <Input placeholder={t("adminSessions.placeholderLocation")} value={form.location} onChange={(e) => set("location", e.target.value)} />
              <Input placeholder={t("adminSessions.placeholderInstructor")} value={form.instructorName} onChange={(e) => set("instructorName", e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <div><label htmlFor="new-session-start" className="text-xs" style={{ color: MUTED }}>{t("adminSessions.labelStart")}</label><Input id="new-session-start" type="datetime-local" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></div>
                <div><label htmlFor="new-session-end" className="text-xs" style={{ color: MUTED }}>{t("adminSessions.labelEnd")}</label><Input id="new-session-end" type="datetime-local" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} /></div>
              </div>
              <p className="text-xs text-muted-foreground">{lang === "fr" ? "Heures locales du navigateur. Une fin après le début est obligatoire pour les classes à distance." : lang === "ar" ? "التوقيت المحلي للمتصفح. يجب تحديد نهاية بعد البداية للفصول عن بعد." : "Times use your browser’s local time zone. Remote classes require an end after the start."}</p>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs" style={{ color: MUTED }}>{t("adminSessions.labelDays")}</label><Input type="number" step="0.5" value={form.durationDays} onChange={(e) => set("durationDays", e.target.value)} /></div>
                <div><label className="text-xs" style={{ color: MUTED }}>{t("adminSessions.labelSeats")}</label><Input type="number" value={form.seats} onChange={(e) => set("seats", e.target.value)} /></div>
                <div><label className="text-xs" style={{ color: MUTED }}>{t("adminSessions.labelPriceHt")}</label><Input type="number" value={form.priceHt} onChange={(e) => set("priceHt", e.target.value)} /></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>{t("adminSessions.cancel")}</Button>
              <Button onClick={submit} disabled={create.isPending} style={{ background: DEEP_BLUE, color: "white" }}>{t("adminSessions.create")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
