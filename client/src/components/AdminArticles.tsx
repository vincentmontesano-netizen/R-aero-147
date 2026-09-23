import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

const DEEP_BLUE = "oklch(19% 0.08 252)";
const MUTED = "oklch(45% 0.02 240)";
const BORDER = "oklch(88% 0.015 88)";
const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);

export default function AdminArticles() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: articles = [] } = trpc.admin.articles.list.useQuery();
  const [edit, setEdit] = useState<any | null>(null);
  const refetch = () => { utils.admin.articles.list.invalidate(); utils.public.articles.invalidate(); };
  const create = trpc.admin.articles.create.useMutation({ onSuccess: () => { toast.success(t("adminArticles.toastCreated")); refetch(); setEdit(null); }, onError: (e) => toast.error(e.message) });
  const update = trpc.admin.articles.update.useMutation({ onSuccess: () => { toast.success(t("adminArticles.toastUpdated")); refetch(); setEdit(null); }, onError: (e) => toast.error(e.message) });
  const del = trpc.admin.articles.delete.useMutation({ onSuccess: () => { toast.success(t("adminArticles.toastDeleted")); refetch(); }, onError: e => toast.error(e.message) });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold" style={{ color: DEEP_BLUE }}>{t("adminArticles.heading")}</h2>
        <Button size="sm" onClick={() => setEdit({ title: "", slug: "", excerpt: "", content: "", category: "", author: "L'équipe R-AERO", isPublished: true })} style={{ background: "oklch(68% 0.1 78)", color: DEEP_BLUE }}><Plus className="w-4 h-4 mr-1" /> {t("adminArticles.newArticle")}</Button>
      </div>
      <div className="space-y-2">
        {(articles as any[]).map((a) => (
          <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "white", border: `1px solid ${BORDER}` }}>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate" style={{ color: DEEP_BLUE }}>{a.title}</div>
              <div className="text-xs" style={{ color: MUTED }}>{a.category ?? "—"} · {a.isPublished ? t("adminArticles.statusPublished") : t("adminArticles.statusDraft")}</div>
            </div>
            <button onClick={() => setEdit(a)} className="p-1.5 rounded hover:bg-black/5" style={{ color: MUTED }}><Pencil className="w-4 h-4" /></button>
            <button onClick={() => { if (confirm(t("adminArticles.confirmDelete"))) del.mutate({ id: a.id }); }} className="p-1.5 rounded hover:bg-black/5 text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{edit.id ? t("adminArticles.dialogTitleEdit") : t("adminArticles.dialogTitleNew")}</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder={t("adminArticles.placeholderTitle")} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value, slug: edit.id ? edit.slug : slugify(e.target.value) })} />
              <Input placeholder={t("adminArticles.placeholderSlug")} value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder={t("adminArticles.placeholderCategory")} value={edit.category ?? ""} onChange={(e) => setEdit({ ...edit, category: e.target.value })} />
                <Input placeholder={t("adminArticles.placeholderAuthor")} value={edit.author ?? ""} onChange={(e) => setEdit({ ...edit, author: e.target.value })} />
              </div>
              <Input placeholder={t("adminArticles.placeholderCoverImage")} value={edit.coverImageUrl ?? ""} onChange={(e) => setEdit({ ...edit, coverImageUrl: e.target.value })} />
              <textarea placeholder={t("adminArticles.placeholderExcerpt")} value={edit.excerpt ?? ""} onChange={(e) => setEdit({ ...edit, excerpt: e.target.value })} className="w-full rounded-md border px-3 py-2 text-sm h-16 resize-y" style={{ borderColor: BORDER }} />
              <textarea placeholder={t("adminArticles.placeholderContent")} value={edit.content ?? ""} onChange={(e) => setEdit({ ...edit, content: e.target.value })} className="w-full rounded-md border px-3 py-2 text-sm h-40 resize-y" style={{ borderColor: BORDER }} />
              <label className="flex items-center gap-2 text-sm" style={{ color: MUTED }}><input type="checkbox" checked={edit.isPublished} onChange={(e) => setEdit({ ...edit, isPublished: e.target.checked })} /> {t("adminArticles.statusPublished")}</label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setEdit(null)}>{t("adminArticles.cancel")}</Button>
              <Button
                disabled={create.isPending || update.isPending}
                onClick={() => {
                  if (!edit.title || !edit.slug) return toast.error(t("adminArticles.errorTitleSlugRequired"));
                  const payload = { title: edit.title, slug: edit.slug, excerpt: edit.excerpt, content: edit.content, coverImageUrl: edit.coverImageUrl, category: edit.category, author: edit.author, isPublished: edit.isPublished };
                  if (edit.id) update.mutate({ id: edit.id, ...payload, publishedAt: edit.isPublished ? (edit.publishedAt ?? new Date()) : null });
                  else create.mutate({ ...payload, publishedAt: edit.isPublished ? new Date().toISOString() : undefined });
                }}
                style={{ background: DEEP_BLUE, color: "white" }}
              >{t("adminArticles.save")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
