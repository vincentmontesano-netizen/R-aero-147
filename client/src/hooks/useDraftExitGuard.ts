import { useEffect } from 'react';

/** Native unload protection and explicit dialog-close confirmation. */
export function useDraftExitGuard(active: boolean, message: string) {
  useEffect(() => {
    if (!active) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [active]);
  return () => !active || window.confirm(message);
}
