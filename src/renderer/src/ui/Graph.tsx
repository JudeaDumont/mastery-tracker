import { useMemo } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  ReactFlow,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type Node
} from '@xyflow/react'
import { graphLayout, type PreviewNode } from '../layout'
import type { CreateDraft, Link, NodeId, Root, RootId, Skill } from '../model'
import {
  canUseFromNode,
  createSelectionFull,
  nodeRootId,
  toCandidateIds,
  useMastery
} from '../store'
import { isLocked, levelFor } from '../xp'
import { MasteryNode, type MasteryNodeData, type NodeVisual } from './MasteryNode'

const nodeTypes = { mastery: MasteryNode }
const edgeTypes = { mastery: MasteryEdge }
const PREVIEW_ID = '__new__'

export function Graph(): ReactElement {
  const roots = useMastery((state) => state.roots)
  const skills = useMastery((state) => state.skills)
  const links = useMastery((state) => state.links)
  const draft = useMastery((state) => state.draft)
  const pickedIds = useMastery((state) => state.pickedIds)
  const create = useMastery((state) => state.create)
  const togglePicked = useMastery((state) => state.togglePicked)
  const toggleCreateNode = useMastery((state) => state.toggleCreateNode)

  const preview = useMemo<PreviewNode | undefined>(() => {
    if (!create) return undefined
    if (create.step === 'from' && create.fromIds.length === 0) {
      return { id: PREVIEW_ID, root: true }
    }
    const source = create.fromIds[0]
    const rootId = source ? nodeRootId(source, roots, skills) : undefined
    return rootId ? { id: PREVIEW_ID, rootId, root: false } : undefined
  }, [create, roots, skills])

  const previewLinks = useMemo<Link[]>(() => {
    if (!create || !preview || preview.root) return []
    return [
      ...create.fromIds.map((from) => ({ id: `preview-${from}`, from, to: PREVIEW_ID })),
      ...create.toIds.map((to) => ({ id: `preview-${to}`, from: PREVIEW_ID, to }))
    ]
  }, [create, preview])

  const positions = useMemo(
    () => graphLayout({ roots, skills, links: [...links, ...previewLinks], preview }),
    [links, preview, previewLinks, roots, skills]
  )

  const toCandidates = useMemo(
    () => (create ? toCandidateIds(roots, skills, links, create) : new Set<NodeId>()),
    [create, links, roots, skills]
  )
  const toFull = create ? createSelectionFull(create) : false

  const nodes = useMemo<Node<MasteryNodeData>[]>(() => {
    const rootNodes = roots.map((root) => {
      const rootSkills = skills.filter((skill) => skill.rootId === root.id)
      const rootLevel = Math.min(
        10,
        rootSkills.reduce((sum, skill) => sum + levelFor(skill), 0)
      )
      const rootHeat =
        rootSkills.length > 0
          ? Math.round(rootSkills.reduce((sum, skill) => sum + skill.heat, 0) / rootSkills.length)
          : 0

      return masteryNode(root.id, positions[root.id], {
        title: root.title,
        level: rootLevel,
        maxLevel: 10,
        heat: rootHeat,
        locked: false,
        root: true,
        visual: visualFor(
          root.id,
          root.id,
          pickedIds,
          create,
          toCandidates,
          toFull,
          roots,
          skills,
          links
        )
      })
    })

    const skillNodes = skills.map((skill) =>
      masteryNode(skill.id, positions[skill.id], {
        title: skill.title,
        level: levelFor(skill),
        maxLevel: skill.maxLevel,
        heat: skill.heat,
        locked: isLocked(skill, skills),
        activitySelected: draft[skill.id]?.selected,
        visual: visualFor(
          skill.id,
          skill.rootId,
          pickedIds,
          create,
          toCandidates,
          toFull,
          roots,
          skills,
          links
        )
      })
    )

    const previewNode = preview
      ? [
          masteryNode(PREVIEW_ID, positions[PREVIEW_ID], {
            title: create?.title.trim() || 'New mastery',
            level: 0,
            maxLevel: preview.root ? 10 : 3,
            heat: 0,
            locked: false,
            root: preview.root,
            visual: 'preview'
          })
        ]
      : []

    return [...rootNodes, ...skillNodes, ...previewNode]
  }, [create, draft, pickedIds, positions, preview, roots, skills, toCandidates, toFull])

  const edges = useMemo<Edge[]>(() => {
    const allLinks = [...links, ...previewLinks]
    const handles = edgeHandles(allLinks, positions)
    const gateLevels = new Map(
      skills.flatMap((skill) =>
        skill.gates.map((gate) => [`${gate.nodeId}:${skill.id}`, gate.level] as const)
      )
    )
    const skillsById = new Map(skills.map((skill) => [skill.id, skill]))

    const structural = links.map((link) => {
      const gateLevel = gateLevels.get(`${link.from}:${link.to}`)
      const sourceSkill = skillsById.get(link.from)
      const gateUnmet =
        gateLevel !== undefined && (!sourceSkill || levelFor(sourceSkill) < gateLevel)
      const edgeClass = gateUnmet
        ? 'flow-edge flow-edge--locked-gate'
        : 'flow-edge flow-edge--structure'

      return edgeFor(
        link,
        edgeClass,
        handles.get(link.id),
        gateLevel,
        targetGeometry(link.to, positions, roots),
        gateUnmet,
        rootSourceGeometry(link.from, positions, roots)
      )
    })

    const temporary = previewLinks.map((link) =>
      edgeFor(
        link,
        'flow-edge flow-edge--preview',
        handles.get(link.id),
        undefined,
        targetGeometry(link.to, positions, roots),
        false,
        rootSourceGeometry(link.from, positions, roots)
      )
    )
    return [...structural, ...temporary]
  }, [links, positions, previewLinks, roots, skills])

  return (
    <ReactFlow
      key={`graph-${roots.length}-${skills.length}-${create?.step ?? 'inspect'}-${create?.fromIds.length ?? 0}-${create?.toIds.length ?? 0}`}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.35}
      maxZoom={1.8}
      onNodeClick={(_event: unknown, node: Node<MasteryNodeData>) => {
        if (node.id === PREVIEW_ID) return
        if (create) toggleCreateNode(node.id)
        else togglePicked(node.id)
      }}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={28}
        size={1.2}
        color="rgba(112, 168, 255, .13)"
      />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}

function MasteryEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data
}: EdgeProps): ReactElement {
  const edgeClass = String(data?.edgeClass ?? '')
  const sourceCenterX = Number(data?.sourceCenterX ?? sourceX)
  const sourceCenterY = Number(data?.sourceCenterY ?? sourceY)
  const sourceRadius = Number(data?.sourceRadius ?? 0)
  const sourceDeltaX = sourceX - sourceCenterX
  const sourceDeltaY = sourceY - sourceCenterY
  const sourceDistance = Math.hypot(sourceDeltaX, sourceDeltaY)
  const useSourceGeometry = sourceRadius > 0 && sourceDistance > 0
  const renderedSourceX = useSourceGeometry
    ? sourceCenterX + (sourceDeltaX / sourceDistance) * sourceRadius
    : sourceX
  const renderedSourceY = useSourceGeometry
    ? sourceCenterY + (sourceDeltaY / sourceDistance) * sourceRadius
    : sourceY
  const targetSlot = Number(data?.targetSlot ?? 4)
  const targetAngle = ((140 - targetSlot * 12.5) * Math.PI) / 180
  const targetCenterX = Number(data?.targetCenterX ?? targetX)
  const targetCenterY = Number(data?.targetCenterY ?? targetY)
  const targetRadius = Number(data?.targetRadius ?? 0)
  const gateLevel = Number(data?.gateLevel ?? 0)
  const showGateBadge = Boolean(data?.showGateBadge) && gateLevel > 0
  const renderedTargetX = targetCenterX + Math.cos(targetAngle) * targetRadius
  const renderedTargetY = targetCenterY - Math.sin(targetAngle) * targetRadius
  const [path, labelX, labelY] = getBezierPath({
    sourceX: renderedSourceX,
    sourceY: renderedSourceY,
    targetX: renderedTargetX,
    targetY: renderedTargetY,
    sourcePosition,
    targetPosition
  })

  return (
    <>
      <BaseEdge id={id} path={path} className={edgeClass} />
      {showGateBadge && (
        <EdgeLabelRenderer>
          <div
            className="edge-gate-badge"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`
            } as CSSProperties}
          >
            <span className="edge-gate-badge__lock" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M7 10V7a5 5 0 0 1 10 0v3" />
                <rect x="5" y="10" width="14" height="11" rx="2" />
              </svg>
            </span>
            <span>Lv {gateLevel}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

function masteryNode(
  id: NodeId,
  position: { x: number; y: number } | undefined,
  data: MasteryNodeData
): Node<MasteryNodeData> {
  return {
    id,
    type: 'mastery',
    position: position ?? { x: 0, y: 0 },
    data
  }
}

interface EdgeHandlePair {
  source: string
  target: string
}

interface EndpointGeometry {
  centerX: number
  centerY: number
  radius: number
}

function edgeFor(
  link: Link,
  className: string,
  handles?: EdgeHandlePair,
  gateLevel?: number,
  geometry?: EndpointGeometry,
  targetLocked = false,
  sourceGeometry?: EndpointGeometry
): Edge {
  return {
    id: link.id,
    type: 'mastery',
    source: link.from,
    target: link.to,
    sourceHandle: handles?.source,
    targetHandle: handles?.target,
    className,
    data: {
      edgeClass: className,
      sourceCenterX: sourceGeometry?.centerX,
      sourceCenterY: sourceGeometry?.centerY,
      sourceRadius: sourceGeometry?.radius,
      targetSlot: targetSlot(handles?.target),
      targetCenterX: geometry?.centerX,
      targetCenterY: geometry?.centerY,
      targetRadius: geometry?.radius,
      gateLevel,
      showGateBadge: targetLocked && Boolean(gateLevel)
    }
  }
}

function rootSourceGeometry(
  id: NodeId,
  positions: Record<NodeId, { x: number; y: number }>,
  roots: Root[]
): EndpointGeometry | undefined {
  const position = positions[id]
  const isRoot = roots.some((root) => root.id === id)
  if (!position || !isRoot) return undefined

  const size = 130
  const halfSize = size / 2
  const outerHandleOffset = size * 0.4

  return {
    centerX: position.x + halfSize,
    centerY: position.y + halfSize,
    radius: Math.hypot(outerHandleOffset, halfSize)
  }
}

function targetGeometry(
  id: NodeId,
  positions: Record<NodeId, { x: number; y: number }>,
  roots: Root[]
): EndpointGeometry | undefined {
  const position = positions[id]
  if (!position) return undefined

  const size = roots.some((root) => root.id === id) ? 130 : 112
  const radius = size / 2

  return {
    centerX: position.x + radius,
    centerY: position.y + radius,
    radius
  }
}

function targetSlot(handleId?: string): number {
  const parsed = Number(handleId?.replace('target-', '') ?? 4)
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 8 ? parsed : 4
}

function edgeHandles(
  links: Link[],
  positions: Record<NodeId, { x: number; y: number }>
): Map<string, EdgeHandlePair> {
  const result = new Map<string, EdgeHandlePair>()
  const outgoing = new Map<NodeId, Link[]>()
  const incoming = new Map<NodeId, Link[]>()

  links.forEach((link) => {
    outgoing.set(link.from, [...(outgoing.get(link.from) ?? []), link])
    incoming.set(link.to, [...(incoming.get(link.to) ?? []), link])
  })

  outgoing.forEach((group) => {
    const sorted = [...group].sort(
      (left, right) => (positions[left.to]?.x ?? 0) - (positions[right.to]?.x ?? 0)
    )
    const slots = handleSlots(sorted.length)

    sorted.forEach((link, index) => {
      const current = result.get(link.id) ?? { source: 'source-4', target: 'target-4' }
      result.set(link.id, { ...current, source: `source-${slots[index]}` })
    })
  })

  incoming.forEach((group) => {
    const sorted = [...group].sort(
      (left, right) => (positions[left.from]?.x ?? 0) - (positions[right.from]?.x ?? 0)
    )
    const slots = handleSlots(sorted.length)

    sorted.forEach((link, index) => {
      const current = result.get(link.id) ?? { source: 'source-4', target: 'target-4' }
      result.set(link.id, { ...current, target: `target-${slots[index]}` })
    })
  })

  return result
}

function handleSlots(count: number): number[] {
  if (count <= 1) return [4]

  return Array.from({ length: count }, (_, index) => Math.round((index * 8) / (count - 1)))
}

function visualFor(
  id: NodeId,
  rootId: RootId,
  pickedIds: NodeId[],
  create: CreateDraft | null,
  candidates: Set<NodeId>,
  full: boolean,
  roots: Root[],
  skills: Skill[],
  links: Link[]
): NodeVisual {
  if (id === PREVIEW_ID) return 'preview'
  if (create?.step === 'from') {
    if (create.fromIds.includes(id)) return 'from'
    const selectedRoot = create.fromIds[0]
      ? nodeRootId(create.fromIds[0], roots, skills)
      : undefined
    const sameRoot = !selectedRoot || selectedRoot === rootId
    const ok = sameRoot && canUseFromNode(id, roots, links)
    return ok ? 'candidate' : 'unavailable'
  }
  if (create?.step === 'to') {
    if (create.toIds.includes(id)) return full ? 'to-full' : 'to'
    if (create.fromIds.includes(id)) return 'from'
    return candidates.has(id) ? 'candidate' : 'unavailable'
  }
  if (pickedIds.includes(id)) return 'picked'
  return 'normal'
}
