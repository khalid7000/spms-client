import { useState } from 'react'

/**
 * Persists a single string preference (e.g. an initiative display mode, 'cards' | 'list') to
 * localStorage under `storageKey`, mirroring useTablePrefs.js's lazy-load + write-through
 * pattern but for one plain value instead of a pagination/sort shape.
 */
export function useViewPrefs(storageKey, defaultValue) {
  const [view, setViewState] = useState(() => {
    try {
      return localStorage.getItem(storageKey) || defaultValue
    } catch {
      return defaultValue
    }
  })

  const setView = (next) => {
    setViewState(next)
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      // ignore write failures (e.g. private-browsing storage quota)
    }
  }

  return [view, setView]
}
