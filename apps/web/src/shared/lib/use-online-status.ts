"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

/** Assumed online during SSR — there is no `navigator` on the server, and a
 * false positive here (offline banner flashing on a server-rendered first
 * paint that is actually online) is worse than the reverse. */
function getServerSnapshot(): boolean {
  return true;
}

/** The browser's connectivity status, kept in sync via the `online`/`offline`
 * window events (`OfflineNotice`, docs/states.md). */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
