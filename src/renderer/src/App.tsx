import { Graph } from './ui/Graph'
import { Updates } from './ui/Updates'
import { useMastery } from './store'
import { isLocked, levelFor } from './xp'

function App(): React.JSX.Element {
  const skills = useMastery((state) => state.skills)
  const todayXp = useMastery((state) => state.todayXp)
  const lastResult = useMastery((state) => state.lastResult)

  const totalXp = skills.reduce((sum, skill) => sum + skill.xp, 0)
  const graphHeat = Math.round(skills.reduce((sum, skill) => sum + skill.heat, 0) / skills.length)
  const hotNodes = skills.filter((skill) => skill.heat >= 70).length
  const lockedNodes = skills.filter((skill) => isLocked(skill, skills)).length
  const lifterLevel = skills.reduce((sum, skill) => sum + levelFor(skill), 0)

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
          <button className="view-tab view-tab--active" type="button">Lifter {lifterLevel}</button>
          <button className="view-tab" type="button">Software</button>
          <button className="view-tab" type="button">Full view</button>
        </nav>

        <div className="top-actions">
          <button type="button">Search</button>
          <button type="button">•••</button>
        </div>
      </header>

      <main className="workspace">
        <section className="graph-panel">
          <div className="graph-label">
            <span className="eyebrow">Internal graph</span>
            <strong>Lifter progression</strong>
          </div>
          <Graph />
          <div className="graph-legend">
            <span><i className="legend-swatch legend-swatch--heat" /> Momentum</span>
            <span><i className="legend-swatch legend-swatch--gate" /> Unlock gate</span>
          </div>
        </section>
        <Updates />
      </main>

      <footer className="xp-board">
        <Metric label="Total XP" value={totalXp.toLocaleString()} detail={`+${todayXp} today`} />
        <Metric label="Daily average" value={Math.round(totalXp / 30).toString()} detail="prototype window" />
        <Metric label="Graph heat" value={graphHeat.toString()} detail={`${hotNodes} hot nodes`} />
        <Metric
          label="Recent unlocks"
          value={(lastResult?.unlocked.length ?? 0).toString()}
          detail={lockedNodes > 0 ? `${lockedNodes} still locked` : 'All available'}
        />
      </footer>
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

export default App
