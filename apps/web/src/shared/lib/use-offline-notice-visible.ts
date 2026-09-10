"use client";

import { useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "./use-online-status";

/** Long enough to read, short enough not to linger once the connection is
 * back. Shared with `OfflineNotice`, which owns the visible copy. */
const RECOVERED_MS = 4000;

interface OfflineNoticeVisibility {
  online: boolean;
  /** Whether the persistent connectivity banner currently occupies space in
   * the shell — offline, or briefly after recovering. `Navbar` reads this
   * too, so its sticky header never overlaps the banner (docs/states.md). */
  visible: boolean;
}

/**
 * The single source of truth for whether the shell's connectivity banner is
 * on screen. `OfflineNotice` renders from it; `Navbar` reads it to offset
 * its own sticky position instead of guessing the banner's height.
 */
export function useOfflineNoticeVisible(): OfflineNoticeVisibility {
  const online = useOnlineStatus();
  const [showRecovered, setShowRecovered] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setShowRecovered(false);
      return;
    }

    if (wasOffline.current) {
      wasOffline.current = false;
      setShowRecovered(true);
      const timer = window.setTimeout(() => {
        setShowRecovered(false);
      }, RECOVERED_MS);
      return () => window.clearTimeout(timer);
    }
  }, [online]);

  return { online, visible: !online || showRecovered };
}
