import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { Effort, NodeId, RootAccent } from '../model'
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
  const edit = useMastery((state) => state.edit)
  const submit = useMastery((state) => state.submit)
  const beginCreate = useMastery((state) => state.beginCreate)
  const lastResult = useMastery((state) => state.lastResult)
  const lastCreated = useMastery((state) => state.lastCreated)
  const [expandedIds, setExpandedIds] = useState<Set<NodeId>>(new Set())
  const previousPickedIds = useRef<Set<NodeId>>(new Set())

  useEffect(() => {
    const selectedIds = new Set(pickedIds)
    const previousIds = previousPickedIds.current

    setExpandedIds((current) => {
      const next = new Set([...current].filter((id) => selectedIds.has(id)))

      pickedIds.forEach((id) => {
        if (!previousIds.has(id)) next.add(id)
      })

      return next
    })

    previousPickedIds.current = selectedIds
  }, [pickedIds])

  const toggleExpanded = (id: NodeId): void => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const ordered = useMemo(() => [...skills].sort((a, b) => b.momentum - a.momentum), [skills])
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
          const momentum =
            rootSkills.length > 0
              ? Math.round(
                  rootSkills.reduce((sum, skill) => sum + skill.momentum, 0) / rootSkills.length
                )
              : 0
          const expanded = expandedIds.has(root.id)

          return (
            <section
              key={root.id}
              className={`update-row update-row--selected update-row--root update-row--accent-${root.accent ?? 'teal'} ${expanded ? 'update-row--expanded' : ''}`}
              style={{ '--momentum': momentum / 100 } as CSSProperties}
            >
              <button
                className="update-row__header"
                type="button"
                disabled={Boolean(create)}
                title={expanded ? 'Collapse root details' : 'Expand root details'}
                aria-expanded={expanded}
                onClick={() => toggleExpanded(root.id)}
              >
                <span className="root-row-mark momentum-colored" aria-hidden="true">
                  <span />
                </span>
                <span className="update-title">
                  <strong>{root.title}</strong>
                  <small>
                    Rank {rank} · {rootSkills.length} connected nodes · Momentum {momentum}
                  </small>
                </span>
                <span className="update-row__status">
                  <span className="update-row__compact-meta update-row__compact-meta--root">
                    <span>Rank {rank}</span>
                    <span>{rootSkills.length} nodes</span>
                    <span>Momentum {momentum}</span>
                  </span>
                  <span className="row-xp row-xp--root update-row__expanded-xp">ROOT</span>
                  <span className="update-row__chevron" aria-hidden="true" />
                </span>
              </button>

              {expanded && !create && (
                <div className="root-update-details">
                  <span>Root rank is derived from its connected mastery nodes.</span>
                </div>
              )}
            </section>
          )
        })}

        {selectedSkills.map((skill) => {
          const update = draft[skill.id]
          const locked = isLocked(skill, skills)
          const progress = levelProgressFor(skill)
          const maxed = progress.maxed
          const level = levelFor(skill)
          const compactXp = maxed
            ? `${progress.overflowXp} XP banked`
            : `${progress.currentXp}/${progress.requiredXp} XP`
          const expandedXp = maxed
            ? `${progress.overflowXp} XP banked beyond the current cap`
            : `${progress.currentXp} / ${progress.requiredXp} XP`
          const accent: RootAccent =
            roots.find((root) => root.id === skill.rootId)?.accent ?? 'teal'
          const expanded = expandedIds.has(skill.id)

          return (
            <section
              key={skill.id}
              className={`update-row update-row--selected update-row--accent-${accent} ${locked ? 'update-row--locked' : ''} ${maxed ? 'update-row--maxed' : ''} ${expanded ? 'update-row--expanded' : ''}`}
              style={{ '--momentum': skill.momentum / 100 } as CSSProperties}
            >
              <button
                className="update-row__header"
                type="button"
                disabled={Boolean(create)}
                title={expanded ? 'Collapse update fields' : 'Expand update fields'}
                aria-expanded={expanded}
                onClick={() => toggleExpanded(skill.id)}
              >
                <span className="momentum-dot momentum-colored" aria-hidden="true" />
                <span className="update-title">
                  <strong>{skill.title}</strong>
                  <small>
                    {locked
                      ? 'Locked'
                      : maxed
                        ? `Level ${skill.maxLevel}/${skill.maxLevel} · Current cap`
                        : `Level ${level}/${skill.maxLevel}`} · Momentum {skill.momentum}
                  </small>
                </span>
                <span className="update-row__status">
                  <span className="update-row__compact-meta">
                    <span>Lv {level}/{skill.maxLevel}</span>
                    <span>{compactXp}</span>
                    <span>Momentum {skill.momentum}</span>
                  </span>
                  <span className="row-xp update-row__expanded-xp">
                    {update?.selected ? `+${projectedXp(update, skill)} XP` : compactXp}
                  </span>
                  <span className="update-row__chevron" aria-hidden="true" />
                </span>
              </button>

              {expanded && !create && (
                <div className="update-xp-progress">
                  <span>{maxed ? 'XP beyond current cap' : 'Current / next level XP'}</span>
                  <strong>{expandedXp}</strong>
                </div>
              )}

              {expanded && locked && !create && (
                <div className="update-row-message">
                  Complete this node&apos;s prerequisites before applying XP.
                </div>
              )}

              {expanded && update?.selected && !locked && !create && (
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
          <span>
            {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
          </span>
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
