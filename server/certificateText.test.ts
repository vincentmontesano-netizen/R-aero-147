import {certificateLabels,certificateLanguage,certificateDate} from '../shared/certificateLanguage';
import {expect,it,vi} from 'vitest';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import {buildCertificatePDF} from './certificate';
const base={trainingTitle:'تدريب صيانة الطائرات Airbus A320',part147Reference:'SPECIMEN',durationHours:'12',completedAt:new Date('2026-09-13T12:00:00Z'),expiresAt:null,certificateNumber:'SPECIMEN',verificationCode:'SPECIMEN',verificationUrl:'https://example.invalid/verification/SPECIMEN',logoBuffer:null};
it.each(['Élodie Dufrêne','محمد أحمد عبد الرحمن'])('preserves %s and mixed-script training text on a single certificate page',async learnerName=>{
  const text=vi.spyOn(PDFDocument.prototype,'text');const page=vi.spyOn(PDFDocument.prototype,'addPage');
  try {
    const bytes=await buildCertificatePDF({...base,learnerName,qrDataUrl:await QRCode.toDataURL(base.verificationUrl)});
    expect(bytes.subarray(0,5).toString()).toBe('%PDF-');expect(page).toHaveBeenCalledTimes(1);
    const written=text.mock.calls.map(call=>call[0]);expect(written).toContain(learnerName);expect(written.some(value=>value.includes('Airbus A320'))).toBe(true);
    expect(written.some(value=>value.includes('تدريب صيانة الطائرات'))).toBe(true);
  } finally {text.mockRestore();page.mockRestore();}
});
it('refuses an unrenderably long identity rather than truncating it or issuing extra pages',async()=>{
  await expect(buildCertificatePDF({...base,learnerName:Array(100).fill('Identity').join('\n'),qrDataUrl:await QRCode.toDataURL(base.verificationUrl)})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
});

it.each(['fr','en','ar'] as const)('renders certificate labels in %s without translating the holder or course title',async language=>{
  const text=vi.spyOn(PDFDocument.prototype,'text');const page=vi.spyOn(PDFDocument.prototype,'addPage');
  try {
    await buildCertificatePDF({...base,language,learnerName:'Original holder',qrDataUrl:await QRCode.toDataURL(base.verificationUrl)});
    const written=text.mock.calls.map(call=>call[0]);
    for(const label of [certificateLabels[language].title,certificateLabels[language].duration,certificateLabels[language].completedOn,certificateLabels[language].indefinite,'Original holder']) expect(written).toContain(label);
    expect(page).toHaveBeenCalledTimes(1);
  } finally {text.mockRestore();page.mockRestore();}
});
it('normalizes supported language variants and formats completion dates in UTC',()=>{
  expect(certificateLanguage(' AR-sa ')).toBe('ar');expect(certificateLanguage('en_GB')).toBe('en');
  for(const value of [undefined,null,'unknown','']) expect(certificateLanguage(value)).toBe('fr');
  expect(certificateDate(new Date('2026-09-13T23:59:00Z'),'en')).toBe('13/09/2026');
});
