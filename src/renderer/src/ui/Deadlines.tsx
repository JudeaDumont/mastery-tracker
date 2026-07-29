import { useEffect, useMemo, useRef } from 'react'
import type { ReactElement } from 'react'
import type { ActivityEntry, RootAccent } from '../model'
import { deadlineStatus, formatDeadlineLong } from '../deadline'
import { nodeRootId, nodeTitle, useMastery } from '../store'
import { DeadlineEditor } from './DeadlineEditor'
import { DeadlineIcon } from './DeadlineIcon'

interface DeadlinesProps {
  open: boolean
  onClose: () => void
}

export function Deadlines({ open, onClose }: DeadlinesProps): ReactElement | null {
  const roots = useMastery((state) => state.roots)
  const skills = useMastery((state) => state.skills)
  const xpLedger = useMastery((state) => state.xpLedger)
  const scrollerRef = useRef<HTMLDivElement>(null)

  const deadlines = useMemo<ActivityEntry[]>(
    () =>
      xpLedger
        .filter((entry): entry is ActivityEntry & { deadlineOn: string } => Boolean(entry.deadlineOn))
        .sort((left, right) => {
          const dateOrder = right.deadlineOn!.localeCompare(left.deadlineOn!)
          return dateOrder !== 0 ? dateOrder : right.occurredAt.localeCompare(left.occurredAt)
        }),
    [xpLedger]
  )

  useEffect(() => {
    if (!open) return

    const scrollToSoonest = (): void => {
      const scroller = scrollerRef.current
      if (scroller) scroller.scrollTop = scroller.scrollHeight
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToSoonest()
      window.requestAnimationFrame(scrollToSoonest)
    })
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [deadlines.length, onClose, open])

  if (!open) return null

  const overdueCount = deadlines.filter((entry) => deadlineStatus(entry.deadlineOn!) === 'overdue').length

  return (
    <section className="deadlines-overlay" aria-label="Deadlines">
      <header className="deadlines-overlay__header">
        <div className="deadlines-overlay__title">
          <span className="deadline-heading-icon" aria-hidden="true"><DeadlineIcon /></span>
          <div>
            <span className="eyebrow">Due work</span>
            <h2>Deadlines</h2>
            <p>Later deadlines are above. The soonest deadline is at the bottom.</p>
          </div>
        </div>
        <div className="deadlines-overlay__summary">
          <span><strong>{deadlines.length}</strong>scheduled</span>
          <span><strong>{overdueCount}</strong>overdue</span>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </header>

      <div className="deadlines-scroll" ref={scrollerRef}>
        <div className="deadlines-list">
          {deadlines.length === 0 ? (
            <div className="deadlines-empty">
              <span className="deadline-heading-icon" aria-hidden="true"><DeadlineIcon /></span>
              <strong>No deadlines yet.</strong>
              <span>Add one from an update in a node&apos;s notes display.</span>
            </div>
          ) : (
            deadlines.map((entry, index) => {
              const title = nodeTitle(entry.nodeId, roots, skills)
              const rootId = nodeRootId(entry.nodeId, roots, skills)
              const accent: RootAccent = roots.find((root) => root.id === rootId)?.accent ?? 'teal'
              const status = deadlineStatus(entry.deadlineOn!)
              const soonest = index === deadlines.length - 1

              return (
                <article
                  key={entry.id}
                  className={`deadline-card deadline-card--${status} deadline-card--accent-${accent} ${soonest ? 'deadline-card--soonest' : ''}`}
                >
                  <div className="deadline-card__icon" aria-hidden="true"><DeadlineIcon /></div>
                  <div className="deadline-card__content">
                    <header>
                      <div>
                        <strong>{title}</strong>
                        <span>{statusLabel(status, soonest)}</span>
                      </div>
                      <time dateTime={entry.deadlineOn}>{formatDeadlineLong(entry.deadlineOn!)}</time>
                    </header>
                    <p>{entry.note.trim() || `XP update from ${formatUpdateDay(entry.occurredAt)}`}</p>
                    <div className="deadline-card__meta">
                      <span>+{entry.xp.toLocaleString()} XP</span>
                      <span>{entry.minutes.toLocaleString()} min</span>
                      <span>Updated {formatUpdateDay(entry.occurredAt)}</span>
                    </div>
                    <DeadlineEditor entry={entry} />
                  </div>
                </article>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}

function statusLabel(status: ReturnType<typeof deadlineStatus>, soonest: boolean): string {
  if (status === 'overdue') return soonest ? 'Soonest · Overdue' : 'Overdue'
  if (status === 'today') return soonest ? 'Soonest · Due today' : 'Due today'
  return soonest ? 'Soonest deadline' : 'Scheduled'
}

function formatUpdateDay(value: string): string {
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : value
}
