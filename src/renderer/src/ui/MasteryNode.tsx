import type { CSSProperties, ReactElement } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'

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
  heat: number
  locked: boolean
  root?: boolean
  activitySelected?: boolean
  visual: NodeVisual
}

export type MasteryNodeType = Node<MasteryNodeData, 'mastery'>

const handleOffsets = [
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

function Ring({
  level,
  maxLevel,
  locked
}: Pick<MasteryNodeData, 'level' | 'maxLevel' | 'locked'>): ReactElement {
  const radius = 47
  const circumference = 2 * Math.PI * radius
  const gap = 7
  const segment = circumference / maxLevel
  const dash = Math.max(1, segment - gap)

  return (
    <svg className="level-ring" viewBox="0 0 112 112" aria-hidden="true">
      {Array.from({ length: maxLevel }, (_, index) => (
        <circle
          key={index}
          className={
            index < level && !locked ? 'ring-segment ring-segment--on' : 'ring-segment'
          }
          cx="56"
          cy="56"
          r={radius}
          pathLength={circumference}
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(${-90 + index * (360 / maxLevel)} 56 56)`}
        />
      ))}
    </svg>
  )
}

export function MasteryNode({ data }: NodeProps<MasteryNodeType>): ReactElement {
  const heatClass =
    data.heat >= 75 ? 'node--hot' : data.heat >= 40 ? 'node--warm' : 'node--cold'
  const classes = [
    'mastery-node',
    heatClass,
    data.locked ? 'node--locked' : '',
    data.root ? 'node--root' : '',
    data.activitySelected ? 'node--activity' : '',
    `node--${data.visual}`
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} style={{ '--heat': data.heat / 100 } as CSSProperties}>
      {handleOffsets.map((left, index) => (
        <Handle
          key={`target-${index}`}
          id={`target-${index}`}
          type="target"
          position={Position.Top}
          className="node-handle"
          style={{ left }}
        />
      ))}
      {handleOffsets.map((left, index) => (
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
        <span>{data.root ? `Rank ${data.level}` : `Level ${data.level}/${data.maxLevel}`}</span>
      </div>
    </div>
  )
}
