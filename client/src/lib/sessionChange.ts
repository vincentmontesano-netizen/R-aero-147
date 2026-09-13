import { requestId } from './requestId';

const SESSION_CHANGE = 'raero.session.changed';
let senderId: string | undefined;

/** Notification only: never place an identity, token or password in this signal. */
export function announceSessionChange() {
  try {
    senderId ??= requestId();
    const channel = new BroadcastChannel(SESSION_CHANGE);
    channel.postMessage({ type: SESSION_CHANGE, senderId });
    channel.close();
  } catch { /* Storage events provide a fallback where channels are unavailable. */ }
  try { window.localStorage.setItem(SESSION_CHANGE, requestId()); }
  catch { /* A blocked storage area must not turn a successful login into failure. */ }
}

export function watchSessionChanges(onChange: () => void) {
  let handled = false;
  const notify = () => {
    if (handled) return;
    handled = true;
    onChange();
  };
  const storage = (event: StorageEvent) => {
    if (event.key === SESSION_CHANGE && event.newValue !== null) notify();
  };
  window.addEventListener('storage', storage);
  let channel: BroadcastChannel | undefined;
  try {
    channel = new BroadcastChannel(SESSION_CHANGE);
    channel.onmessage = event => {
      if (event.data?.type === SESSION_CHANGE && typeof event.data.senderId === 'string' && event.data.senderId !== senderId) notify();
    };
  } catch { /* The storage listener remains available. */ }
  return () => {
    handled = true;
    window.removeEventListener('storage', storage);
    channel?.close();
  };
}
