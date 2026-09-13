import { TRPCClientError } from "@trpc/client";
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { toast } from "sonner";
const formats = { image: "image/png,image/jpeg", audio: "audio/mpeg", video: "video/mp4", pdf: "application/pdf" };
type UploadProps = { trainingId: number; kind: keyof typeof formats; onUploaded: (url: string) => void; disabled?: boolean; onStart?: () => boolean; onFinish?: () => void };

export default function PrivateMediaUpload(props: UploadProps) {
  return <MediaUploadInput key={`${props.trainingId}:${props.kind}`} {...props} />;
}

function MediaUploadInput({ trainingId, kind, onUploaded, disabled, onStart, onFinish }: UploadProps) {
  const { lang } = useI18n();
  const tr = (fr: string, en: string, ar: string) => lang === 'fr' ? fr : lang === 'ar' ? ar : en;
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<'validation' | 'read' | 'upload' | 'rejected' | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  const activeReader = useRef<FileReader | null>(null);
  const finish = useRef<(() => void) | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; activeReader.current?.abort(); finish.current?.(); };
  }, []);
  const upload = trpc.maker.uploadMedia.useMutation();
  const busy = reading || upload.isPending;
  const errors = {
    rejected: tr('Le serveur a refusé ce fichier pour cette tentative. Vérifiez son format, son contenu et sa taille avant de réessayer.', 'The server rejected this file for this attempt. Check its format, content and size before retrying.', 'رفض الخادم هذا الملف لهذه المحاولة. تحقّق من صيغته ومحتواه وحجمه قبل إعادة المحاولة.'),
    validation: tr('Choisissez un fichier non vide au format indiqué, de 25 Mo maximum.', 'Choose a non-empty file in the indicated format, up to 25 MB.', 'اختر ملفًا غير فارغ بالصيغة المحددة، لا يتجاوز 25 ميغابايت.'),
    read: tr('Le fichier n’a pas pu être lu pour cette tentative. Sélectionnez-le à nouveau pour réessayer.', 'The file could not be read for this attempt. Select it again to retry.', 'تعذّرت قراءة الملف لهذه المحاولة. حدّده مجددًا لإعادة المحاولة.'),
    upload: tr('L’import n’a pas été confirmé. Le brouillon n’a pas été modifié par cette tentative. Un fichier peut avoir été enregistré ; un renvoi peut créer une copie.', 'The upload was not confirmed. This attempt did not change the draft. A file may have been stored; retrying may create a copy.', 'لم يتم تأكيد الاستيراد. لم تُعدّل هذه المحاولة المسودة. قد يكون الملف قد حُفظ؛ وقد تؤدي إعادة المحاولة إلى إنشاء نسخة.'),
  };
  const send = async (file: File) => {
    if (running.current || disabled) return;
    setProblem(null);
    if (!file.size || file.size > 25 * 1024 * 1024 || !formats[kind].split(',').includes(file.type)) { setProblem('validation'); return; }
    if (onStart?.() === false) return;
    finish.current = () => { finish.current = null; onFinish?.(); };
    running.current = true;
    setReading(true);
    try {
      let base64: string;
      try {
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader(); activeReader.current = reader;
          reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
          reader.onerror = () => reject(reader.error);
          reader.onabort = () => reject(new Error('File reading aborted'));
          reader.readAsDataURL(file);
        });
      } catch { if (mounted.current) setProblem('read'); return; }
      if (!mounted.current) return;
      let result: { url: string };
      try {
        result = await upload.mutateAsync({ trainingId, contentType: file.type as 'image/png' | 'image/jpeg' | 'audio/mpeg' | 'video/mp4' | 'application/pdf', base64 });
      } catch (error) {
        if (mounted.current) { setProblem(error instanceof TRPCClientError && error.data?.code === 'BAD_REQUEST' ? 'rejected' : 'upload'); if (error instanceof Error) toast.error(error.message); }
        return;
      }
      if (!mounted.current) return;
      onUploaded(result.url);
      toast.success(tr('Fichier importé. Enregistrez le contenu pour le rattacher.', 'File uploaded. Save the content to attach it.', 'تم الاستيراد. احفظ المحتوى لربط الملف.'));
    } finally {
      activeReader.current = null;
      running.current = false;
      finish.current?.();
      if (mounted.current) setReading(false);
    }
  };
  return <div className="mt-2 space-y-2 text-xs text-slate-600">
    <label className="block">{tr('Importer un fichier privé', 'Upload private file', 'استيراد ملف خاص')} · {{ image: 'PNG, JPEG', audio: 'MP3', video: 'MP4', pdf: 'PDF' }[kind]} · 25 {lang === 'fr' ? 'Mo' : 'MB'}
      <input type="file" accept={formats[kind]} disabled={busy || disabled} className="block w-full mt-1 text-xs file:rounded file:border file:bg-white file:px-2 file:py-1 disabled:opacity-50" onChange={event => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (file) void send(file);
      }} />
    </label>
    {busy && <p role="status">{tr('Import en cours…', 'Uploading…', 'جارٍ الاستيراد…')}</p>}
    {problem && <p role="alert" className="text-red-700">{errors[problem]}</p>}
  </div>;
}
