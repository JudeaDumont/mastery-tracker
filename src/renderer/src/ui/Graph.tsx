import { useEffect, useMemo } from 'react'
import type { ReactElement } from 'react'

import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useNodesState,
  type Edge,
  type Node
} from '@xyflow/react'
import { useMastery } from '../store'
import { isLocked, levelFor } from '../xp'
import { MasteryNode, type MasteryNodeData } from './MasteryNode'

const nodeTypes = { mastery: MasteryNode }

const defaultPositions: Record<string, { x: number; y: number }> = {
  lifter: { x: 390, y: 30 },
  squat: { x: 90, y: 265 },
  deadlift: { x: 390, y: 335 },
  running: { x: 690, y: 265 }
}

export function Graph(): ReactElement {
  const skills = useMastery((state) => state.skills)
  const draft = useMastery((state) => state.draft)
  const toggle = useMastery((state) => state.toggle)

  const liveNodes = useMemo<Node<MasteryNodeData>[]>(() => {
    const rootLevel = Math.min(
      10,
      skills.reduce((sum, skill) => sum + levelFor(skill), 0)
    )
    const rootHeat = Math.round(skills.reduce((sum, skill) => sum + skill.heat, 0) / skills.length)

    return [
      {
        id: 'lifter',
        type: 'mastery',
        position: defaultPositions.lifter,
        data: {
          title: 'Lifter',
          level: rootLevel,
          maxLevel: 10,
          heat: rootHeat,
          locked: false,
          root: true
        }
      },
      ...skills.map((skill) => ({
        id: skill.id,
        type: 'mastery' as const,
        position: defaultPositions[skill.id],
        data: {
          title: skill.title,
          level: levelFor(skill),
          maxLevel: skill.maxLevel,
          heat: skill.heat,
          locked: isLocked(skill, skills),
          selected: draft[skill.id].selected
        }
      }))
    ]
  }, [draft, skills])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<MasteryNodeData>>(liveNodes)

  useEffect(() => {
    setNodes((current) => {
      const positions = new Map(current.map((node) => [node.id, node.position]))
      return liveNodes.map((node) => ({
        ...node,
        position: positions.get(node.id) ?? node.position
      }))
    })
  }, [liveNodes, setNodes])

  const edges = useMemo<Edge[]>(
    () => [
      {
        id: 'squat-root',
        source: 'squat',
        target: 'lifter',
        className: 'flow-edge flow-edge--heat'
      },
      {
        id: 'deadlift-root',
        source: 'deadlift',
        target: 'lifter',
        className: 'flow-edge flow-edge--heat'
      },
      {
        id: 'running-root',
        source: 'running',
        target: 'lifter',
        className: 'flow-edge flow-edge--dim'
      },
      {
        id: 'squat-running',
        source: 'squat',
        target: 'running',
        label: 'Lv 2',
        className: 'flow-edge flow-edge--gate',
        labelStyle: { fill: '#b8c8e8', fontWeight: 700 }
      },
      {
        id: 'deadlift-running',
        source: 'deadlift',
        target: 'running',
        label: 'Lv 2',
        className: 'flow-edge flow-edge--gate',
        labelStyle: { fill: '#b8c8e8', fontWeight: 700 }
      }
    ],
    []
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      fitView
      fitViewOptions={{ padding: 0.22 }}
      minZoom={0.55}
      maxZoom={1.8}
      onNodeClick={(_event: unknown, node: Node<MasteryNodeData>) => {
        if (node.id !== 'lifter') toggle(node.id as 'squat' | 'deadlift' | 'running')
      }}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={28}
        size={1.2}
        color="rgba(112, 168, 255, .16)"
      />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
