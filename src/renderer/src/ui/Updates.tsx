import { useMemo } from 'react'
import type { ReactElement } from 'react'
import type { Effort } from '../model'
import { projectedXp, useMastery } from '../store'
import { isLocked, levelFor, levelProgressFor } from '../xp'
import { Create } from './Create'

const effortLabels: Record<Effort, string> = {
  recovery: 'Recovery ×0.50',
  light: 'Light ×0.75',
  moderate: 'Moderate ×1.00',
  hard: 'Hard ×1.50',
  maximum: 'Maximum ×2.00'
}

export function Updates(): ReactElement {
  const roots = useMastery((state) => state.roots)
  const skills = useMastery((state) => state.skills)
  const draft = useMastery((state) => state.draft)
  const pickedIds = useMastery((state) => state.pickedIds)
  const create = useMastery((state) => state.create)
  const togglePicked = useMastery((state) => state.togglePicked)
  const edit = useMastery((state) => state.edit)
  const submit = useMastery((state) => state.submit)
  const beginCreate = useMastery((state) => state.beginCreate)
  const lastResult = useMastery((state) => state.lastResult)
  const lastCreated = useMastery((state) => state.lastCreated)

  const ordered = useMemo(() => [...skills].sort((a, b) => b.heat - a.heat), [skills])
  const selectedRoots = roots.filter((root) => pickedIds.includes(root.id))
  const selectedSkills = ordered.filter((skill) => pickedIds.includes(skill.id))
  const selectedCount = selectedRoots.length + selectedSkills.length
  const updatable = selectedSkills.filter((skill) => draft[skill.id]?.selected)
  const totalProjectedXp = updatable.reduce(
    (sum, skill) => sum + projectedXp(draft[skill.id], skill),
    0
  )
  const totalMinutes = updatable.reduce((sum, skill) => sum + draft[skill.id].minutes, 0)

  return (
    <aside className="updates-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Daily command center</span>
          <h2>{create ? 'Node builder' : 'Updates'}</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          title="Create node"
          disabled={Boolean(create)}
          onClick={beginCreate}
        >
          +
        </button>
      </div>

      <Create />

      {lastCreated && !create && (
        <div className="created-banner">
          <strong>{lastCreated}</strong>
          <span>The lattice selected the placement and structural paths.</span>
        </div>
      )}

      <div className={`node-list ${create ? 'node-list--paused' : ''}`}>
        {selectedCount === 0 && !create && (
          <div className="node-list-empty">
            <strong>No nodes selected</strong>
            <span>Select one or more nodes in the graph to add updates.</span>
          </div>
        )}

        {selectedRoots.map((root) => {
          const rootSkills = skills.filter((skill) => skill.rootId === root.id)
          const rank = Math.min(
            10,
            rootSkills.reduce((sum, skill) => sum + levelFor(skill), 0)
          )
          const heat =
            rootSkills.length > 0
              ? Math.round(
                  rootSkills.reduce((sum, skill) => sum + skill.heat, 0) / rootSkills.length
                )
              : 0

          return (
            <section key={root.id} className="update-row update-row--selected update-row--root">
              <button
                className="update-row__header"
                type="button"
                disabled={Boolean(create)}
                title="Remove from updates"
                onClick={() => togglePicked(root.id)}
              >
                <span className="root-row-mark" aria-hidden="true">
                  <span />
                </span>
                <span className="update-title">
                  <strong>{root.title}</strong>
                  <small>Rank {rank} · {rootSkills.length} connected nodes · Heat {heat}</small>
                </span>
                <span className="row-xp row-xp--root">ROOT</span>
              </button>
            </section>
          )
        })}

        {selectedSkills.map((skill) => {
          const update = draft[skill.id]
          const locked = isLocked(skill, skills)
          const progress = levelProgressFor(skill)
          const maxed = progress.maxed

          return (
            <section
              key={skill.id}
              className={`update-row update-row--selected ${locked ? 'update-row--locked' : ''} ${maxed ? 'update-row--maxed' : ''}`}
            >
              <button
                className="update-row__header"
                type="button"
                disabled={Boolean(create)}
                title="Remove from updates"
                onClick={() => togglePicked(skill.id)}
              >
                <span className="heat-dot" style={{ '--row-heat': skill.heat / 100 } as React.CSSProperties} />
                <span className="update-title">
                  <strong>{skill.title}</strong>
                  <small>
                    {locked
                      ? 'Locked'
                      : maxed
                        ? `Level ${skill.maxLevel}/${skill.maxLevel} · Max`
                        : `Level ${levelFor(skill)}/${skill.maxLevel}`} · Heat {skill.heat}
                  </small>
                </span>
                <span className="row-xp">
                  {update?.selected
                    ? `+${projectedXp(update, skill)} XP`
                    : maxed
                      ? 'MAX'
                      : `${progress.currentXp}/${progress.requiredXp} XP`}
                </span>
              </button>

              {update?.selected && !locked && !maxed && !create && (
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

      <div className={`submit-zone ${create ? 'submit-zone--paused' : ''}`}>
        {lastResult && !create && (
          <div className="result-banner">
            <strong>+{lastResult.totalXp} XP applied</strong>
            <span>
              {lastResult.levelUps} level up{lastResult.levelUps === 1 ? '' : 's'}
              {lastResult.unlocked.length > 0 ? ` · Unlocked ${lastResult.unlocked.join(', ')}` : ''}
            </span>
          </div>
        )}

        <div className="submit-summary">
          <span>{updatable.length} nodes</span>
          <span>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</span>
          <strong>+{totalProjectedXp} XP</strong>
        </div>
        <button
          className="submit-button"
          type="button"
          disabled={updatable.length === 0 || totalProjectedXp <= 0 || Boolean(create)}
          onClick={submit}
        >
          Submit updates
        </button>
      </div>
    </aside>
  )
}
