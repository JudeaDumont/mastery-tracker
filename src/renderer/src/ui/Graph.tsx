import { useMemo, useState } from 'react'
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
import type { CreateDraft, Link, NodeId, Root, RootAccent, RootId, Skill } from '../model'
import {
  canUseFromNode,
  createSelectionFull,
  nodeRootId,
  nodeTitle,
  toCandidateIds,
  useMastery
} from '../store'
import {
  currentLevelProgressFor,
  isLocked,
  levelFor,
  levelProgressFor
} from '../xp'
import { MasteryNode, type MasteryNodeData, type NodeVisual } from './MasteryNode'

const nodeTypes = { mastery: MasteryNode }
const edgeTypes = { mastery: MasteryEdge }
const PREVIEW_ID = '__new__'

export function Graph(): ReactElement {
  const roots = useMastery((state) => state.roots)
  const skills = useMastery((state) => state.skills)
  const links = useMastery((state) => state.links)
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
      const rootMomentum =
        rootSkills.length > 0
          ? Math.round(rootSkills.reduce((sum, skill) => sum + skill.momentum, 0) / rootSkills.length)
          : 0

      return masteryNode(root.id, positions[root.id], {
        title: root.title,
        level: rootLevel,
        maxLevel: 10,
        momentum: rootMomentum,
        accent: root.accent ?? 'teal',
        locked: false,
        root: true,
        maxed: false,
        levelXpTargets: [],
        levelReachedAt: [],
        currentLevelProgress: 0,
        updateHistory: root.updateHistory,
        activitySelected: pickedIds.includes(root.id),
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

    const skillNodes = skills.map((skill) => {
      const progress = levelProgressFor(skill)
      const locked = isLocked(skill, skills)
      return masteryNode(skill.id, positions[skill.id], {
        title: skill.title,
        level: progress.level,
        maxLevel: skill.maxLevel,
        momentum: skill.momentum,
        accent: rootAccentFor(skill.rootId, roots),
        locked,
        maxed: progress.maxed,
        levelXpTargets: cumulativeXpTargets(skill.levelXpRequirements, skill.maxLevel),
        levelReachedAt: skill.levelReachedAt ?? [],
        currentLevelProgress: currentLevelProgressFor(skill),
        updateHistory: skill.updateHistory,
        activitySelected: pickedIds.includes(skill.id),
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
    })

    const previewNode = preview
      ? [
          masteryNode(PREVIEW_ID, positions[PREVIEW_ID], {
            title: create?.title.trim() || 'New mastery',
            level: 0,
            maxLevel: preview.root ? 10 : 3,
            momentum: 0,
            accent: preview.root
              ? create?.accent ?? 'teal'
              : rootAccentFor(preview.rootId, roots),
            locked: false,
            root: preview.root,
            updateHistory: [],
            currentLevelProgress: 0,
            visual: 'preview'
          })
        ]
      : []

    return [...rootNodes, ...skillNodes, ...previewNode]
  }, [create, links, pickedIds, positions, preview, roots, skills, toCandidates, toFull])

  const edges = useMemo<Edge[]>(() => {
    const allLinks = [...links, ...previewLinks]
    const handles = edgeHandles(allLinks, positions)
    const fanRoutes = fanInRoutes(allLinks, positions, roots)
    const gateLevels = new Map(
      skills.flatMap((skill) =>
        skill.gates.map((gate) => [`${gate.nodeId}:${skill.id}`, gate.level] as const)
      )
    )
    const skillsById = new Map(skills.map((skill) => [skill.id, skill]))
    const titleFor = (id: NodeId): string =>
      id === PREVIEW_ID ? create?.title.trim() || 'New mastery' : nodeTitle(id, roots, skills)

    const buildEdge = (
      link: Link,
      className: string,
      gateLevel?: number,
      gateUnmet = false
    ): Edge =>
      edgeFor(
        link,
        className,
        handles.get(link.id),
        gateLevel,
        endpointGeometry(link.to, positions, roots, 'target'),
        gateUnmet,
        endpointGeometry(link.from, positions, roots, 'source'),
        fanRoutes.get(link.id),
        titleFor(link.from),
        titleFor(link.to)
      )

    const structural = links.map((link) => {
      const gateLevel = gateLevels.get(`${link.from}:${link.to}`)
      const sourceSkill = skillsById.get(link.from)
      const gateUnmet =
        gateLevel !== undefined && (!sourceSkill || levelFor(sourceSkill) < gateLevel)
      const edgeClass = gateUnmet
        ? 'flow-edge flow-edge--locked-gate'
        : 'flow-edge flow-edge--structure'

      return buildEdge(link, edgeClass, gateLevel, gateUnmet)
    })

    const temporary = previewLinks.map((link) =>
      buildEdge(link, 'flow-edge flow-edge--preview')
    )
    return [...structural, ...temporary]
  }, [create, links, positions, previewLinks, roots, skills])

  const graphStructureKey = useMemo(
    () =>
      [
        ...roots.map((root) => `r:${root.id}`),
        ...skills.map((skill) => `n:${skill.id}:${skill.rootId}`),
        ...links.map((link) => `e:${link.from}>${link.to}`)
      ]
        .sort()
        .join('|'),
    [links, roots, skills]
  )

  return (
    <ReactFlow
      key={`graph-${graphStructureKey}-${create?.step ?? 'inspect'}-${create?.fromIds.join(',') ?? ''}-${create?.toIds.join(',') ?? ''}`}
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
  const [hovered, setHovered] = useState(false)
  const edgeClass = String(data?.edgeClass ?? '')
  const sourceTitle = String(data?.sourceTitle ?? 'Unknown node')
  const targetTitle = String(data?.targetTitle ?? 'Unknown node')
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
  const fanSourceRailY = Number(data?.fanSourceRailY)
  const fanTargetRailY = Number(data?.fanTargetRailY)
  const fanCurveDirection = Number(data?.fanCurveDirection ?? 0)
  const useFanRoute = Number.isFinite(fanSourceRailY) && Number.isFinite(fanTargetRailY)
  const defaultPath = getBezierPath({
    sourceX: renderedSourceX,
    sourceY: renderedSourceY,
    targetX: renderedTargetX,
    targetY: renderedTargetY,
    sourcePosition,
    targetPosition
  })
  const fanCurve = useFanRoute
    ? smoothFanInCurve(
        renderedSourceX,
        renderedSourceY,
        renderedTargetX,
        renderedTargetY,
        fanSourceRailY,
        fanTargetRailY,
        fanCurveDirection
      )
    : undefined
  const path = fanCurve?.path ?? defaultPath[0]
  const gateLabelPoint = fanCurve ? cubicPoint(fanCurve, 0.48) : undefined
  const labelX = gateLabelPoint?.x ?? defaultPath[1]
  const labelY = gateLabelPoint?.y ?? defaultPath[2]
  const hoverPoint = fanCurve ? cubicPoint(fanCurve, 0.64) : { x: defaultPath[1], y: defaultPath[2] }

  return (
    <>
      <BaseEdge id={id} path={path} className={edgeClass} />
      <path
        d={path}
        className="edge-hover-target"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

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

      {hovered && (
        <EdgeLabelRenderer>
          <div
            className="edge-hover-tooltip"
            style={{
              transform: `translate(-50%, -115%) translate(${hoverPoint.x}px, ${hoverPoint.y}px)`
            } as CSSProperties}
          >
            <strong>
              {sourceTitle} → {targetTitle}
            </strong>
            <span>Level requirement: {gateLevel}</span>
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

interface FanRoute {
  sourceRailY: number
  targetRailY: number
  curveDirection: number
}

function edgeFor(
  link: Link,
  className: string,
  handles?: EdgeHandlePair,
  gateLevel?: number,
  geometry?: EndpointGeometry,
  targetLocked = false,
  sourceGeometry?: EndpointGeometry,
  fanRoute?: FanRoute,
  sourceTitle = link.from,
  targetTitle = link.to
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
      fanSourceRailY: fanRoute?.sourceRailY,
      fanTargetRailY: fanRoute?.targetRailY,
      fanCurveDirection: fanRoute?.curveDirection,
      sourceTitle,
      targetTitle,
      gateLevel: gateLevel ?? 0,
      showGateBadge: targetLocked && Boolean(gateLevel)
    }
  }
}

interface CubicCurve {
  path: string
  sourceX: number
  sourceY: number
  control1X: number
  control1Y: number
  control2X: number
  control2Y: number
  targetX: number
  targetY: number
}

function smoothFanInCurve(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourceRailY: number,
  targetRailY: number,
  curveDirection: number
): CubicCurve {
  const control1Y = Math.max(sourceY + 24, sourceRailY)
  const control2Y = Math.min(targetY - 24, targetRailY)
  const control1X = sourceX + curveDirection * 14
  const control2X = targetX + curveDirection * 34

  return {
    path: `M ${sourceX} ${sourceY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${targetX} ${targetY}`,
    sourceX,
    sourceY,
    control1X,
    control1Y,
    control2X,
    control2Y,
    targetX,
    targetY
  }
}

function cubicPoint(curve: CubicCurve, progress: number): { x: number; y: number } {
  const remaining = 1 - progress
  const sourceWeight = remaining * remaining * remaining
  const control1Weight = 3 * remaining * remaining * progress
  const control2Weight = 3 * remaining * progress * progress
  const targetWeight = progress * progress * progress

  return {
    x:
      sourceWeight * curve.sourceX +
      control1Weight * curve.control1X +
      control2Weight * curve.control2X +
      targetWeight * curve.targetX,
    y:
      sourceWeight * curve.sourceY +
      control1Weight * curve.control1Y +
      control2Weight * curve.control2Y +
      targetWeight * curve.targetY
  }
}

// Each convergence target gets its own vertical transition band and mirrored curve bias.
function fanInRoutes(
  links: Link[],
  positions: Record<NodeId, { x: number; y: number }>,
  roots: Root[]
): Map<string, FanRoute> {
  const result = new Map<string, FanRoute>()
  const incoming = new Map<NodeId, Link[]>()

  links.forEach((link) => {
    incoming.set(link.to, [...(incoming.get(link.to) ?? []), link])
  })

  const convergenceTargets = Array.from(incoming.entries())
    .filter(([, group]) => group.length > 1)
    .sort(([leftId], [rightId]) =>
      (positions[leftId]?.x ?? 0) - (positions[rightId]?.x ?? 0)
    )

  convergenceTargets.forEach(([targetId, group], targetIndex) => {
    const targetPosition = positions[targetId]
    if (!targetPosition) return

    const targetTop = targetPosition.y
    const sourceBottoms = group
      .map((link) => {
        const sourcePosition = positions[link.from]
        return sourcePosition ? sourcePosition.y + nodeSize(link.from, roots) : undefined
      })
      .filter((value): value is number => value !== undefined)

    if (sourceBottoms.length !== group.length) return

    const lowestSourceBottom = Math.max(...sourceBottoms)
    const availableGap = targetTop - lowestSourceBottom
    const targetCount = convergenceTargets.length
    const bandProgress =
      targetCount <= 1 ? 0.5 : 0.34 + (0.32 * targetIndex) / (targetCount - 1)
    const bandCenter = lowestSourceBottom + availableGap * bandProgress
    const railSeparation = Math.max(34, Math.min(64, availableGap * 0.16))
    const sourceRailY = bandCenter - railSeparation / 2
    const targetRailY = bandCenter + railSeparation / 2
    const curveDirection =
      targetCount <= 1 ? 0 : targetIndex < (targetCount - 1) / 2 ? -1 : 1

    group.forEach((link) => {
      result.set(link.id, { sourceRailY, targetRailY, curveDirection })
    })
  })

  return result
}

function nodeSize(id: NodeId, roots: Root[]): number {
  return roots.some((root) => root.id === id) ? 130 : 112
}

function endpointGeometry(
  id: NodeId,
  positions: Record<NodeId, { x: number; y: number }>,
  roots: Root[],
  endpoint: 'source' | 'target'
): EndpointGeometry | undefined {
  const position = positions[id]
  if (!position) return undefined

  const isRoot = roots.some((root) => root.id === id)
  const size = isRoot ? 130 : 112
  const halfSize = size / 2
  const radius = endpoint === 'source' && isRoot ? Math.hypot(size * 0.4, halfSize) : halfSize

  return {
    centerX: position.x + halfSize,
    centerY: position.y + halfSize,
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

function cumulativeXpTargets(requirements: number[], maxLevel: number): number[] {
  let total = 0

  return Array.from({ length: maxLevel }, (_, index) => {
    const configured = requirements[index]
    total += Number.isFinite(configured) && configured > 0 ? configured : 1
    return total
  })
}

function rootAccentFor(rootId: RootId | undefined, roots: Root[]): RootAccent {
  return roots.find((root) => root.id === rootId)?.accent ?? 'teal'
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
    if (full) return 'unavailable'
    const selectedRoot = create.fromIds[0]
      ? nodeRootId(create.fromIds[0], roots, skills)
      : undefined
    const sameRoot = !selectedRoot || selectedRoot === rootId
    const ok = sameRoot && canUseFromNode(id, links)
    return ok ? 'candidate' : 'unavailable'
  }
  if (create?.step === 'to') {
    if (create.toIds.includes(id)) return full ? 'to-full' : 'to'
    if (create.fromIds.includes(id)) return 'from'
    if (full) return 'unavailable'
    return candidates.has(id) ? 'candidate' : 'unavailable'
  }
  if (pickedIds.includes(id)) return 'picked'
  return 'normal'
}
