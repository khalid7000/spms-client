import { useState } from 'react'

const DEFAULT_PREFS = { current: 1, pageSize: 20, sortKey: null, sortOrder: null }

function load(storageKey, defaults) {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return defaults
    return { ...defaults, ...JSON.parse(raw) }
  } catch {
    return defaults
  }
}

export function compareStrings(a, b) {
  return (a || '').localeCompare(b || '')
}

/**
 * Persists an AntD Table's current page/page-size/sort column to localStorage under
 * `storageKey`, so the preference survives navigating away and reloads — plain component state
 * does not, since the page unmounts when you leave it. Shared by every admin list table
 * (Users/Strategies/Departments) rather than each re-implementing it.
 */
export function useTablePrefs(storageKey, defaults = DEFAULT_PREFS) {
  // Pagination + sort must be tracked in state (not a literal object prop) — passing a fresh
  // object to Table's `pagination` prop on every render (e.g. opening a modal) resets the user's
  // selection back to the default. Initialized from localStorage so it also survives leaving and
  // returning to this page.
  const [prefs, setPrefs] = useState(() => load(storageKey, defaults))

  const updatePrefs = (next) => {
    setPrefs(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }

  // Each column's sortOrder must be explicitly controlled from prefs (not left to AntD's own
  // uncontrolled sort state) so the correct arrow re-appears after a remount/reload once the
  // persisted sort is restored.
  const sortOrderFor = (key) => (prefs.sortKey === key ? prefs.sortOrder : null)

  // AntD passes an array when multi-column sort is enabled; these tables only sort by one column
  // at a time, so just take the first entry. `pagination` may be `{}` (or missing fields) when
  // the table has pagination disabled — guarded with optional chaining so sort-only tables work too.
  const handleTableChange = (pagination, _filters, sorter) => {
    const sorterInfo = Array.isArray(sorter) ? sorter[0] : sorter
    updatePrefs({
      ...prefs,
      current: pagination?.current ?? prefs.current,
      pageSize: pagination?.pageSize ?? prefs.pageSize,
      sortKey: sorterInfo?.order ? sorterInfo.columnKey ?? sorterInfo.field ?? null : null,
      sortOrder: sorterInfo?.order ?? null,
    })
  }

  return { prefs, updatePrefs, sortOrderFor, handleTableChange }
}
