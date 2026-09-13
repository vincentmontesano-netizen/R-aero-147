import { afterEach, expect, it, vi } from 'vitest';
import { announceSessionChange, watchSessionChanges } from '../client/src/lib/sessionChange';

afterEach(() => { vi.unstubAllGlobals(); });
it('falls back to a storage signal without exposing identity and handles it once', () => {
  const target = new EventTarget();
  const setItem = vi.fn();
  vi.stubGlobal('window', Object.assign(target, { localStorage: { setItem } }));
  vi.stubGlobal('BroadcastChannel', undefined);
  const changed = vi.fn();
  const stop = watchSessionChanges(changed);
  announceSessionChange();
  expect(setItem).toHaveBeenCalledOnce();
  const [key, value] = setItem.mock.calls[0];
  expect(value).toMatch(/^[0-9a-f-]{36}$/i);
  const send = (eventKey: string, newValue: string | null) => {
    const event = new Event('storage');
    Object.assign(event, { key: eventKey, newValue });
    target.dispatchEvent(event);
  };
  send('unrelated', value); send(key, null);
  expect(changed).not.toHaveBeenCalled();
  send(key, value); send(key, value);
  expect(changed).toHaveBeenCalledOnce();
  stop();
  const stopped = vi.fn();
  watchSessionChanges(stopped)();
  send(key, value);
  expect(stopped).not.toHaveBeenCalled();
});
it('does not fail a completed authentication when browser signalling is blocked', () => {
  vi.stubGlobal('BroadcastChannel', undefined);
  vi.stubGlobal('window', { get localStorage() { throw new Error('Blocked'); } });
  expect(() => announceSessionChange()).not.toThrow();
});
it('ignores its own channel announcement and reacts to a different tab', () => {
  const channels: { onmessage?: (event: { data: unknown }) => void; close: () => void }[] = [];
  const messages: unknown[] = [];
  class Channel {
    onmessage?: (event: { data: unknown }) => void;
    close = vi.fn();
    constructor() { channels.push(this); }
    postMessage(data: unknown) { messages.push(data); for (const channel of channels) if (channel !== this) channel.onmessage?.({ data }); }
  }
  vi.stubGlobal('BroadcastChannel', Channel);
  vi.stubGlobal('window', Object.assign(new EventTarget(), { localStorage: { setItem: vi.fn() } }));
  const changed = vi.fn();
  const stop = watchSessionChanges(changed);
  announceSessionChange();
  expect(changed).not.toHaveBeenCalled();
  expect(Object.keys(messages[0] as object).sort()).toEqual(['senderId', 'type']);
  channels[0].onmessage?.({ data: { type: 'raero.session.changed', senderId: 'another-tab' } });
  expect(changed).toHaveBeenCalledOnce();
  stop();
  expect(channels[0].close).toHaveBeenCalledOnce();
});
