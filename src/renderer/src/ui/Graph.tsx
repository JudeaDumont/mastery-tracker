import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  ReactFlow,
  getBezierPath,
  useViewport,
  type Edge,
  type EdgeProps,
  type Node,
  type ReactFlowInstance
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
import { EngravingPattern, rootAccentRgb } from '../rootEngravings'
import { MasteryNode, type MasteryNodeData, type NodeVisual } from './MasteryNode'

const nodeTypes = { mastery: MasteryNode }
const edgeTypes = { mastery: MasteryEdge }
const PREVIEW_ID = '__new__'
const HISTORY_FOCUS_HORIZONTAL_MARGIN = 32
const HISTORY_FOCUS_VERTICAL_MARGIN = 32
const HISTORY_FOCUS_PREFERRED_ZOOM = 1.2
const HISTORY_FOCUS_MIN_ZOOM = 0.35
const HISTORY_FOCUS_FALLBACK_TOOLTIP_WIDTH = 390
const HISTORY_FOCUS_FALLBACK_TOOLTIP_HEIGHT = 410
const HISTORY_FOCUS_FALLBACK_GAP = 18
const NODE_MULTI_CLICK_WINDOW_MS = 600
const RETARGETED_SECOND_CLICK_MAX_DISTANCE_PX = 36
const HISTORY_FOCUS_ANIMATION_MS = 300
const CAMERA_DEBUG_PREFIX = '[camera-debug]'
const CAMERA_DEBUG_EVENT = 'mastery-camera-debug'

export interface GraphViewRequest {
  rootId?: RootId
  nodeId?: NodeId
  requestId: number
}

interface GraphProps {
  viewRequest: GraphViewRequest
}

