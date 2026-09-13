import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const transport = vi.hoisted(() => ({sendMail: vi.fn()}));
vi.mock('nodemailer', () => ({default: {createTransport: vi.fn(() => transport)}}));
import nodemailer from 'nodemailer';
import { isEmailConfigured, sendEmail } from './email';
const mail = {to:'private-recipient@example.test', subject:'Private subject', html:'Private content'};
beforeEach(() => {
  vi.stubEnv('SMTP_HOST', 'smtp.example.test');vi.stubEnv('SMTP_PORT','587');vi.stubEnv('SMTP_USER','private-login');vi.stubEnv('SMTP_PASS','private-password');
  transport.sendMail.mockReset();
  vi.spyOn(console,'log').mockImplementation(() => {});vi.spyOn(console,'warn').mockImplementation(() => {});
});
afterEach(() => {vi.restoreAllMocks();vi.unstubAllEnvs();});
it('does not contact a transporter with absent or invalid SMTP configuration', async () => {
  for (const port of ['0','-1','abc','65536','25.5']) {
    vi.stubEnv('SMTP_PORT',port);expect(isEmailConfigured()).toBe(false);expect((await sendEmail(mail)).sent).toBe(false);
  }
  vi.stubEnv('SMTP_PORT','587');vi.stubEnv('SMTP_PASS','');expect(isEmailConfigured()).toBe(false);expect((await sendEmail(mail)).sent).toBe(false);
  expect(transport.sendMail).not.toHaveBeenCalled();
});
it('requires explicit SMTP acceptance with no rejected recipients', async () => {
  for(const result of [undefined, {}, {accepted:[],rejected:[]}, {accepted:[mail.to],rejected:['other@example.test']}, {accepted:[mail.to]}]) {
    transport.sendMail.mockResolvedValueOnce(result);expect((await sendEmail(mail)).sent).toBe(false);
  }
  transport.sendMail.mockResolvedValueOnce({accepted:[mail.to],rejected:[]});expect(await sendEmail(mail)).toEqual({sent:true});
  expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000}));
});
it('never exposes SMTP responses, message contents, recipients or credentials in results and logs', async () => {
  for(const code of ['EAUTH','ETIMEDOUT','UNKNOWN']) {
    transport.sendMail.mockRejectedValueOnce({code,response:'private-password private-recipient@example.test',message:'Private subject Private content'});
    const result = await sendEmail(mail);expect(result.sent).toBe(false);
    const exposed = JSON.stringify([result,vi.mocked(console.log).mock.calls,vi.mocked(console.warn).mock.calls]);
    for(const secret of ['private-password','private-recipient','Private subject','Private content','private-login']) expect(exposed).not.toContain(secret);
  }
  transport.sendMail.mockResolvedValueOnce({accepted:[mail.to],rejected:[]});await sendEmail(mail);
  expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain(mail.to);
});
