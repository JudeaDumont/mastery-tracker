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
  const links = useMastery((state) => state.links)
  const draft = useMastery((state) => state.draft)
  const pickedIds = useMastery((state) => state.pickedIds)
  const create = useMastery((state) => state.create)
  const edit = useMastery((state) => state.edit)
  const submit = useMastery((state) => state.submit)
  const beginCreate = useMastery((state) => state.beginCreate)
  const deleteNode = useMastery((state) => state.deleteNode)
  const lastResult = useMastery((state) => state.lastResult)
  const lastCreated = useMastery((state) => state.lastCreated)
  const [expandedIds, setExpandedIds] = useState<Set<NodeId>>(new Set())
  const [pendingDeleteId, setPendingDeleteId] = useState<NodeId | null>(null)
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

  useEffect(() => {
    if (!pendingDeleteId) return

    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setPendingDeleteId(null)
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [pendingDeleteId])

  const toggleExpanded = (id: NodeId): void => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedRoots = pickedIds
    .map((id) => roots.find((root) => root.id === id))
    .filter((root): root is (typeof roots)[number] => Boolean(root))
  const selectedSkills = pickedIds
    .map((id) => skills.find((skill) => skill.id === id))
    .filter((skill): skill is (typeof skills)[number] => Boolean(skill))
  const selectedCount = selectedRoots.length + selectedSkills.length
  const updatable = selectedSkills.filter((skill) => draft[skill.id]?.selected)
  const totalProjectedXp = updatable.reduce(
    (sum, skill) => sum + projectedXp(draft[skill.id], skill),
    0
  )
  const totalMinutes = updatable.reduce((sum, skill) => sum + draft[skill.id].minutes, 0)
  const deletion = useMemo(() => {
    if (!pendingDeleteId) return null

    const root = roots.find((candidate) => candidate.id === pendingDeleteId)
    if (root) {
      const childIds = new Set(
        skills.filter((skill) => skill.rootId === root.id).map((skill) => skill.id)
      )
      const deletedIds = new Set<NodeId>([root.id, ...childIds])

      return {
        id: root.id,
        title: root.title,
        kind: 'root' as const,
        childCount: childIds.size,
        relationshipCount: links.filter(
          (link) => deletedIds.has(link.from) || deletedIds.has(link.to)
        ).length,
        activityCount:
          root.updateHistory.length +
          skills
            .filter((skill) => childIds.has(skill.id))
            .reduce((count, skill) => count + skill.updateHistory.length, 0),
        dependentCount: 0
      }
    }

    const skill = skills.find((candidate) => candidate.id === pendingDeleteId)
    if (!skill) return null

    return {
      id: skill.id,
      title: skill.title,
      kind: 'node' as const,
      childCount: 0,
      relationshipCount: links.filter(
        (link) => link.from === skill.id || link.to === skill.id
      ).length,
      activityCount: skill.updateHistory.length,
      dependentCount: skills.filter((candidate) =>
        candidate.gates.some((gate) => gate.nodeId === skill.id)
      ).length
    }
  }, [links, pendingDeleteId, roots, skills])

  const confirmDelete = (): void => {
    if (!deletion) return
    deleteNode(deletion.id)
    setPendingDeleteId(null)
  }

  return (
    <>
      <aside className="updates-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Daily command center</span>
          <h2>{create ? 'Node builder' : 'Updates'}</h2>
        </div>
        <button
          className="create-node-button"
          type="button"
          disabled={Boolean(create)}
          onClick={beginCreate}
        >
          Create New Node
        </button>
      </div>


      {lastCreated && !create && (
        <div className="created-banner">
          <strong>{lastCreated}</strong>
          <span>The lattice selected the placement and structural paths.</span>
        </div>
      )}

      <div className="node-list">
        {create && <Create />}

        {selectedCount === 0 && !create && (
          <div className="node-list-empty">
            <strong>No nodes selected</strong>
            <span>Select one or more nodes in the graph to add updates.</span>
          </div>
        )}

        {!create && selectedRoots.map((root) => {
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
              style={
                {
                  '--momentum': momentum / 100,
                  order: pickedIds.indexOf(root.id)
                } as CSSProperties
              }
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
                  <button
                    className="node-delete-button"
                    type="button"
                    onClick={() => setPendingDeleteId(root.id)}
                  >
                    Delete root
                  </button>
                </div>
              )}
            </section>
          )
        })}

        {!create && selectedSkills.map((skill) => {
          const update = draft[skill.id]
          const locked = isLocked(skill, skills)
          const progress = levelProgressFor(skill)
          const maxed = progress.maxed
          const level = levelFor(skill)
          const compactXp = `${progress.currentXp}/${progress.requiredXp} XP`
          const accent: RootAccent =
            roots.find((root) => root.id === skill.rootId)?.accent ?? 'teal'
          const expanded = expandedIds.has(skill.id)

          return (
            <section
              key={skill.id}
              className={`update-row update-row--selected update-row--accent-${accent} ${locked ? 'update-row--locked' : ''} ${maxed ? 'update-row--maxed' : ''} ${expanded ? 'update-row--expanded' : ''}`}
              style={
                {
                  '--momentum': skill.momentum / 100,
                  order: pickedIds.indexOf(skill.id)
                } as CSSProperties
              }
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
                    {locked ? 'Locked · ' : ''}Level {level}/{skill.maxLevel} · {compactXp} ·
                    Momentum {skill.momentum}
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

              {expanded && !create && (
                <div className="update-row-actions">
                  <button
                    className="node-delete-button"
                    type="button"
                    onClick={() => setPendingDeleteId(skill.id)}
                  >
                    Delete node
                  </button>
                </div>
              )}
            </section>
          )
        })}
      </div>

      {!create && (
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
          <span>{updatable.length} nodes</span>
          <span>
            {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
          </span>
          <strong>+{totalProjectedXp} XP</strong>
        </div>
        <button
          className="submit-button"
          type="button"
          disabled={updatable.length === 0 || totalProjectedXp <= 0}
          onClick={submit}
        >
          Submit updates
        </button>
        </div>
      )}
      </aside>

      {deletion && (
        <div
          className="confirmation-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPendingDeleteId(null)
          }}
        >
          <section
            className="confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
          >
            <span className="confirmation-dialog__eyebrow">Permanent graph change</span>
            <h3 id="delete-dialog-title">Delete {deletion.title}?</h3>
            <p id="delete-dialog-description">
              {deletion.kind === 'root'
                ? `This deletes the root, ${deletion.childCount} child node${deletion.childCount === 1 ? '' : 's'}, ${deletion.relationshipCount} relationship${deletion.relationshipCount === 1 ? '' : 's'}, and ${deletion.activityCount} activity entr${deletion.activityCount === 1 ? 'y' : 'ies'}.`
                : `This deletes the node, ${deletion.relationshipCount} relationship${deletion.relationshipCount === 1 ? '' : 's'}, and ${deletion.activityCount} activity entr${deletion.activityCount === 1 ? 'y' : 'ies'}. ${deletion.dependentCount > 0 ? `${deletion.dependentCount} dependent node${deletion.dependentCount === 1 ? '' : 's'} will have this prerequisite removed.` : ''}`}
            </p>
            <p className="confirmation-dialog__warning">
              This is saved immediately and cannot be undone from inside the app.
            </p>
            <div className="confirmation-dialog__actions">
              <button
                className="confirmation-cancel-button"
                type="button"
                autoFocus
                onClick={() => setPendingDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="confirmation-delete-button"
                type="button"
                onClick={confirmDelete}
              >
                Delete {deletion.kind === 'root' ? 'root' : 'node'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
