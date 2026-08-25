import { useEffect, useMemo, useRef } from 'react'
import type { ReactElement } from 'react'
import type { ActivityEntry, RootAccent } from '../model'
import { nodeRootId, nodeTitle, useMastery } from '../store'

interface DailyUpdatesProps {
  open: boolean
  onClose: () => void
}

interface DailyGroup {
  key: string
  date: Date
  entries: ActivityEntry[]
  totalXp: number
  today: boolean
}

export function DailyUpdates({ open, onClose }: DailyUpdatesProps): ReactElement | null {
  const roots = useMastery((state) => state.roots)
  const skills = useMastery((state) => state.skills)
  const xpLedger = useMastery((state) => state.xpLedger)
  const scrollerRef = useRef<HTMLDivElement>(null)

  const groups = useMemo<DailyGroup[]>(() => {
    const today = new Date()
    const todayKey = localDateKey(today)
    const byDay = new Map<string, ActivityEntry[]>()

    ;[...xpLedger]
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
      .forEach((entry) => {
        const date = validDate(entry.occurredAt)
        const key = localDateKey(date)
        const entries = byDay.get(key) ?? []
        entries.push(entry)
        byDay.set(key, entries)
      })

    if (!byDay.has(todayKey)) byDay.set(todayKey, [])

    return [...byDay.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entries]) => ({
        key,
        date: dateFromLocalKey(key),
        entries,
        totalXp: entries.reduce((sum, entry) => sum + Math.max(0, entry.xp), 0),
        today: key === todayKey
      }))
  }, [xpLedger])

  useEffect(() => {
    if (!open) return

    const scrollToLatest = (): void => {
      const scroller = scrollerRef.current
      if (scroller) scroller.scrollTop = scroller.scrollHeight
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToLatest()
      window.requestAnimationFrame(scrollToLatest)
    })

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [groups.length, onClose, open, xpLedger.length])

  if (!open) return null

  const recordedXp = xpLedger.reduce((sum, entry) => sum + Math.max(0, entry.xp), 0)
  const activeDays = groups.filter((group) => group.entries.length > 0).length

  return (
    <section className="daily-updates-overlay" aria-label="Daily XP updates">
      <header className="daily-updates-overlay__header">
        <div>
          <span className="eyebrow">XP ledger</span>
          <h2>Daily Updates</h2>
          <p>Created nodes and XP submissions are recorded here.</p>
        </div>
        <div className="daily-updates-overlay__summary">
          <span>
            <strong>{xpLedger.length}</strong>
            updates
          </span>
          <span>
            <strong>{recordedXp.toLocaleString()}</strong>
            recorded XP
          </span>
          <span>
            <strong>{activeDays}</strong>
            active days
          </span>
          <button type="button" onClick={onClose} aria-label="Close daily updates">
            Close
          </button>
        </div>
      </header>

      <div className="daily-updates-scroll" ref={scrollerRef}>
        <div className="daily-updates-days">
          {groups.map((group) => (
            <section
              key={group.key}
              className={`daily-update-day ${group.today ? 'daily-update-day--today' : ''}`}
            >
              <header className="daily-update-day__header">
                <div>
                  <span>{group.today ? 'Today' : formatDayHeading(group.date)}</span>
                  <small>{group.today ? formatDayHeading(group.date) : group.date.toLocaleDateString()}</small>
                </div>
                <div className="daily-update-day__totals">
                  <strong>{group.totalXp.toLocaleString()} XP</strong>
                  <span>
                    {group.entries.length} {group.entries.length === 1 ? 'update' : 'updates'}
                  </span>
                </div>
              </header>

              {group.entries.length === 0 ? (
                <div className="daily-update-day__empty">
                  <strong>No activity recorded today yet.</strong>
                  <span>Your next created node or submitted XP update will appear here.</span>
                </div>
              ) : (
                <div className="daily-update-day__entries">
                  {group.entries.map((entry) => {
                    const title = nodeTitle(entry.nodeId, roots, skills)
                    const rootId = nodeRootId(entry.nodeId, roots, skills)
                    const accent: RootAccent =
                      roots.find((root) => root.id === rootId)?.accent ?? 'teal'

                    const created = isCreatedEntry(entry)

                    return (
                      <article
                        key={entry.id}
                        className={`daily-update-entry daily-update-entry--accent-${accent} ${created ? 'daily-update-entry--created' : ''}`}
                      >
                        <span className="daily-update-entry__mark" aria-hidden="true" />
                        <div className="daily-update-entry__content">
                          <div className="daily-update-entry__topline">
                            <strong>{title}</strong>
                            <time dateTime={entry.occurredAt}>{formatTime(entry.occurredAt)}</time>
                          </div>
                          {created ? (
                            <div className="daily-update-entry__meta">
                              <strong>Created</strong>
                            </div>
                          ) : (
                            <>
                              <div className="daily-update-entry__meta">
                                <span>{entry.minutes} min</span>
                                <span>{formatEffort(entry.effort)}</span>
                                <strong>+{entry.xp.toLocaleString()} XP</strong>
                              </div>
                              {entry.note && <p>{entry.note}</p>}
                            </>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}

function isCreatedEntry(entry: ActivityEntry): boolean {
  return (
    entry.xp === 0 &&
    entry.minutes === 0 &&
    entry.note.trim().toLowerCase() === 'created'
  )
}

function validDate(value: string): Date {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : new Date(0)
}

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromLocalKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDayHeading(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatTime(value: string): string {
  return validDate(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  })
}

function formatEffort(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
