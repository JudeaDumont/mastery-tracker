import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { Link, NodeId, Root, RootId, Skill } from './model'
import { Graph, type GraphViewRequest } from './ui/Graph'
import { Updates } from './ui/Updates'
import { DailyUpdates } from './ui/DailyUpdates'
import { Deadlines } from './ui/Deadlines'
import { ScheduleIcon } from './ui/ScheduleIcon'
import { NodeSearch } from './ui/NodeSearch'
import { deadlineStatus } from './deadline'
import { dailyXpTotal, useMastery } from './store'
import { graphLayout } from './layout'
import { isLocked, levelFor } from './xp'
import { EngravingGlyph, rootAccentRgb } from './rootEngravings'

const CAMERA_DEBUG_EVENT = 'mastery-camera-debug'
const CAMERA_DEBUG_MAX_LINES = 100
const ROOT_TABS_VISIBLE = 3

function App(): ReactElement {
  const roots = useMastery((state) => state.roots)
  const skills = useMastery((state) => state.skills)
  const xpLedger = useMastery((state) => state.xpLedger)
  const lastResult = useMastery((state) => state.lastResult)
  const create = useMastery((state) => state.create)
  const links = useMastery((state) => state.links)
  const pickedIds = useMastery((state) => state.pickedIds)
  const beginQuickCreate = useMastery((state) => state.beginQuickCreate)
  const escapeCreate = useMastery((state) => state.escapeCreate)
  const selectPicked = useMastery((state) => state.selectPicked)
  const [graphView, setGraphView] = useState<GraphViewRequest>({
    requestId: 0
  })
  const [cameraDebugLines, setCameraDebugLines] = useState<string[]>([])
  const [dailyUpdatesOpen, setDailyUpdatesOpen] = useState(false)
  const [deadlinesOpen, setDeadlinesOpen] = useState(false)
  const [rootTabStart, setRootTabStart] = useState(0)
  const controlChordUsedRef = useRef(false)
  const controlShiftRef = useRef(false)

  useEffect(() => {
    const onCameraDebug = (event: Event): void => {
      const line = (event as CustomEvent<string>).detail
      if (!line) return
      setCameraDebugLines((current) =>
        [...current, line].slice(-CAMERA_DEBUG_MAX_LINES)
      )
    }

    window.addEventListener(CAMERA_DEBUG_EVENT, onCameraDebug)
    return () => window.removeEventListener(CAMERA_DEBUG_EVENT, onCameraDebug)
  }, [])

  useEffect(() => {
    const maximumStart = Math.max(0, roots.length - ROOT_TABS_VISIBLE)
    setRootTabStart((current) => Math.min(current, maximumStart))
  }, [roots.length])

  const closeDailyUpdates = useCallback((): void => {
    setDailyUpdatesOpen(false)
  }, [])

  const closeDeadlines = useCallback((): void => {
    setDeadlinesOpen(false)
  }, [])

  const copyCameraLogs = (): void => {
    void navigator.clipboard.writeText(cameraDebugLines.join('\n'))
  }

  const requestGraphView = (rootId?: RootId): void => {
    console.info('[camera-debug]', 'header-view-request', { rootId: rootId ?? 'full-view' })
    setGraphView((current) => ({
      rootId,
      nodeId: undefined,
      requestId: current.requestId + 1
    }))
  }

  const requestNodeView = useCallback(
    (nodeId: NodeId, rootId: RootId): void => {
      const rootIndex = roots.findIndex((root) => root.id === rootId)
      if (rootIndex >= 0) {
        setRootTabStart((current) => {
          if (rootIndex < current) return rootIndex
          if (rootIndex >= current + ROOT_TABS_VISIBLE) {
            return Math.max(0, rootIndex - ROOT_TABS_VISIBLE + 1)
          }
          return current
        })
      }

      setDailyUpdatesOpen(false)
      setDeadlinesOpen(false)
      setGraphView((current) => ({
        rootId,
        nodeId,
        requestId: current.requestId + 1
      }))
    },
    [roots]
  )

  const focusKeyboardNode = useCallback(
    (nodeId: NodeId): void => {
      selectPicked(nodeId)
      setDailyUpdatesOpen(false)
      setDeadlinesOpen(false)
      setGraphView((current) => ({
        rootId: current.rootId,
        nodeId,
        requestId: current.requestId + 1
      }))
    },
    [selectPicked]
  )

  const moveKeyboardSelection = useCallback(
    (direction: 1 | -1): void => {
      const order = keyboardTraversalOrder(roots, skills, links, graphView.rootId)
      if (order.length === 0) return

      const currentId = pickedIds.length === 1 ? pickedIds[0] : undefined
      const currentIndex = currentId ? order.indexOf(currentId) : -1
      const nextIndex =
        currentIndex < 0
          ? direction > 0
            ? 0
            : order.length - 1
          : (currentIndex + direction + order.length) % order.length

      focusKeyboardNode(order[nextIndex])
    },
    [focusKeyboardNode, graphView.rootId, links, pickedIds, roots, skills]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Control') {
        if (!event.repeat) {
          controlChordUsedRef.current = false
          controlShiftRef.current = event.shiftKey
        }
        return
      }

      if (event.key === 'Shift' && event.ctrlKey) {
        controlShiftRef.current = true
        return
      }

      if (!event.ctrlKey) return
      controlChordUsedRef.current = true
      if (event.shiftKey) controlShiftRef.current = true

      if (event.key.toLowerCase() !== 'n') return

      event.preventDefault()
      event.stopPropagation()

      if (event.shiftKey) {
        if (create) escapeCreate()
        else moveKeyboardSelection(-1)
        return
      }

      if (!create) beginQuickCreate()
    }

    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.key !== 'Control') return

      const usedChord = controlChordUsedRef.current
      const backwards = controlShiftRef.current
      controlChordUsedRef.current = false
      controlShiftRef.current = false

      if (usedChord || create || isEditableKeyboardTarget(document.activeElement)) return
      moveKeyboardSelection(backwards ? -1 : 1)
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
    }
  }, [beginQuickCreate, create, escapeCreate, moveKeyboardSelection])

  const totalXp = skills.reduce((sum, skill) => sum + skill.xp, 0)
  const todayXp = dailyXpTotal(xpLedger)
  const graphMomentum =
    skills.length > 0
      ? Math.round(skills.reduce((sum, skill) => sum + skill.momentum, 0) / skills.length)
      : 0
  const highMomentumNodes = skills.filter((skill) => skill.momentum >= 70).length
  const lockedNodes = skills.filter((skill) => isLocked(skill, skills)).length
  const deadlineCount = xpLedger.filter((entry) => Boolean(entry.deadlineOn)).length
  const opportuneCount = xpLedger.filter((entry) => Boolean(entry.opportuneOn)).length
  const scheduledCount = deadlineCount + opportuneCount
  const hasOpportuneToday = xpLedger.some(
    (entry) => entry.opportuneOn && deadlineStatus(entry.opportuneOn) === 'today'
  )
  const maximumRootTabStart = Math.max(0, roots.length - ROOT_TABS_VISIBLE)
  const visibleRoots = roots.slice(rootTabStart, rootTabStart + ROOT_TABS_VISIBLE)
  const canShowPreviousRoots = rootTabStart > 0
  const canShowNextRoots = rootTabStart < maximumRootTabStart

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <div>
            <strong>Mastery Tracker</strong>
            <small>Build momentum. See the cause.</small>
          </div>
        </div>

        <nav className="view-tabs" aria-label="Graph view">
          <button
            className="view-tabs__arrow"
            type="button"
            aria-label="Show previous root tabs"
            disabled={!canShowPreviousRoots}
            onClick={() => setRootTabStart((current) => Math.max(0, current - 1))}
          >
            <span aria-hidden="true">←</span>
          </button>

          <div className="view-tabs__window">
            {visibleRoots.map((root) => {
              const level = Math.min(
                10,
                skills
                  .filter((skill) => skill.rootId === root.id)
                  .reduce((sum, skill) => sum + levelFor(skill), 0)
              )
              return (
                <button
                  key={root.id}
                  className={`view-tab ${graphView.rootId === root.id ? 'view-tab--active' : ''}`}
                  type="button"
                  title={`${root.title} ${level}`}
                  style={{ '--tab-rgb': rootAccentRgb(root.accent) } as CSSProperties}
                  onClick={() => requestGraphView(root.id)}
                >
                  <span className="view-tab__content">
                    <span className="view-tab__engraving" aria-hidden="true">
                      <EngravingGlyph
                        type={root.engraving}
                        className="view-tab__engraving-svg"
                      />
                    </span>
                    <span className="view-tab__label">{root.title}</span>
                    <span className="view-tab__level">{level}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <button
            className="view-tabs__arrow"
            type="button"
            aria-label="Show next root tabs"
            disabled={!canShowNextRoots}
            onClick={() =>
              setRootTabStart((current) => Math.min(maximumRootTabStart, current + 1))
            }
          >
            <span aria-hidden="true">→</span>
          </button>

          <button
            className={`view-tab view-tab--full ${graphView.rootId === undefined ? 'view-tab--active' : ''}`}
            type="button"
            onClick={() => requestGraphView()}
          >
            Full view
          </button>
        </nav>

        <div className="top-actions">
          <button
            className={dailyUpdatesOpen ? 'top-action--active' : ''}
            type="button"
            aria-expanded={dailyUpdatesOpen}
            onClick={() => {
              setDailyUpdatesOpen((open) => !open)
              setDeadlinesOpen(false)
            }}
          >
            Daily Updates
          </button>
          <button
            className={`schedule-header-button ${deadlinesOpen ? 'schedule-header-button--active' : ''}`}
            type="button"
            aria-label={`Deadlines and opportune times${scheduledCount > 0 ? `, ${scheduledCount} scheduled` : ''}`}
            title="Deadlines and opportune times"
            aria-expanded={deadlinesOpen}
            onClick={() => {
              setDeadlinesOpen((open) => !open)
              setDailyUpdatesOpen(false)
            }}
          >
            <ScheduleIcon
              deadlineActive={deadlineCount > 0}
              opportuneActive={opportuneCount > 0}
              opportuneToday={hasOpportuneToday}
            />
            {scheduledCount > 0 && <span className="schedule-header-count">{scheduledCount}</span>}
          </button>
          <NodeSearch onSelect={requestNodeView} />
          <div className="logs-menu">
            <button
              className="logs-menu__trigger"
              type="button"
              aria-haspopup="true"
              aria-label="Show camera logs"
            >
              Logs
            </button>
            <div className="logs-popover" role="log" aria-live="polite">
              <div className="logs-popover__surface">
                <header>
                  <strong>Camera logs</strong>
                  <button
                    type="button"
                    onClick={copyCameraLogs}
                    disabled={cameraDebugLines.length === 0}
                  >
                    Copy
                  </button>
                </header>
                <div className="logs-popover__body">
                  {cameraDebugLines.length === 0 ? (
                    <span className="logs-popover__empty">No camera logs yet.</span>
                  ) : (
                    [...cameraDebugLines].reverse().map((line, index) => (
                      <code key={`${cameraDebugLines.length - index}-${line}`}>{line}</code>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          <button type="button">•••</button>
        </div>
      </header>

      <main className="workspace">
        <section className="graph-panel">
          <div className="graph-label">
            <span className="eyebrow">{create ? 'Creation mode' : 'Internal graph'}</span>
            <strong>
              {create?.step === 'from'
                ? 'Selecting From nodes'
                : create?.step === 'to'
                  ? 'Selecting To nodes'
                  : 'Automatic mastery lattice'}
            </strong>
          </div>
          <Graph viewRequest={graphView} />
          <DailyUpdates open={dailyUpdatesOpen} onClose={closeDailyUpdates} />
          <Deadlines open={deadlinesOpen} onClose={closeDeadlines} />
          <div className="graph-legend">
            {create ? (
              <>
                <span>
                  <i className="legend-swatch legend-swatch--from" /> From
                </span>
                <span>
                  <i className="legend-swatch legend-swatch--candidate" /> Candidate
                </span>
                <span>
                  <i className="legend-swatch legend-swatch--full" /> Capacity
                </span>
              </>
            ) : (
              <>
                <span>
                  <i className="legend-swatch legend-swatch--momentum" /> Momentum
                </span>
                <span>
                  <i className="legend-swatch legend-swatch--gate" /> Unlock gate
                </span>
              </>
            )}
          </div>
        </section>
        <Updates />
      </main>

      <footer className="xp-board">
        <Metric label="Total XP" value={totalXp.toLocaleString()} detail={`+${todayXp} today`} />
        <Metric
          label="Daily average"
          value={Math.round(totalXp / 30).toString()}
          detail="prototype window"
        />
        <Metric
          label="Graph momentum"
          value={graphMomentum.toString()}
          detail={`${highMomentumNodes} high-momentum nodes`}
        />
        <Metric
          label="Recent unlocks"
          value={(lastResult?.unlocked.length ?? 0).toString()}
          detail={lockedNodes > 0 ? `${lockedNodes} still locked` : 'All available'}
        />
      </footer>
    </div>
  )
}

function isEditableKeyboardTarget(target: Element | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.isContentEditable ||
      target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')
  )
}

function keyboardTraversalOrder(
  roots: Root[],
  skills: Skill[],
  links: Link[],
  scopedRootId?: RootId
): NodeId[] {
  const positions = graphLayout({ roots, skills, links })
  const skillById = new Map(skills.map((skill) => [skill.id, skill]))
  const rootsToVisit = scopedRootId
    ? roots.filter((root) => root.id === scopedRootId)
    : roots
  const result: NodeId[] = []
  const visited = new Set<NodeId>()

  const childrenFor = (nodeId: NodeId, rootId: RootId): NodeId[] =>
    links
      .filter((link) => link.from === nodeId)
      .map((link) => link.to)
      .filter((childId) => skillById.get(childId)?.rootId === rootId)
      .filter((childId, index, values) => values.indexOf(childId) === index)
      .sort((left, right) => {
        const leftPoint = positions[left]
        const rightPoint = positions[right]
        const xDelta = (leftPoint?.x ?? 0) - (rightPoint?.x ?? 0)
        if (Math.abs(xDelta) > 1) return xDelta
        const yDelta = (leftPoint?.y ?? 0) - (rightPoint?.y ?? 0)
        if (Math.abs(yDelta) > 1) return yDelta
        return left.localeCompare(right)
      })

  const visit = (nodeId: NodeId, rootId: RootId): void => {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    result.push(nodeId)
    childrenFor(nodeId, rootId).forEach((childId) => visit(childId, rootId))
  }

  rootsToVisit.forEach((root) => {
    visit(root.id, root.id)

    skills
      .filter((skill) => skill.rootId === root.id && !visited.has(skill.id))
      .sort((left, right) => {
        const leftPoint = positions[left.id]
        const rightPoint = positions[right.id]
        const yDelta = (leftPoint?.y ?? 0) - (rightPoint?.y ?? 0)
        if (Math.abs(yDelta) > 1) return yDelta
        const xDelta = (leftPoint?.x ?? 0) - (rightPoint?.x ?? 0)
        if (Math.abs(xDelta) > 1) return xDelta
        return left.id.localeCompare(right.id)
      })
      .forEach((skill) => visit(skill.id, root.id))
  })

  return result
}

function Metric({
  label,
  value,
  detail
}: {
  label: string
  value: string
  detail: string
}): ReactElement {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

export default App
