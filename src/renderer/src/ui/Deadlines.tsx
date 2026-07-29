import { useEffect, useMemo, useRef } from 'react'
import type { ReactElement } from 'react'
import type { ActivityEntry, RootAccent } from '../model'
import { deadlineStatus, formatDeadlineLong } from '../deadline'
import { nodeRootId, nodeTitle, useMastery } from '../store'
import { DeadlineEditor, type ScheduleKind } from './DeadlineEditor'
import { DeadlineIcon } from './DeadlineIcon'
import { OpportunityIcon } from './OpportunityIcon'
import { ScheduleIcon } from './ScheduleIcon'

interface DeadlinesProps {
  open: boolean
  onClose: () => void
}

interface ScheduledItem {
  kind: ScheduleKind
  dateOn: string
  entry: ActivityEntry
}

export function Deadlines({ open, onClose }: DeadlinesProps): ReactElement | null {
  const roots = useMastery((state) => state.roots)
  const skills = useMastery((state) => state.skills)
  const xpLedger = useMastery((state) => state.xpLedger)
  const scrollerRef = useRef<HTMLDivElement>(null)

  const scheduledItems = useMemo<ScheduledItem[]>(
    () =>
      xpLedger
        .flatMap<ScheduledItem>((entry) => {
          const items: ScheduledItem[] = []
          if (entry.deadlineOn) {
            items.push({ kind: 'deadline', dateOn: entry.deadlineOn, entry })
          }
          if (entry.opportuneOn) {
            items.push({ kind: 'opportune', dateOn: entry.opportuneOn, entry })
          }
          return items
        })
        .sort((left, right) => {
          const dateOrder = right.dateOn.localeCompare(left.dateOn)
          if (dateOrder !== 0) return dateOrder
          const updateOrder = right.entry.occurredAt.localeCompare(left.entry.occurredAt)
          if (updateOrder !== 0) return updateOrder
          return left.kind.localeCompare(right.kind)
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
  }, [onClose, open, scheduledItems.length])

  if (!open) return null

  const deadlineCount = scheduledItems.filter((item) => item.kind === 'deadline').length
  const opportuneCount = scheduledItems.filter((item) => item.kind === 'opportune').length
  const pastCount = scheduledItems.filter(
    (item) => deadlineStatus(item.dateOn) === 'overdue'
  ).length
  const hasOpportuneToday = scheduledItems.some(
    (item) => item.kind === 'opportune' && deadlineStatus(item.dateOn) === 'today'
  )

  return (
    <section className="deadlines-overlay" aria-label="Deadlines and opportune times">
      <header className="deadlines-overlay__header">
        <div className="deadlines-overlay__title">
          <span className="schedule-heading-combo" aria-hidden="true">
            <ScheduleIcon
              deadlineActive={deadlineCount > 0}
              opportuneActive={opportuneCount > 0}
              opportuneToday={hasOpportuneToday}
            />
          </span>
          <div>
            <span className="eyebrow">Scheduled work</span>
            <h2>Deadlines &amp; Opportune Times</h2>
            <p>Later dates are above. The nearest scheduled item is at the bottom.</p>
          </div>
        </div>
        <div className="deadlines-overlay__summary">
          <span><strong>{deadlineCount}</strong>deadlines</span>
          <span className="deadlines-overlay__summary-opportune"><strong>{opportuneCount}</strong>opportune</span>
          <span><strong>{pastCount}</strong>past</span>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </header>

      <div className="deadlines-scroll" ref={scrollerRef}>
        <div className="deadlines-list">
          {scheduledItems.length === 0 ? (
            <div className="deadlines-empty">
              <span className="schedule-heading-combo" aria-hidden="true">
                <ScheduleIcon deadlineActive={false} opportuneActive={false} />
              </span>
              <strong>No scheduled dates yet.</strong>
              <span>Add a deadline or opportune time from an update in a node&apos;s notes display.</span>
            </div>
          ) : (
            scheduledItems.map((item, index) => {
              const { entry, kind, dateOn } = item
              const title = nodeTitle(entry.nodeId, roots, skills)
              const rootId = nodeRootId(entry.nodeId, roots, skills)
              const accent: RootAccent = roots.find((root) => root.id === rootId)?.accent ?? 'teal'
              const status = deadlineStatus(dateOn)
              const soonest = index === scheduledItems.length - 1
              const ItemIcon = kind === 'deadline' ? DeadlineIcon : OpportunityIcon

              return (
                <article
                  key={`${kind}:${entry.id}`}
                  className={`deadline-card deadline-card--${kind} deadline-card--${status} deadline-card--accent-${accent} ${soonest ? 'deadline-card--soonest' : ''}`}
                >
                  <div className="deadline-card__icon" aria-hidden="true"><ItemIcon /></div>
                  <div className="deadline-card__content">
                    <header>
                      <div>
                        <strong>{title}</strong>
                        <span>{statusLabel(kind, status, soonest)}</span>
                      </div>
                      <time dateTime={dateOn}>{formatDeadlineLong(dateOn)}</time>
                    </header>
                    <p>{entry.note.trim() || `XP update from ${formatUpdateDay(entry.occurredAt)}`}</p>
                    <div className="deadline-card__meta">
                      <span>+{entry.xp.toLocaleString()} XP</span>
                      <span>{entry.minutes.toLocaleString()} min</span>
                      <span>Updated {formatUpdateDay(entry.occurredAt)}</span>
                    </div>
                    <DeadlineEditor entry={entry} kind={kind} />
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

function statusLabel(
  kind: ScheduleKind,
  status: ReturnType<typeof deadlineStatus>,
  soonest: boolean
): string {
  if (kind === 'opportune') {
    if (status === 'overdue') return soonest ? 'Nearest · Opportunity passed' : 'Opportunity passed'
    if (status === 'today') return soonest ? 'Nearest · Address today' : 'Address today'
    return soonest ? 'Nearest · Opportune time' : 'Opportune time to address'
  }

  if (status === 'overdue') return soonest ? 'Nearest · Overdue' : 'Overdue'
  if (status === 'today') return soonest ? 'Nearest · Due today' : 'Due today'
  return soonest ? 'Nearest deadline' : 'Deadline'
}

function formatUpdateDay(value: string): string {
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : value
}
