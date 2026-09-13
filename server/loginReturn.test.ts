import { describe, expect, it } from 'vitest';
import { loginDestination, safeLoginReturn } from '../shared/loginReturn';
import { getLoginUrl } from '../client/src/const';

describe('post-login destination boundary', () => {
  it('round trips ticket and enrollment destinations without dropping selection', () => {
    for (const target of ['/support/ticket/123', '/formation/a320/apprendre?enrollment=42#chapter-2', '/support?request=privacy']) {
      const link = getLoginUrl(target);
      for (const role of ['user', 'admin']) expect(loginDestination(link.slice(link.indexOf('?')), role)).toBe(target);
    }
  });
  it('rejects external, ambiguous, malformed and endpoint destinations', () => {
    for (const target of ['https://evil.test', '//evil.test', '/\\evil.test', '/%2f%2fevil.test', '/%5cevil.test', '/%252fevil.test', '/%00x', '/\nx', '/bad%zz', '/api/trpc/auth.logout', '/x/../api/trpc', '/%61pi/trpc', '/login?returnTo=/support', '/register', '/reset-password', 'support', '/'+'x'.repeat(2048)]) {
      expect(safeLoginReturn(target), target).toBeUndefined();
      expect(loginDestination('?returnTo='+encodeURIComponent(target), 'user')).toBe('/dashboard');
    }
    expect(loginDestination('?returnTo=/support&returnTo=/admin', 'user')).toBe('/dashboard');
    expect(loginDestination('', 'admin')).toBe('/admin');
    expect(getLoginUrl()).toBe('/login');
  });
});
