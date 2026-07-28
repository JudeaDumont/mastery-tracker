import { useRef, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { ActivityEntry, RootAccent } from '../model'
import { useMastery } from '../store'

export type NodeVisual =
  | 'normal'
  | 'picked'
  | 'from'
  | 'candidate'
  | 'to'
  | 'to-full'
  | 'unavailable'
  | 'preview'

export interface MasteryNodeData extends Record<string, unknown> {
  title: string
  level: number
  maxLevel: number
  momentum: number
  accent: RootAccent
  locked: boolean
  root?: boolean
  activitySelected?: boolean
  maxed?: boolean
  levelXpTargets?: number[]
  levelReachedAt?: Array<string | null>
  updateHistory?: ActivityEntry[]
  visual: NodeVisual
}

export type MasteryNodeType = Node<MasteryNodeData, 'mastery'>

const sourceHandleOffsets = [
  '10%',
  '20%',
  '30%',
  '40%',
  '50%',
  '60%',
  '70%',
  '80%',
  '90%'
]

const RING_CENTER = 56
const RING_OUTER_RADIUS = 49.75
const TARGET_ENDPOINT_GAP = 8.5
const TARGET_HANDLE_RADIUS = RING_OUTER_RADIUS + TARGET_ENDPOINT_GAP
const TARGET_START_DEGREES = 140
const TARGET_STEP_DEGREES = 12.5

const targetHandleOffsets = Array.from({ length: 9 }, (_, index) => {
  const angle = ((TARGET_START_DEGREES - index * TARGET_STEP_DEGREES) * Math.PI) / 180

  return {
    left: RING_CENTER + Math.cos(angle) * TARGET_HANDLE_RADIUS,
    top: RING_CENTER - Math.sin(angle) * TARGET_HANDLE_RADIUS
  }
})

function Ring({
  level,
  maxLevel,
  locked,
  root,
  levelXpTargets = [],
  levelReachedAt = []
}: Pick<
  MasteryNodeData,
  'level' | 'maxLevel' | 'locked' | 'root' | 'levelXpTargets' | 'levelReachedAt'
>): ReactElement {
  const radius = 47
  const circumference = 2 * Math.PI * radius
  const gap = 7
  const sectorDegrees = 360 / maxLevel
  const sectorLength = circumference / maxLevel
  const dashLength = Math.max(1, sectorLength - gap)
  const dashDegrees = (dashLength / circumference) * 360

  return (
    <svg className="level-ring" viewBox="0 0 112 112" aria-hidden="true">
      {Array.from({ length: maxLevel }, (_, index) => {
        const rotation = -90 - dashDegrees / 2 + index * sectorDegrees
        const reached = index < level && !locked
        const tooltip = ringSegmentTooltip(
          index,
          reached,
          root,
          levelXpTargets[index],
          levelReachedAt[index]
        )

        return (
          <g key={index} className="ring-segment-hit">
            <title>{tooltip}</title>
            <circle
              className={reached ? 'ring-segment ring-segment--on' : 'ring-segment'}
              cx="56"
              cy="56"
              r={radius}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              transform={`rotate(${rotation} 56 56)`}
            />
          </g>
        )
      })}
    </svg>
  )
}

export function MasteryNode({ data }: NodeProps<MasteryNodeType>): ReactElement {
  const historyRef = useRef<HTMLDivElement>(null)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [draftNote, setDraftNote] = useState('')
  const editUpdateNote = useMastery((state) => state.editUpdateNote)
  const updateHistory = [...(data.updateHistory ?? [])].sort(
    (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()
  )

  const scrollHistoryToLatest = (): void => {
    requestAnimationFrame(() => {
      const history = historyRef.current
      if (history) history.scrollTop = history.scrollHeight
    })
  }

  const beginNoteEdit = (entry: ActivityEntry): void => {
    setEditingEntryId(entry.id)
    setDraftNote(entry.note)
  }

  const stopNoteEdit = (): void => {
    setEditingEntryId(null)
    setDraftNote('')
  }

  const saveNoteEdit = (entry: ActivityEntry): void => {
    editUpdateNote(entry.nodeId, entry.id, draftNote)
    stopNoteEdit()
  }

  const classes = [
    'mastery-node',
    `node--accent-${data.accent}`,
    data.locked ? 'node--locked' : '',
    data.root ? 'node--root' : '',
    data.maxed && !data.root ? 'node--maxed' : '',
    data.activitySelected ? 'node--activity' : '',
    `node--${data.visual}`
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classes}
      onMouseEnter={scrollHistoryToLatest}
      style={
        { '--momentum': Math.max(0, Math.min(100, data.momentum)) / 100 } as CSSProperties
      }
    >
      {data.root && (
        <>
          <span className="root-crown-ring" aria-hidden="true" />
          <span className="root-emblem" aria-label="Root node">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" />
              <circle cx="12" cy="12" r="3.25" />
              <path d="M12 5.5v3M12 15.5v3M5.5 12h3M15.5 12h3" />
            </svg>
          </span>
        </>
      )}

      {data.maxed && !data.root && (
        <span className="max-level-crown" aria-label="Current level cap reached">
          <svg viewBox="0 0 32 22" aria-hidden="true">
            <path d="M3 6.5 9.5 12 16 3l6.5 9L29 6.5 26.5 19h-21Z" />
            <path d="M6 16.5h20" />
          </svg>
        </span>
      )}

      {targetHandleOffsets.map(({ left, top }, index) => (
        <Handle
          key={`target-${index}`}
          id={`target-${index}`}
          type="target"
          position={Position.Top}
          className="node-handle"
          style={{ left, top }}
        />
      ))}
      {sourceHandleOffsets.map((left, index) => (
        <Handle
          key={`source-${index}`}
          id={`source-${index}`}
          type="source"
          position={Position.Bottom}
          className="node-handle"
          style={{ left }}
        />
      ))}

      <Ring
        level={data.level}
        maxLevel={data.maxLevel}
        locked={data.locked}
        root={data.root}
        levelXpTargets={data.levelXpTargets}
        levelReachedAt={data.levelReachedAt}
      />

      <div className="node-core">
        {data.locked && (
          <span className="lock-mark" aria-label="Locked">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 10V7a5 5 0 0 1 10 0v3" />
              <rect x="5" y="10" width="14" height="11" rx="2" />
            </svg>
          </span>
        )}
        <strong>{data.title}</strong>
        <span className={data.root ? 'root-rank' : undefined}>
          {data.root ? `Rank ${data.level}` : `Level ${data.level}/${data.maxLevel}`}
        </span>

        <div className="node-update-history-tooltip nowheel nodrag" role="tooltip">
          <header className="node-update-history-tooltip__header">
            <b>{data.title}</b>
            <span>Update notes</span>
          </header>

          <div
            ref={historyRef}
            className="node-update-history-tooltip__list"
            onWheel={(event) => event.stopPropagation()}
          >
            {updateHistory.length === 0 ? (
              <p className="node-update-history-tooltip__empty">
                No updates recorded for this node.
              </p>
            ) : (
              updateHistory.map((entry) => (
                <article className="node-update-history-entry" key={entry.id}>
                  <header>
                    <time dateTime={entry.occurredAt}>{formatUpdateDate(entry.occurredAt)}</time>
                    <span>+{entry.xp.toLocaleString()} XP</span>
                  </header>
                  {editingEntryId === entry.id ? (
                    <textarea
                      className="node-update-history-entry__editor nowheel nodrag"
                      value={draftNote}
                      autoFocus
                      aria-label={`Edit note from ${formatUpdateDate(entry.occurredAt)}`}
                      onChange={(event) => setDraftNote(event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onMouseLeave={stopNoteEdit}
                      onBlur={stopNoteEdit}
                      onKeyDown={(event) => {
                        event.stopPropagation()
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          saveNoteEdit(entry)
                        } else if (event.key === 'Escape') {
                          event.preventDefault()
                          stopNoteEdit()
                        }
                      }}
                    />
                  ) : (
                    <p
                      className="node-update-history-entry__note"
                      role="button"
                      tabIndex={0}
                      title="Click to edit note"
                      onClick={(event) => {
                        event.stopPropagation()
                        beginNoteEdit(entry)
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          event.stopPropagation()
                          beginNoteEdit(entry)
                        }
                      }}
                    >
                      {entry.note.trim() || 'No note recorded.'}
                    </p>
                  )}
                  <small>
                    {entry.minutes.toLocaleString()} min · {formatEffort(entry.effort)}
                  </small>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ringSegmentTooltip(
  index: number,
  reached: boolean,
  root: boolean | undefined,
  cumulativeXp: number | undefined,
  reachedAt: string | null | undefined
): string {
  const levelLabel = root ? `Rank segment ${index + 1}` : `Level ${index + 1}`
  const xpLabel = Number.isFinite(cumulativeXp)
    ? ` · ${Number(cumulativeXp).toLocaleString()} cumulative XP`
    : ''

  if (!reached) return `${levelLabel}${xpLabel} · Not reached`
  if (!reachedAt) return `${levelLabel}${xpLabel} · Reached before date tracking began`

  return `${levelLabel}${xpLabel} · Reached ${formatReachedDate(reachedAt)}`
}

function formatReachedDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

function formatUpdateDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

function formatEffort(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
