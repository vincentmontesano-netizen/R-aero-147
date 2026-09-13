export type CertificateLanguage = 'fr' | 'en' | 'ar';
export function certificateLanguage(value: unknown): CertificateLanguage {
  const language = typeof value === 'string' ? value.trim().toLowerCase().split(/[-_]/)[0] : '';
  return language === 'en' || language === 'ar' ? language : 'fr';
}
export const certificateLabels = {
  fr: {tracking:'SUIVI ET ÉVALUATION DE FORMATION',title:'CERTIFICAT DE FORMATION',completed:'a complété avec succès la formation',reference:'Référence de formation',duration:'DURÉE',hours:'h',completedOn:'DATE DE COMPLÉTION',validUntil:"VALABLE JUSQU’AU",indefinite:'Indéterminé',recorded:'Émission enregistrée sur la plateforme R-AERO',number:'N°',verification:'Vérification'},
  en: {tracking:'TRAINING RECORD AND ASSESSMENT',title:'TRAINING CERTIFICATE',completed:'has successfully completed the training',reference:'Training reference',duration:'DURATION',hours:'h',completedOn:'COMPLETED ON',validUntil:'VALID UNTIL',indefinite:'Not specified',recorded:'Issuance recorded on the R-AERO platform',number:'No.',verification:'Verification'},
  ar: {tracking:'متابعة التدريب والتقييم',title:'شهادة تدريب',completed:'أكمل بنجاح الدورة التدريبية',reference:'مرجع التدريب',duration:'المدة',hours:'ساعة',completedOn:'تاريخ الإكمال',validUntil:'صالحة حتى',indefinite:'غير محدد',recorded:'تم تسجيل الإصدار على منصة R-AERO',number:'رقم',verification:'التحقق'},
} as const;
export function certificateDate(date: Date, language: CertificateLanguage) {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : language === 'fr' ? 'fr-FR' : 'ar', {timeZone:'UTC',calendar:'gregory',day:'2-digit',month:language === 'ar' ? 'long' : '2-digit',year:'numeric'}).format(date);
}
