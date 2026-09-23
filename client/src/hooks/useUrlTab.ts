import { useCallback, useState } from "react";

/** Dashboard tab kept in `?tab=` so a refresh, a shared link or a login redirect
 *  reopens the same section. The default tab is left out of the URL. */
export function useUrlTab(fallback: string) {
  const [tab, setTabState] = useState(() => new URLSearchParams(window.location.search).get("tab") || fallback);
  const setTab = useCallback((next: string) => {
    setTabState(next);
    const url = new URL(window.location.href);
    if (next === fallback) url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [fallback]);
  return [tab, setTab] as const;
}