export function Graph({ viewRequest }: GraphProps): ReactElement {
  const roots = useMastery((state) => state.roots)
  const skills = useMastery((state) => state.skills)
  const links = useMastery((state) => state.links)
  const xpLedger = useMastery((state) => state.xpLedger)
  const pickedIds = useMastery((state) => state.pickedIds)
  const create = useMastery((state) => state.create)
  const togglePicked = useMastery((state) => state.togglePicked)
  const toggleCreateNode = useMastery((state) => state.toggleCreateNode)
  const [flowInstance, setFlowInstance] = useState<
    ReactFlowInstance<Node<MasteryNodeData>, Edge> | null
  >(null)
  const [focusedHistoryNodeId, setFocusedHistoryNodeId] = useState<NodeId | null>(null)
  const [pendingFocusNodeId, setPendingFocusNodeId] = useState<NodeId | null>(null)
  const flowHostRef = useRef<HTMLDivElement>(null)
  const suppressNextClickRef = useRef(false)
  const lastNodeClickRef = useRef<{
    nodeId: NodeId
    occurredAt: number
    clientX: number
    clientY: number
  } | null>(null)
  const cameraDebug = useCallback((step: string, details?: unknown): void => {
    const time = new Date().toLocaleTimeString()
    const serialized = debugSerialize(details)
    const line = `${time} ${step}${serialized ? ` ${serialized}` : ''}`
    console.info(CAMERA_DEBUG_PREFIX, step, details ?? '')
    window.dispatchEvent(new CustomEvent<string>(CAMERA_DEBUG_EVENT, { detail: line }))
  }, [])

  const requestNodeFocus = useCallback((nodeId: NodeId): void => {
    cameraDebug('request-node-focus', {
      nodeId,
      preview: nodeId === PREVIEW_ID,
      flowReady: Boolean(flowInstance),
      hostReady: Boolean(flowHostRef.current)
    })
    if (nodeId === PREVIEW_ID) return

    const host = flowHostRef.current
    const node = flowInstance?.getNode(nodeId)
    if (flowInstance && host && node) {
      cameraDebug('request-node-focus-immediate', {
        nodeId,
        viewport: flowInstance.getViewport()
      })
      focusNodeWithHistory(flowInstance, host, node, cameraDebug)
      return
    }

    // Keep the deferred path only as a fallback for the brief period before
    // React Flow finishes initialization.
    setPendingFocusNodeId(nodeId)
  }, [cameraDebug, flowInstance])

  const focusRetargetedSecondClick = useCallback(
    (
      event: {
        clientX: number
        clientY: number
        detail: number
        preventDefault: () => void
        stopPropagation: () => void
      },
      source: string
    ): boolean => {
      const previous = lastNodeClickRef.current
      const elapsedMs = previous ? performance.now() - previous.occurredAt : Number.POSITIVE_INFINITY
      const distancePx = previous
        ? Math.hypot(event.clientX - previous.clientX, event.clientY - previous.clientY)
        : Number.POSITIVE_INFINITY
      const accepted =
        !create &&
        event.detail >= 2 &&
        previous !== null &&
        elapsedMs <= NODE_MULTI_CLICK_WINDOW_MS &&
        distancePx <= RETARGETED_SECOND_CLICK_MAX_DISTANCE_PX

      cameraDebug('retargeted-second-click-check', {
        source,
        detail: event.detail,
        previous,
        elapsedMs: Number.isFinite(elapsedMs) ? Math.round(elapsedMs) : null,
        distancePx: Number.isFinite(distancePx) ? Math.round(distancePx) : null,
        accepted
      })

      if (!accepted || !previous) return false

      event.preventDefault()
      event.stopPropagation()
      lastNodeClickRef.current = null
      cameraDebug('retargeted-second-click-focus', {
        source,
        nodeId: previous.nodeId
      })
      requestNodeFocus(previous.nodeId)
      return true
    },
    [cameraDebug, create, requestNodeFocus]
  )

  const focusRetargetedSecondPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): boolean => {
      const target = event.target instanceof Element ? event.target : null
      const targetIsPane = Boolean(target?.closest('.react-flow__pane'))
      const targetNodeId = target?.closest<HTMLElement>('.react-flow__node')?.dataset.id
      const previous = lastNodeClickRef.current
      const elapsedMs = previous ? performance.now() - previous.occurredAt : Number.POSITIVE_INFINITY
      const distancePx = previous
        ? Math.hypot(event.clientX - previous.clientX, event.clientY - previous.clientY)
        : Number.POSITIVE_INFINITY
      const accepted =
        event.button === 0 &&
        !create &&
        previous !== null &&
        (targetIsPane || targetNodeId === previous.nodeId) &&
        elapsedMs <= NODE_MULTI_CLICK_WINDOW_MS &&
        distancePx <= RETARGETED_SECOND_CLICK_MAX_DISTANCE_PX

      cameraDebug('retargeted-second-pointer-down-check', {
        targetIsPane,
        targetNodeId,
        previous,
        elapsedMs: Number.isFinite(elapsedMs) ? Math.round(elapsedMs) : null,
        distancePx: Number.isFinite(distancePx) ? Math.round(distancePx) : null,
        accepted
      })

      if (!accepted || !previous) return false

      event.preventDefault()
      event.stopPropagation()
      suppressNextClickRef.current = true
      window.setTimeout(() => {
        suppressNextClickRef.current = false
      }, NODE_MULTI_CLICK_WINDOW_MS)
      lastNodeClickRef.current = null
      cameraDebug('retargeted-second-pointer-down-focus', {
        nodeId: previous.nodeId
      })
      requestNodeFocus(previous.nodeId)
      return true
    },
    [cameraDebug, create, requestNodeFocus]
  )

  useEffect(() => {
    cameraDebug('graph-mounted', {
      roots: roots.length,
      skills: skills.length,
      createMode: Boolean(create),
      location: window.location.href
    })

    const onDocumentDoubleClick = (event: MouseEvent): void => {
      cameraDebug('document-dblclick-capture', {
        detail: event.detail,
        target: debugTarget(event.target)
      })
    }

    document.addEventListener('dblclick', onDocumentDoubleClick, true)
    return () => document.removeEventListener('dblclick', onDocumentDoubleClick, true)
  }, [cameraDebug])

  useEffect(() => {
    cameraDebug('focus-state-changed', {
      focusedHistoryNodeId,
      pendingFocusNodeId,
      flowReady: Boolean(flowInstance)
    })
  }, [cameraDebug, flowInstance, focusedHistoryNodeId, pendingFocusNodeId])

  // Creation title edits are not structural graph edits. Keep the structural
  // portions of the draft referentially stable so fast typing does not force
  // layout/candidate recomputation for the entire React Flow graph.
  const createStep = create?.step
  const createFromIds = create?.fromIds
  const createToIds = create?.toIds
  const createAccent = create?.accent
  const createEngraving = create?.engraving
  const deferredCreateTitle = useDeferredValue(create?.title ?? '')

  const structuralCreate = useMemo<CreateDraft | null>(() => {
    if (
      !createStep ||
      !createFromIds ||
      !createToIds ||
      !createAccent ||
      !createEngraving
    ) {
      return null
    }
    return {
      step: createStep,
      title: '',
      accent: createAccent,
      engraving: createEngraving,
      fromIds: createFromIds,
      toIds: createToIds
    }
  }, [createAccent, createEngraving, createFromIds, createStep, createToIds])

  const preview = useMemo<PreviewNode | undefined>(() => {
    if (!structuralCreate) return undefined
    if (structuralCreate.step === 'from' && structuralCreate.fromIds.length === 0) {
      return { id: PREVIEW_ID, root: true }
    }
    const source = structuralCreate.fromIds[0]
    const rootId = source ? nodeRootId(source, roots, skills) : undefined
    return rootId ? { id: PREVIEW_ID, rootId, root: false } : undefined
  }, [roots, skills, structuralCreate])

  const previewLinks = useMemo<Link[]>(() => {
    if (!structuralCreate || !preview || preview.root) return []
    return [
      ...structuralCreate.fromIds.map((from) => ({ id: `preview-${from}`, from, to: PREVIEW_ID })),
      ...structuralCreate.toIds.map((to) => ({ id: `preview-${to}`, from: PREVIEW_ID, to }))
    ]
  }, [preview, structuralCreate])

  const positions = useMemo(
    () => graphLayout({ roots, skills, links: [...links, ...previewLinks], preview }),
    [links, preview, previewLinks, roots, skills]
  )

  const toCandidates = useMemo(
    () =>
      structuralCreate
        ? toCandidateIds(roots, skills, links, structuralCreate)
        : new Set<NodeId>(),
    [links, roots, skills, structuralCreate]
  )
  const toFull = structuralCreate ? createSelectionFull(structuralCreate) : false

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
        rootId: root.id,
        historyPinned: focusedHistoryNodeId === root.id,
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
        deadlineEntries: xpLedger.filter(
          (entry) => entry.nodeId === root.id && Boolean(entry.deadlineOn)
        ),
        opportuneEntries: xpLedger.filter(
          (entry) => entry.nodeId === root.id && Boolean(entry.opportuneOn)
        ),
        activitySelected: pickedIds.includes(root.id),
        visual: visualFor(
          root.id,
          root.id,
          pickedIds,
          structuralCreate,
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
        rootId: skill.rootId,
        historyPinned: focusedHistoryNodeId === skill.id,
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
        deadlineEntries: xpLedger.filter(
          (entry) => entry.nodeId === skill.id && Boolean(entry.deadlineOn)
        ),
        opportuneEntries: xpLedger.filter(
          (entry) => entry.nodeId === skill.id && Boolean(entry.opportuneOn)
        ),
        activitySelected: pickedIds.includes(skill.id),
        visual: visualFor(
          skill.id,
          skill.rootId,
          pickedIds,
          structuralCreate,
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
            title: deferredCreateTitle.trim() || 'New mastery',
            rootId: preview.root ? undefined : preview.rootId,
            historyPinned: false,
            level: 0,
            maxLevel: preview.root ? 10 : 3,
            momentum: 0,
            accent: preview.root
              ? createAccent ?? 'teal'
              : rootAccentFor(preview.rootId, roots),
            locked: false,
            root: preview.root,
            updateHistory: [],
            deadlineEntries: [],
            opportuneEntries: [],
            currentLevelProgress: 0,
            visual: 'preview'
          })
        ]
      : []

    return [...rootNodes, ...skillNodes, ...previewNode]
  }, [
    createAccent,
    deferredCreateTitle,
    focusedHistoryNodeId,
    requestNodeFocus,
    links,
    pickedIds,
    positions,
    preview,
    roots,
    skills,
    structuralCreate,
    toCandidates,
    toFull,
    xpLedger
  ])

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
      id === PREVIEW_ID ? deferredCreateTitle.trim() || 'New mastery' : nodeTitle(id, roots, skills)

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
  }, [deferredCreateTitle, links, positions, previewLinks, roots, skills])

  useEffect(() => {
    if (!flowInstance) {
      cameraDebug('view-request-skipped-no-flow', viewRequest)
      return undefined
    }

    cameraDebug('view-request-start', viewRequest)
    const frame = window.requestAnimationFrame(() => {
      setFocusedHistoryNodeId(null)
      setPendingFocusNodeId(null)

      if (viewRequest.nodeId) {
        const host = flowHostRef.current
        const node = flowInstance.getNode(viewRequest.nodeId)
        cameraDebug('view-request-node-measured', {
          nodeId: viewRequest.nodeId,
          hostFound: Boolean(host),
          nodeFound: Boolean(node)
        })
        if (!host || !node) return
        focusNodeCentered(flowInstance, host, node, cameraDebug)
        return
      }

      const viewNodes = flowInstance
        .getNodes()
        .filter((node) => node.id !== PREVIEW_ID)
        .filter((node) =>
          viewRequest.rootId === undefined ? true : node.data.rootId === viewRequest.rootId
        )
      const bounds = boundsForNodes(viewNodes)
      cameraDebug('view-request-measured', {
        rootId: viewRequest.rootId,
        nodeIds: viewNodes.map((node) => node.id),
        bounds
      })

      if (!bounds) return
      void flowInstance
        .fitBounds(bounds, {
          padding: 0.16,
          duration: 500,
          minZoom: 0.35,
          maxZoom: 1.35
        })
        .then(() => cameraDebug('view-request-complete', flowInstance.getViewport()))
        .catch((error: unknown) => cameraDebug('view-request-error', debugError(error)))
    })

    return () => window.cancelAnimationFrame(frame)
  }, [
    cameraDebug,
    flowInstance,
    viewRequest.nodeId,
    viewRequest.requestId,
    viewRequest.rootId
  ])

  useEffect(() => {
    cameraDebug('focus-effect-check', {
      flowReady: Boolean(flowInstance),
      pendingFocusNodeId,
      hostReady: Boolean(flowHostRef.current)
    })
    if (!flowInstance || !pendingFocusNodeId || !flowHostRef.current) return undefined

    let measurementFrame = 0
    const renderFrame = window.requestAnimationFrame(() => {
      measurementFrame = window.requestAnimationFrame(() => {
        const host = flowHostRef.current
        const node = flowInstance.getNode(pendingFocusNodeId)
        cameraDebug('focus-effect-measure-frame', {
          pendingFocusNodeId,
          hostFound: Boolean(host),
          nodeFound: Boolean(node),
          currentViewport: flowInstance.getViewport()
        })
        if (!host || !node) return

        focusNodeWithHistory(flowInstance, host, node, cameraDebug)
        // The pinned state exists only long enough to render and measure the
        // history card. Once the camera target has been calculated, return the
        // card to normal hover-only behavior so moving off the node hides it.
        setFocusedHistoryNodeId((current) =>
          current === pendingFocusNodeId ? null : current
        )
        cameraDebug('focus-history-measurement-unpinned', {
          nodeId: pendingFocusNodeId
        })
        setPendingFocusNodeId((current) =>
          current === pendingFocusNodeId ? null : current
        )
      })
    })

    return () => {
      window.cancelAnimationFrame(renderFrame)
      window.cancelAnimationFrame(measurementFrame)
    }
  }, [cameraDebug, flowInstance, pendingFocusNodeId])

  return (
    <div
      ref={flowHostRef}
      className="graph-flow-host"
      onPointerDownCapture={(event) => {
        cameraDebug('host-pointer-down-capture', {
          button: event.button,
          detail: event.detail,
          target: debugTarget(event.target)
        })
        focusRetargetedSecondPointerDown(event)
      }}
      onClickCapture={(event) => {
        const target = event.target instanceof Element ? event.target : null
        const targetIsPane = Boolean(target?.closest('.react-flow__pane'))
        cameraDebug('host-click-capture', {
          detail: event.detail,
          target: debugTarget(event.target),
          targetIsPane
        })

        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false
          event.preventDefault()
          event.stopPropagation()
          cameraDebug('second-click-suppressed-after-pointer-down', {
            target: debugTarget(event.target)
          })
          return
        }

        if (targetIsPane) {
          focusRetargetedSecondClick(event, 'host-click-capture-pane')
        }
      }}
      onDoubleClickCapture={(event) => {
        const target = event.target
        cameraDebug('host-dblclick-capture', {
          detail: event.detail,
          target: debugTarget(target),
          createMode: Boolean(create)
        })
        if (!(target instanceof Element)) {
          cameraDebug('host-dblclick-rejected', 'target-not-element')
          return
        }
        if (target.closest('.node-update-history-tooltip')) {
          cameraDebug('host-dblclick-rejected', 'inside-history-tooltip')
          return
        }

        const nodeElement = target.closest<HTMLElement>('.react-flow__node')
        const nodeId = nodeElement?.dataset.id
        cameraDebug('host-dblclick-node-resolution', {
          nodeFound: Boolean(nodeElement),
          nodeId
        })
        if (!nodeId) {
          cameraDebug('host-dblclick-rejected', 'missing-node-id')
          return
        }
        if (nodeId === PREVIEW_ID) {
          cameraDebug('host-dblclick-rejected', 'preview-node')
          return
        }
        if (create) {
          cameraDebug('host-dblclick-rejected', 'creation-mode')
          return
        }

        event.preventDefault()
        event.stopPropagation()
        lastNodeClickRef.current = null
        requestNodeFocus(nodeId)
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnDoubleClick={false}
        minZoom={0.35}
        maxZoom={1.8}
        onInit={(instance) => {
          cameraDebug('react-flow-on-init', {
            nodeCount: instance.getNodes().length,
            viewport: instance.getViewport()
          })
          setFlowInstance(instance)
        }}
        onPaneClick={(event) => {
          cameraDebug('react-flow-pane-click', {
            detail: event.detail,
            clientX: event.clientX,
            clientY: event.clientY
          })
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false
            event.preventDefault()
            event.stopPropagation()
            cameraDebug('react-flow-pane-click-suppressed-after-pointer-down')
            return
          }
          if (focusRetargetedSecondClick(event, 'react-flow-pane-click')) return

          lastNodeClickRef.current = null
          setFocusedHistoryNodeId(null)
          setPendingFocusNodeId(null)
        }}
        onNodeClick={(event, node: Node<MasteryNodeData>) => {
          cameraDebug('react-flow-node-click', {
            nodeId: node.id,
            detail: event.detail,
            createMode: Boolean(create),
            target: debugTarget(event.target)
          })
          if (node.id === PREVIEW_ID) return

          const now = performance.now()
          const previous = lastNodeClickRef.current
          const repeatedClick =
            !create &&
            previous?.nodeId === node.id &&
            now - previous.occurredAt <= NODE_MULTI_CLICK_WINDOW_MS

          cameraDebug('react-flow-node-click-evaluated', {
            nodeId: node.id,
            previous,
            elapsedMs: previous ? Math.round(now - previous.occurredAt) : null,
            repeatedClick
          })

          if (repeatedClick) {
            cameraDebug('react-flow-multi-click-focus', { nodeId: node.id })
            event.preventDefault()
            event.stopPropagation()
            lastNodeClickRef.current = null
            requestNodeFocus(node.id)
            return
          }

          lastNodeClickRef.current = {
            nodeId: node.id,
            occurredAt: now,
            clientX: event.clientX,
            clientY: event.clientY
          }
          if (focusedHistoryNodeId && focusedHistoryNodeId !== node.id) {
            setFocusedHistoryNodeId(null)
            setPendingFocusNodeId(null)
          }
          if (create) toggleCreateNode(node.id)
          else togglePicked(node.id)
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={30}
          size={1}
          color="rgba(133, 159, 194, .065)"
        />
        <GraphEngravings
          roots={roots}
          skills={skills}
          positions={positions}
          activeRootId={viewRequest.rootId}
        />
        <Controls showInteractive={false} />
      </ReactFlow>

    </div>
  )
}

interface GraphEngravingPlacement {
  root: Root
  x: number
  y: number
  size: number
}

function GraphEngravings({
  roots,
  skills,
  positions,
  activeRootId
}: {
  roots: Root[]
  skills: Skill[]
  positions: Record<NodeId, { x: number; y: number }>
  activeRootId?: RootId
}): ReactElement {
  const viewport = useViewport()
  const placements = useMemo<GraphEngravingPlacement[]>(() => {
    const visibleRoots = activeRootId
      ? roots.filter((root) => root.id === activeRootId)
      : roots

    return visibleRoots.flatMap((root) => {
      const nodeIds = [
        root.id,
        ...skills.filter((skill) => skill.rootId === root.id).map((skill) => skill.id)
      ]
      const measured = nodeIds.flatMap((nodeId) => {
        const point = positions[nodeId]
        if (!point) return []
        const size = nodeId === root.id ? 130 : 112
        return [{ x: point.x, y: point.y, width: size, height: size }]
      })
      if (measured.length === 0) return []

      const minX = Math.min(...measured.map((node) => node.x))
      const minY = Math.min(...measured.map((node) => node.y))
      const maxX = Math.max(...measured.map((node) => node.x + node.width))
      const maxY = Math.max(...measured.map((node) => node.y + node.height))
      const treeWidth = Math.max(130, maxX - minX)
      const treeHeight = Math.max(130, maxY - minY)
      const availableSpan = Math.min(treeWidth, treeHeight)
      const size = Math.min(
        activeRootId ? 780 : 650,
        Math.max(activeRootId ? 460 : 340, availableSpan * (activeRootId ? 1.1 : .94))
      )
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2 + Math.min(55, treeHeight * .06)

      return [
        {
          root,
          x: centerX - size / 2,
          y: centerY - size / 2,
          size
        }
      ]
    })
  }, [activeRootId, positions, roots, skills])

  return (
    <div className="graph-engravings" aria-hidden="true">
      {placements.map(({ root, x, y, size }) => (
        <div
          key={root.id}
          className={`graph-engraving ${activeRootId ? 'graph-engraving--focused' : 'graph-engraving--full'}`}
          style={
            {
              left: viewport.x + x * viewport.zoom,
              top: viewport.y + y * viewport.zoom,
              width: size * viewport.zoom,
              height: size * viewport.zoom,
              '--engraving-rgb': rootAccentRgb(root.accent)
            } as CSSProperties
          }
        >
          <EngravingPattern type={root.engraving} className="graph-engraving__pattern" />
        </div>
      ))}
    </div>
  )
}

interface ViewBounds {
  x: number
  y: number
  width: number
  height: number
}

function boundsForNodes(nodes: Node<MasteryNodeData>[]): ViewBounds | undefined {
  if (nodes.length === 0) return undefined

  let minimumX = Number.POSITIVE_INFINITY
  let minimumY = Number.POSITIVE_INFINITY
  let maximumX = Number.NEGATIVE_INFINITY
  let maximumY = Number.NEGATIVE_INFINITY

  nodes.forEach((node) => {
    const size = renderedNodeSize(node)
    minimumX = Math.min(minimumX, node.position.x)
    minimumY = Math.min(minimumY, node.position.y)
    maximumX = Math.max(maximumX, node.position.x + size)
    maximumY = Math.max(maximumY, node.position.y + size)
  })

  return {
    x: minimumX,
    y: minimumY,
    width: Math.max(1, maximumX - minimumX),
    height: Math.max(1, maximumY - minimumY)
  }
}

function focusNodeCentered(
  flowInstance: ReactFlowInstance<Node<MasteryNodeData>, Edge>,
  host: HTMLDivElement,
  node: Node<MasteryNodeData>,
  cameraDebug: (step: string, details?: unknown) => void
): void {
  const hostRect = host.getBoundingClientRect()
  if (hostRect.width <= 0 || hostRect.height <= 0) {
    cameraDebug('search-focus-aborted', 'host-has-zero-size')
    return
  }

  const nodeSize = renderedNodeSize(node)
  const zoom = clampNumber(1.3, 0.35, 1.8)
  const nodeCenterX = node.position.x + nodeSize / 2
  const nodeCenterY = node.position.y + nodeSize / 2
  const nextViewport = {
    x: hostRect.width / 2 - nodeCenterX * zoom,
    y: hostRect.height / 2 - nodeCenterY * zoom,
    zoom
  }

  cameraDebug('search-focus-viewport-calculated', {
    nodeId: node.id,
    nodeCenterX,
    nodeCenterY,
    nextViewport
  })

  void flowInstance
    .setViewport(nextViewport, { duration: 320 })
    .then(() => cameraDebug('search-focus-complete', flowInstance.getViewport()))
    .catch((error: unknown) => cameraDebug('search-focus-error', debugError(error)))
}

function focusNodeWithHistory(
  flowInstance: ReactFlowInstance<Node<MasteryNodeData>, Edge>,
  host: HTMLDivElement,
  node: Node<MasteryNodeData>,
  cameraDebug: (step: string, details?: unknown) => void
): void {
  const hostRect = host.getBoundingClientRect()
  cameraDebug('focus-function-start', {
    nodeId: node.id,
    nodePosition: node.position,
    hostRect: debugRect(hostRect),
    viewport: flowInstance.getViewport()
  })
  if (hostRect.width <= 0 || hostRect.height <= 0) {
    cameraDebug('focus-function-aborted', 'host-has-zero-size')
    return
  }

  const currentZoom = Math.max(flowInstance.getViewport().zoom, 0.0001)
  const nodeElement = Array.from(
    host.querySelectorAll<HTMLElement>('.react-flow__node')
  ).find((element) => element.dataset.id === node.id)
  const tooltipElement = nodeElement?.querySelector<HTMLElement>(
    '.node-update-history-tooltip'
  )
  const nodeRect = nodeElement?.getBoundingClientRect()
  const tooltipRect = tooltipElement?.getBoundingClientRect()
  const nodeSize = renderedNodeSize(node)
  cameraDebug('focus-elements-measured', {
    nodeId: node.id,
    nodeElementFound: Boolean(nodeElement),
    tooltipElementFound: Boolean(tooltipElement),
    nodeRect: debugRect(nodeRect),
    tooltipRect: debugRect(tooltipRect),
    nodeSize
  })

  const nodeWidthInFlow =
    nodeRect && nodeRect.width > 0 ? nodeRect.width / currentZoom : nodeSize
  const nodeHeightInFlow =
    nodeRect && nodeRect.height > 0 ? nodeRect.height / currentZoom : nodeSize
  const tooltipWidthInFlow =
    tooltipRect && tooltipRect.width > 0
      ? tooltipRect.width / currentZoom
      : HISTORY_FOCUS_FALLBACK_TOOLTIP_WIDTH
  const tooltipHeightInFlow =
    tooltipRect && tooltipRect.height > 0
      ? tooltipRect.height / currentZoom
      : HISTORY_FOCUS_FALLBACK_TOOLTIP_HEIGHT

  const nodeCenterOnScreenX = nodeRect
    ? nodeRect.left + nodeRect.width / 2
    : hostRect.left + hostRect.width / 2
  const nodeCenterOnScreenY = nodeRect
    ? nodeRect.top + nodeRect.height / 2
    : hostRect.top + hostRect.height / 2

  const leftDistanceInFlow =
    tooltipRect && nodeRect
      ? Math.max(0, nodeCenterOnScreenX - Math.min(nodeRect.left, tooltipRect.left)) /
        currentZoom
      : Math.max(nodeWidthInFlow, tooltipWidthInFlow) / 2
  const rightDistanceInFlow =
    tooltipRect && nodeRect
      ? Math.max(0, Math.max(nodeRect.right, tooltipRect.right) - nodeCenterOnScreenX) /
        currentZoom
      : Math.max(nodeWidthInFlow, tooltipWidthInFlow) / 2
  const aboveDistanceInFlow =
    tooltipRect && nodeRect
      ? Math.max(0, nodeCenterOnScreenY - Math.min(nodeRect.top, tooltipRect.top)) /
        currentZoom
      : tooltipHeightInFlow + HISTORY_FOCUS_FALLBACK_GAP + nodeHeightInFlow / 2
  const belowDistanceInFlow =
    tooltipRect && nodeRect
      ? Math.max(0, Math.max(nodeRect.bottom, tooltipRect.bottom) - nodeCenterOnScreenY) /
        currentZoom
      : nodeHeightInFlow / 2

  const compositionWidthInFlow = Math.max(1, leftDistanceInFlow + rightDistanceInFlow)
  const compositionHeightInFlow = Math.max(1, aboveDistanceInFlow + belowDistanceInFlow)
  const widthZoom =
    (hostRect.width - HISTORY_FOCUS_HORIZONTAL_MARGIN * 2) / compositionWidthInFlow
  const heightZoom =
    (hostRect.height - HISTORY_FOCUS_VERTICAL_MARGIN * 2) / compositionHeightInFlow
  const zoom = clampNumber(
    Math.min(HISTORY_FOCUS_PREFERRED_ZOOM, widthZoom, heightZoom),
    HISTORY_FOCUS_MIN_ZOOM,
    1.8
  )

  // Center the complete node + notes composition. The node itself naturally sits
  // below viewport center because the notes card occupies the space above it.
  const targetNodeCenterX =
    hostRect.width / 2 + ((leftDistanceInFlow - rightDistanceInFlow) * zoom) / 2
  const targetNodeCenterY =
    hostRect.height / 2 + ((aboveDistanceInFlow - belowDistanceInFlow) * zoom) / 2
  const nodeCenterX = node.position.x + nodeSize / 2
  const nodeCenterY = node.position.y + nodeSize / 2

  const nextViewport = {
    x: targetNodeCenterX - nodeCenterX * zoom,
    y: targetNodeCenterY - nodeCenterY * zoom,
    zoom
  }
  cameraDebug('focus-viewport-calculated', {
    currentZoom,
    compositionWidthInFlow,
    compositionHeightInFlow,
    widthZoom,
    heightZoom,
    targetNodeCenterX,
    targetNodeCenterY,
    nodeCenterX,
    nodeCenterY,
    nextViewport
  })

  void flowInstance
    .setViewport(nextViewport, { duration: HISTORY_FOCUS_ANIMATION_MS })
    .then(() => cameraDebug('focus-set-viewport-complete', flowInstance.getViewport()))
    .catch((error: unknown) => cameraDebug('focus-set-viewport-error', debugError(error)))
}

function debugTarget(target: EventTarget | null): string {
  if (!(target instanceof Element)) return String(target)
  const parts: string[] = [target.tagName.toLowerCase()]
  if (target.id) parts.push(`#${target.id}`)
  if (target.classList.length > 0) {
    parts.push(`.${Array.from(target.classList).join('.')}`)
  }
  const flowNode = target.closest<HTMLElement>('.react-flow__node')
  if (flowNode?.dataset.id) parts.push(`[node=${flowNode.dataset.id}]`)
  return parts.join('')
}

function debugRect(rect: DOMRect | undefined): Record<string, number> | null {
  if (!rect) return null
  return {
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  }
}

function debugSerialize(value: unknown): string {
  if (value === undefined || value === '') return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function debugError(error: unknown): Record<string, string> {
  return error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack ?? '' }
    : { name: 'UnknownError', message: String(error), stack: '' }
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function renderedNodeSize(node: Node<MasteryNodeData>): number {
  return node.data.root ? 130 : 112
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
      <BaseEdge id={`${id}-outline`} path={path} className="edge-black-outline" />
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
    className: data.historyPinned ? 'react-flow-node--history-pinned' : undefined,
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
