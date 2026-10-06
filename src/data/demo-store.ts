/**
 * Per-visitor demo persistence. Each collection is a live array seeded from the
 * fixtures and saved to localStorage on every write, so changes survive reloads
 * and every page reads the same data. resetDemo() restores the seed.
 */
const PREFIX = 'unison.demo.v1.'

export function loadCollection<T>(name: string, seed: T[]): T[] {
  try {
    const raw = localStorage.getItem(PREFIX + name)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as T[]
    }
  } catch {
    // Corrupt or unavailable storage: fall back to the seed.
  }
  return structuredClone(seed)
}

export function persist<T>(name: string, items: T[]): void {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify(items))
  } catch {
    // Storage full or blocked: keep the in-memory change only.
  }
}

/** Insert or replace by id, then save. */
export function upsert<T extends { id: string }>(name: string, items: T[], item: T, position: 'start' | 'end' = 'end'): void {
  const i = items.findIndex((x) => x.id === item.id)
  if (i >= 0) items[i] = item
  else if (position === 'start') items.unshift(item)
  else items.push(item)
  persist(name, items)
}

/** Replace the whole collection in place, then save. */
export function replaceAll<T>(name: string, items: T[], next: T[]): void {
  items.splice(0, items.length, ...next)
  persist(name, items)
}

export function hasDemoChanges(): boolean {
  return Object.keys(localStorage).some((k) => k.startsWith(PREFIX))
}

export function resetDemo(): void {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k))
  window.location.reload()
}
