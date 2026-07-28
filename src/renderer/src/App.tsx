import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { RootId } from './model'
import { Graph, type GraphViewRequest } from './ui/Graph'
import { Updates } from './ui/Updates'
import { useMastery } from './store'
import { isLocked, levelFor } from './xp'

const CAMERA_DEBUG_EVENT = 'mastery-camera-debug'
const CAMERA_DEBUG_MAX_LINES = 100

function App(): ReactElement {
  const roots = useMastery((state) => state.roots)
  const skills = useMastery((state) => state.skills)
  const todayXp = useMastery((state) => state.todayXp)
  const lastResult = useMastery((state) => state.lastResult)
  const create = useMastery((state) => state.create)
  const [graphView, setGraphView] = useState<GraphViewRequest>({
    requestId: 0
  })
  const [cameraDebugLines, setCameraDebugLines] = useState<string[]>([])

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

  const copyCameraLogs = (): void => {
    void navigator.clipboard.writeText(cameraDebugLines.join('\n'))
  }

  const requestGraphView = (rootId?: RootId): void => {
    console.info('[camera-debug]', 'header-view-request', { rootId: rootId ?? 'full-view' })
    setGraphView((current) => ({
      rootId,
      requestId: current.requestId + 1
    }))
  }

  const totalXp = skills.reduce((sum, skill) => sum + skill.xp, 0)
  const graphMomentum =
    skills.length > 0
      ? Math.round(skills.reduce((sum, skill) => sum + skill.momentum, 0) / skills.length)
      : 0
  const highMomentumNodes = skills.filter((skill) => skill.momentum >= 70).length
  const lockedNodes = skills.filter((skill) => isLocked(skill, skills)).length

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
          {roots.slice(0, 3).map((root) => {
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
                onClick={() => requestGraphView(root.id)}
              >
                {root.title} {level}
              </button>
            )
          })}
          <button
            className={`view-tab ${graphView.rootId === undefined ? 'view-tab--active' : ''}`}
            type="button"
            onClick={() => requestGraphView()}
          >
            Full view
          </button>
        </nav>

        <div className="top-actions">
          <button type="button">Search</button>
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
