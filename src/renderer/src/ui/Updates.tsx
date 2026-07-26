import { useMemo } from 'react'
import type { Effort } from '../model'
import { projectedXp, useMastery } from '../store'
import { isLocked, levelFor } from '../xp'

const effortLabels: Record<Effort, string> = {
  recovery: 'Recovery ×0.50',
  light: 'Light ×0.75',
  moderate: 'Moderate ×1.00',
  hard: 'Hard ×1.50',
  maximum: 'Maximum ×2.00'
}

export function Updates() {
  const skills = useMastery((state) => state.skills)
  const draft = useMastery((state) => state.draft)
  const toggle = useMastery((state) => state.toggle)
  const edit = useMastery((state) => state.edit)
  const submit = useMastery((state) => state.submit)
  const lastResult = useMastery((state) => state.lastResult)

  const ordered = useMemo(() => [...skills].sort((a, b) => b.heat - a.heat), [skills])
  const selected = ordered.filter((skill) => draft[skill.id].selected)
  const totalProjectedXp = selected.reduce((sum, skill) => sum + projectedXp(draft[skill.id]), 0)
  const totalMinutes = selected.reduce((sum, skill) => sum + draft[skill.id].minutes, 0)

  return (
    <aside className="updates-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Daily command center</span>
          <h2>Updates</h2>
        </div>
        <button className="icon-button" type="button" title="Node builder comes next">
          +
        </button>
      </div>

      <div className="node-list">
        {ordered.map((skill) => {
          const update = draft[skill.id]
          const locked = isLocked(skill, skills)

          return (
            <section
              key={skill.id}
              className={`update-row ${update.selected ? 'update-row--selected' : ''} ${locked ? 'update-row--locked' : ''}`}
            >
              <button
                className="update-row__header"
                type="button"
                disabled={locked}
                onClick={() => toggle(skill.id)}
              >
                <span className="heat-dot" style={{ '--row-heat': skill.heat / 100 } as React.CSSProperties} />
                <span className="update-title">
                  <strong>{skill.title}</strong>
                  <small>
                    {locked ? 'Locked' : `Level ${levelFor(skill)}/${skill.maxLevel}`} · Heat {skill.heat}
                  </small>
                </span>
                <span className="row-xp">{update.selected ? `+${projectedXp(update)} XP` : `${skill.xp} XP`}</span>
              </button>

              {update.selected && (
                <div className="update-fields">
                  <label>
                    Duration
                    <div className="input-with-unit">
                      <input
                        type="number"
                        min="1"
                        step="5"
                        value={update.minutes}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                          edit(skill.id, { minutes: Math.max(0, Number(event.target.value)) })
                        }
                      />
                      <span>min</span>
                    </div>
                  </label>

                  <label>
                    Level of effort
                    <select
                      value={update.effort}
                      onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                        edit(skill.id, { effort: event.target.value as Effort })
                      }
                    >
                      {(Object.keys(effortLabels) as Effort[]).map((effort) => (
                        <option key={effort} value={effort}>
                          {effortLabels[effort]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="note-field">
                    Daily note
                    <textarea
                      rows={2}
                      value={update.note}
                      placeholder="What changed today?"
                      onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                        edit(skill.id, { note: event.target.value })
                      }
                    />
                  </label>
                </div>
              )}
            </section>
          )
        })}
      </div>

      <div className="submit-zone">
        {lastResult && (
          <div className="result-banner">
            <strong>+{lastResult.totalXp} XP applied</strong>
            <span>
              {lastResult.levelUps} level up{lastResult.levelUps === 1 ? '' : 's'}
              {lastResult.unlocked.length > 0 ? ` · Unlocked ${lastResult.unlocked.join(', ')}` : ''}
            </span>
          </div>
        )}

        <div className="submit-summary">
          <span>{selected.length} nodes</span>
          <span>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</span>
          <strong>+{totalProjectedXp} XP</strong>
        </div>
        <button className="submit-button" type="button" disabled={selected.length === 0} onClick={submit}>
          Submit updates
        </button>
      </div>
    </aside>
  )
}
