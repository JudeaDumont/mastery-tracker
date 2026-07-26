import { useMemo } from 'react'
import type { ReactElement } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Edge,
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
    () => create ? toCandidateIds(roots, skills, links, create) : new Set<NodeId>(),
    [create, links, roots, skills]
  )
  const toFull = create ? createSelectionFull(create) : false

  const nodes = useMemo<Node<MasteryNodeData>[]>(() => {
    const rootNodes = roots.map((root) => {
      const rootSkills = skills.filter((skill) => skill.rootId === root.id)
      const rootLevel = Math.min(10, rootSkills.reduce((sum, skill) => sum + levelFor(skill), 0))
      const rootHeat = rootSkills.length > 0
        ? Math.round(rootSkills.reduce((sum, skill) => sum + skill.heat, 0) / rootSkills.length)
        : 0

      return masteryNode(root.id, positions[root.id], {
        title: root.title,
        level: rootLevel,
        maxLevel: 10,
        heat: rootHeat,
        locked: false,
        root: true,
        visual: visualFor(root.id, root.id, pickedIds, create, toCandidates, toFull, roots, skills, links)
      })
    })

    const skillNodes = skills.map((skill) => masteryNode(skill.id, positions[skill.id], {
      title: skill.title,
      level: levelFor(skill),
      maxLevel: skill.maxLevel,
      heat: skill.heat,
      locked: isLocked(skill, skills),
      activitySelected: draft[skill.id]?.selected,
      visual: visualFor(skill.id, skill.rootId, pickedIds, create, toCandidates, toFull, roots, skills, links)
    }))

    const previewNode = preview
      ? [masteryNode(PREVIEW_ID, positions[PREVIEW_ID], {
          title: create?.title.trim() || 'New mastery',
          level: 0,
          maxLevel: preview.root ? 10 : 3,
          heat: 0,
          locked: false,
          root: preview.root,
          visual: 'preview'
        })]
      : []

    return [...rootNodes, ...skillNodes, ...previewNode]
  }, [create, draft, pickedIds, positions, preview, roots, skills, toCandidates, toFull])

  const edges = useMemo<Edge[]>(() => {
    const structural = links.map((link) => edgeFor(link, 'flow-edge flow-edge--structure'))
    const gates = skills.flatMap((skill) => skill.gates.map((gate) => ({
      id: `gate-${gate.nodeId}-${skill.id}`,
      source: gate.nodeId,
      target: skill.id,
      label: `Lv ${gate.level}`,
      className: 'flow-edge flow-edge--gate',
      labelStyle: { fill: '#b8c8e8', fontWeight: 700 }
    })))
    const temporary = previewLinks.map((link) => edgeFor(link, 'flow-edge flow-edge--preview'))
    return [...structural, ...gates, ...temporary]
  }, [links, previewLinks, skills])

  return (
    <ReactFlow
      key={`graph-${roots.length}-${skills.length}-${create?.step ?? 'inspect'}-${create?.fromIds.length ?? 0}-${create?.toIds.length ?? 0}`}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
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

function edgeFor(link: Link, className: string): Edge {
  return {
    id: link.id,
    source: link.from,
    target: link.to,
    className
  }
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
  if (!create) return pickedIds.includes(id) ? 'picked' : 'normal'

  if (create.step === 'from') {
    if (create.fromIds.includes(id)) return 'from'
    const selectedRoot = create.fromIds[0]
      ? nodeRootId(create.fromIds[0], roots, skills)
      : undefined
    const sameRoot = !selectedRoot || selectedRoot === rootId
    return sameRoot && canUseFromNode(id, roots, links) ? 'normal' : 'unavailable'
  }

  if (create.fromIds.includes(id)) return 'from'
  if (create.toIds.includes(id)) return full ? 'to-full' : 'to'
  if (candidates.has(id) && !full) return 'candidate'
  return 'unavailable'
}
