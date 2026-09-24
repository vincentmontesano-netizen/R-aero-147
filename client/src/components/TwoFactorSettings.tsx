import { announceSessionChange } from '@/lib/sessionChange';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function TwoFactorSettings({enabled}:{enabled:boolean}) {
  const {lang}=useI18n();
  const utils=trpc.useUtils();
  const [stage,setStage]=useState<'idle'|'password'|'code'>('idle');
  const [target,setTarget]=useState(false);
  const [password,setPassword]=useState('');
  const [code,setCode]=useState('');
  const c=lang==='fr'?{
    title:'Double authentification par email',on:'Activée',off:'Désactivée',enable:'Activer',disable:'Désactiver',
    explain:'Confirmez votre mot de passe puis le code reçu par email. Le réglage change uniquement après validation. Les autres appareils seront déconnectés.',
    password:'Mot de passe actuel',send:'Recevoir le code',code:'Code à six chiffres',confirm:'Confirmer le changement',cancel:'Annuler',
    sent:'Un code de confirmation a été envoyé. Il reste valable dix minutes.',done:'Réglage confirmé. Les autres sessions ont été déconnectées.',error:'Vérification impossible. Contrôlez vos informations. Si vous venez de demander un code, attendez une minute avant de réessayer.',
  }:lang==='ar'?{
    title:'المصادقة الثنائية عبر البريد',on:'مفعّلة',off:'غير مفعّلة',enable:'تفعيل',disable:'تعطيل',
    explain:'أكّد كلمة المرور ثم الرمز المرسل بالبريد. لن يتغير الإعداد إلا بعد التحقق. سيتم تسجيل الخروج من الأجهزة الأخرى.',
    password:'كلمة المرور الحالية',send:'إرسال الرمز',code:'رمز من ستة أرقام',confirm:'تأكيد التغيير',cancel:'إلغاء',
    sent:'تم إرسال رمز صالح لمدة عشر دقائق.',done:'تم تأكيد الإعداد وتسجيل الخروج من الجلسات الأخرى.',error:'تعذر التحقق. راجع المعلومات وانتظر دقيقة قبل طلب رمز جديد.',
  }:{
    title:'Two-factor authentication by email',on:'Enabled',off:'Disabled',enable:'Enable',disable:'Disable',
    explain:'Confirm your password, then the code sent by email. The setting changes only after verification. Other devices will be signed out.',
    password:'Current password',send:'Send code',code:'Six-digit code',confirm:'Confirm change',cancel:'Cancel',
    sent:'A confirmation code was sent. It is valid for ten minutes.',done:'Setting confirmed. Other sessions have been signed out.',error:'Verification failed. Check your details. If you just requested a code, wait one minute before trying again.',
  };
  const begin=trpc.auth.beginTwoFactorChange.useMutation({onSuccess:()=>{setPassword('');setStage('code');toast.success(c.sent);},onError:()=>{setPassword('');toast.error(c.error);}});
  const confirm=trpc.auth.confirmTwoFactorChange.useMutation({onSuccess:async()=>{setCode('');announceSessionChange();await utils.auth.me.invalidate();setStage('idle');toast.success(c.done);},onError:()=>{setCode('');toast.error(c.error);}});
  const pending=begin.isPending||confirm.isPending;
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <div><h3 className="text-sm font-medium">{c.title}</h3><p className="text-xs text-muted-foreground">{enabled?c.on:c.off}</p></div>
      {stage==='idle'&&<Button type="button" variant="outline" onClick={()=>{setTarget(!enabled);setStage('password');}}>{enabled?c.disable:c.enable}</Button>}
    </div>
    {stage!=='idle'&&<form className="space-y-3" onSubmit={event=>{event.preventDefault();if(pending)return;if(stage==='password')begin.mutate({enabled:target,password});else confirm.mutate({enabled:target,code});}}>
      <p className="text-sm text-muted-foreground">{c.explain}</p>
      <p className="text-sm font-medium">{target?c.enable:c.disable}</p>
      {stage==='password'?<><label htmlFor="two-factor-password" className="block text-sm">{c.password}</label><Input id="two-factor-password" type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={event=>setPassword(event.target.value)} disabled={pending}/></>:<><label htmlFor="two-factor-code" className="block text-sm">{c.code}</label><Input id="two-factor-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} value={code} onChange={event=>setCode(event.target.value.replace(/[^0-9]/g,''))} disabled={pending}/></>}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={pending||(stage==='password'?!password:code.length!==6)}>{stage==='password'?c.send:c.confirm}</Button><Button type="button" variant="ghost" disabled={pending} onClick={()=>{setStage('idle');setPassword('');setCode('');}}>{c.cancel}</Button></div>
    </form>}
  </div>;
}
