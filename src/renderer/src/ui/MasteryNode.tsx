import type { CSSProperties, ReactElement } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { RootAccent } from '../model'

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
  locked
}: Pick<MasteryNodeData, 'level' | 'maxLevel' | 'locked'>): ReactElement {
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

        return (
          <circle
            key={index}
            className={
              index < level && !locked ? 'ring-segment ring-segment--on' : 'ring-segment'
            }
            cx="56"
            cy="56"
            r={radius}
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            transform={`rotate(${rotation} 56 56)`}
          />
        )
      })}
    </svg>
  )
}

export function MasteryNode({ data }: NodeProps<MasteryNodeType>): ReactElement {
  const classes = [
    'mastery-node',
    `node--accent-${data.accent}`,
    data.locked ? 'node--locked' : '',
    data.root ? 'node--root' : '',
    data.activitySelected ? 'node--activity' : '',
    `node--${data.visual}`
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classes}
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
      <Ring level={data.level} maxLevel={data.maxLevel} locked={data.locked} />
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
      </div>
    </div>
  )
}
