"use client";

import { useEffect } from "react";

/**
 * Locks the page to the viewport while a story detail is open so that the only
 * scrollable region is the prose column. Removes the lock on unmount (e.g. when
 * navigating back to the feed).
 */
export function ScrollLock() {
  useEffect(() => {
    document.body.classList.add("story-locked");
    return () => document.body.classList.remove("story-locked");
  }, []);
  return null;
}
