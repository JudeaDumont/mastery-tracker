import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactElement } from 'react'
import type { Effort, NodeId, RootAccent, Skill } from '../model'
import {
  MAX_LEVEL_LIMIT,
  ROOT_ACCENTS,
  ROOT_ACCENT_LABELS,
  projectedXp,
  useMastery
} from '../store'
import { isLocked, levelFor, levelProgressFor, uniformLevelStepXp } from '../xp'
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
  const clearPicked = useMastery((state) => state.clearPicked)
  const beginCreate = useMastery((state) => state.beginCreate)
  const deleteNode = useMastery((state) => state.deleteNode)
  const lastResult = useMastery((state) => state.lastResult)
  const lastCreated = useMastery((state) => state.lastCreated)
  const [expandedIds, setExpandedIds] = useState<Set<NodeId>>(new Set())
  const [pendingDeleteId, setPendingDeleteId] = useState<NodeId | null>(null)
  const [settingsNodeId, setSettingsNodeId] = useState<NodeId | null>(null)
  const [submitWarning, setSubmitWarning] = useState<{
    id: number
    message: string
    x: number
    y: number
  } | null>(null)
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

  useEffect(() => {
    if (!settingsNodeId) return

    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSettingsNodeId(null)
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [settingsNodeId])

  useEffect(() => {
    if (!settingsNodeId) return
    const exists =
      roots.some((root) => root.id === settingsNodeId) ||
      skills.some((skill) => skill.id === settingsNodeId)
    if (!exists) setSettingsNodeId(null)
  }, [roots, settingsNodeId, skills])

  useEffect(() => {
    setSubmitWarning(null)
  }, [draft])

  useEffect(() => {
    if (!submitWarning) return

    const timeout = window.setTimeout(() => setSubmitWarning(null), 2600)
    return () => window.clearTimeout(timeout)
  }, [submitWarning])

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
  const settingsRoot = settingsNodeId
    ? roots.find((root) => root.id === settingsNodeId) ?? null
    : null
  const settingsSkill = settingsNodeId
    ? skills.find((skill) => skill.id === settingsNodeId) ?? null
    : null
  const updatable = selectedSkills.filter((skill) => draft[skill.id]?.selected)
  const totalProjectedXp = updatable.reduce(
    (sum, skill) => sum + projectedXp(draft[skill.id], skill),
    0
  )
  const totalMinutes = updatable.reduce((sum, skill) => sum + draft[skill.id].minutes, 0)
  const notesWithoutXp = updatable.filter((skill) => {
    const update = draft[skill.id]
    return update.note.trim().length > 0 && projectedXp(update, skill) <= 0
  })
  const canAttemptSubmit =
    updatable.length > 0 && (totalProjectedXp > 0 || notesWithoutXp.length > 0)
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

  const submitUpdates = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    if (notesWithoutXp.length > 0) {
      const titles = notesWithoutXp.map((skill) => skill.title)
      const message =
        titles.length === 1
          ? `${titles[0]} has a note but 0 XP. Add XP or remove the note before submitting.`
          : `${titles.join(', ')} have notes but 0 XP. Add XP or remove the notes before submitting.`
      const halfWidth = 190
      const x = Math.min(
        window.innerWidth - halfWidth - 12,
        Math.max(halfWidth + 12, event.clientX)
      )
      const y = Math.max(96, event.clientY - 14)

      setSubmitWarning({ id: Date.now(), message, x, y })
      return
    }

    setSubmitWarning(null)
    submit()
  }

  return (
    <>
      <aside className="updates-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Daily command center</span>
          <h2>{create ? 'Node builder' : 'Updates'}</h2>
        </div>
        <div className="panel-heading__actions">
          <button
            className="clear-selection-button"
            type="button"
            disabled={Boolean(create) || selectedCount === 0}
            onClick={() => {
              clearPicked()
              setSettingsNodeId(null)
            }}
          >
            Clear
          </button>
          <button
            className="create-node-button"
            type="button"
            disabled={Boolean(create)}
            onClick={beginCreate}
          >
            Create New Node
          </button>
        </div>
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
            <span>Select a node in the graph to add an update.</span>
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
                    className="node-settings-button"
                    type="button"
                    title={`Open ${root.title} settings`}
                    aria-label={`Open ${root.title} settings`}
                    onClick={() => setSettingsNodeId(root.id)}
                  >
                    <GearIcon />
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

              {expanded && !create && (
                <div className="update-row-toolbar">
                  <span>Daily update</span>
                  <button
                    className="node-settings-button"
                    type="button"
                    title={`Open ${skill.title} settings`}
                    aria-label={`Open ${skill.title} settings`}
                    onClick={() => setSettingsNodeId(skill.id)}
                  >
                    <GearIcon />
                  </button>
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
                        min="0"
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
          <span>
            {updatable.length} {updatable.length === 1 ? 'node' : 'nodes'}
          </span>
          <span>
            {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
          </span>
          <strong>+{totalProjectedXp} XP</strong>
        </div>
        <button
          className="submit-button"
          type="button"
          disabled={!canAttemptSubmit}
          onClick={submitUpdates}
        >
          Submit update
        </button>
        </div>
      )}
      </aside>

      {submitWarning &&
        createPortal(
          <div
            key={submitWarning.id}
            className="cursor-warning-toast"
            role="alert"
            style={{ left: submitWarning.x, top: submitWarning.y }}
          >
            <strong>Note has no XP</strong>
            <span>{submitWarning.message}</span>
          </div>,
          document.body
        )}

      {(settingsRoot || settingsSkill) &&
        createPortal(
          <div
            className="node-settings-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSettingsNodeId(null)
            }}
          >
            <section
              className="node-settings-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="node-settings-title"
            >
              <header className="node-settings-dialog__header">
                <div>
                  <span className="node-settings-dialog__eyebrow">
                    {settingsRoot ? 'Root settings' : 'Node settings'}
                  </span>
                  <h3 id="node-settings-title">
                    {settingsRoot?.title ?? settingsSkill?.title}
                  </h3>
                </div>
                <button
                  className="node-settings-dialog__close"
                  type="button"
                  aria-label="Close node settings"
                  onClick={() => setSettingsNodeId(null)}
                >
                  ×
                </button>
              </header>

              <NameSettings
                nodeId={(settingsRoot ?? settingsSkill)!.id}
                title={(settingsRoot ?? settingsSkill)!.title}
                kind={settingsRoot ? 'root' : 'node'}
              />

              {settingsSkill && (
                <>
                  <div className="node-settings-summary">
                    <span>Current level</span>
                    <strong>
                      {levelFor(settingsSkill)}/{settingsSkill.maxLevel}
                    </strong>
                    <span>Lifetime XP</span>
                    <strong>{settingsSkill.xp.toLocaleString()}</strong>
                  </div>
                  <LevelSettings skill={settingsSkill} />
                </>
              )}

              {settingsRoot && (
                <RootColorSettings rootId={settingsRoot.id} accent={settingsRoot.accent ?? 'teal'} />
              )}

              {settingsRoot && (
                <section className="node-settings-section">
                  <div className="node-settings-section__heading">
                    <div>
                      <strong>Root behavior</strong>
                      <span>Derived from connected mastery nodes</span>
                    </div>
                  </div>
                  <p className="node-settings-copy">
                    Root rank and momentum are calculated automatically. Level configuration is
                    available on each connected mastery node.
                  </p>
                </section>
              )}

              <section className="node-settings-danger">
                <div>
                  <strong>Delete {settingsRoot ? 'root' : 'node'}</strong>
                  <span>This opens a confirmation before anything is removed.</span>
                </div>
                <button
                  className="node-delete-button"
                  type="button"
                  onClick={() => {
                    const id = settingsRoot?.id ?? settingsSkill?.id
                    if (!id) return
                    setSettingsNodeId(null)
                    setPendingDeleteId(id)
                  }}
                >
                  Delete {settingsRoot ? 'root' : 'node'}
                </button>
              </section>
            </section>
          </div>,
          document.body
        )}

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

function NameSettings({
  nodeId,
  title,
  kind
}: {
  nodeId: NodeId
  title: string
  kind: 'root' | 'node'
}): ReactElement {
  const renameNode = useMastery((state) => state.renameNode)
  const [value, setValue] = useState(title)

  useEffect(() => {
    setValue(title)
  }, [nodeId, title])

  const reset = (): void => setValue(title)

  const commit = (): void => {
    const normalized = value.trim().replace(/\s+/g, ' ')
    if (!normalized) {
      reset()
      return
    }

    setValue(normalized)
    renameNode(nodeId, normalized)
  }

  return (
    <section className="node-settings-section node-settings-name">
      <div className="node-settings-section__heading">
        <div>
          <strong>{kind === 'root' ? 'Root name' : 'Node name'}</strong>
          <span>Updates everywhere immediately</span>
        </div>
      </div>
      <label>
        Display name
        <input
          type="text"
          value={value}
          maxLength={120}
          aria-label={`${kind === 'root' ? 'Root' : 'Node'} display name`}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.stopPropagation()
              commit()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              reset()
            }
          }}
        />
      </label>
      <small>The internal node ID and every relationship stay unchanged.</small>
    </section>
  )
}

function RootColorSettings({
  rootId,
  accent
}: {
  rootId: NodeId
  accent: RootAccent
}): ReactElement {
  const setRootAccent = useMastery((state) => state.setRootAccent)

  return (
    <section className="node-settings-section node-settings-color">
      <div className="node-settings-section__heading">
        <div>
          <strong>Root color</strong>
          <span>{ROOT_ACCENT_LABELS[accent]} · updates the entire root family</span>
        </div>
      </div>
      <div className="root-color-options" role="group" aria-label="Root color">
        {ROOT_ACCENTS.map((option) => (
          <button
            key={option}
            className={`root-color-option root-color-option--${option} ${accent === option ? 'root-color-option--selected' : ''}`}
            type="button"
            aria-label={ROOT_ACCENT_LABELS[option]}
            aria-pressed={accent === option}
            title={ROOT_ACCENT_LABELS[option]}
            onClick={() => setRootAccent(rootId, option)}
          >
            <span aria-hidden="true" />
          </button>
        ))}
      </div>
      <small>Color changes save to the graph state immediately.</small>
    </section>
  )
}

function LevelSettings({ skill }: { skill: Skill }): ReactElement {
  const configureLevels = useMastery((state) => state.configureLevels)
  const configuredStep = uniformLevelStepXp(skill)
  const [stepValue, setStepValue] = useState(
    configuredStep === null ? '' : String(configuredStep)
  )
  const [maxLevelValue, setMaxLevelValue] = useState(String(skill.maxLevel))
  useEffect(() => {
    setStepValue(configuredStep === null ? '' : String(configuredStep))
    setMaxLevelValue(String(skill.maxLevel))
  }, [configuredStep, skill.id, skill.maxLevel])

  const resetStep = (): void => {
    const nextStep = uniformLevelStepXp(skill)
    setStepValue(nextStep === null ? '' : String(nextStep))
  }

  const commitStep = (): void => {
    if (stepValue.trim() === '') {
      resetStep()
      return
    }

    const parsed = Number(stepValue)
    if (!Number.isFinite(parsed) || parsed < 1) {
      resetStep()
      return
    }

    const levelStepXp = Math.max(1, Math.trunc(parsed))
    setStepValue(String(levelStepXp))
    configureLevels(skill.id, { levelStepXp })
  }

  const resetMaxLevel = (): void => setMaxLevelValue(String(skill.maxLevel))

  const commitMaxLevel = (): void => {
    const parsed = Number(maxLevelValue)
    if (!Number.isFinite(parsed) || parsed < 1) {
      resetMaxLevel()
      return
    }

    const maxLevel = Math.min(MAX_LEVEL_LIMIT, Math.max(1, Math.trunc(parsed)))
    setMaxLevelValue(String(maxLevel))
    configureLevels(skill.id, { maxLevel })
  }

  const handleNumericKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    commit: () => void,
    reset: () => void
  ): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      commit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      reset()
    }
  }

  return (
    <section className="node-settings-section node-settings-levels" aria-label={`${skill.title} level settings`}>
      <div className="node-settings-section__heading">
        <strong>Level settings</strong>
        <span>Saved immediately</span>
      </div>
      <div className="node-settings-levels__fields">
        <label>
          Level step XP
          <div className="input-with-unit">
            <input
              type="number"
              min="1"
              step="10"
              value={stepValue}
              placeholder="Custom"
              aria-label="XP required for each level step"
              onChange={(event) => setStepValue(event.target.value)}
              onBlur={commitStep}
              onKeyDown={(event) => handleNumericKeyDown(event, commitStep, resetStep)}
            />
            <span>XP</span>
          </div>
        </label>
        <label>
          Maximum levels
          <input
            type="number"
            min="1"
            max={MAX_LEVEL_LIMIT}
            step="1"
            value={maxLevelValue}
            aria-label="Maximum levels"
            onChange={(event) => setMaxLevelValue(event.target.value)}
            onBlur={commitMaxLevel}
            onKeyDown={(event) =>
              handleNumericKeyDown(event, commitMaxLevel, resetMaxLevel)
            }
          />
        </label>
      </div>
      <small>
        {configuredStep === null
          ? 'This node currently has custom level costs. Entering a value makes every level use the same XP step.'
          : `Each level adds another ${configuredStep.toLocaleString()} XP. Lifetime XP is never reset.`}
      </small>
    </section>
  )
}

function GearIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z" />
      <path d="M19.2 13.2c.04-.39.04-.81 0-1.2l2.03-1.58-1.92-3.32-2.39.96a7.9 7.9 0 0 0-2.08-1.2L14.48 4h-3.84l-.36 2.86a7.9 7.9 0 0 0-2.08 1.2l-2.39-.96-1.92 3.32L5.92 12a6.03 6.03 0 0 0 0 1.2l-2.03 1.58 1.92 3.32 2.39-.96c.63.5 1.33.91 2.08 1.2l.36 2.86h3.84l.36-2.86a7.9 7.9 0 0 0 2.08-1.2l2.39.96 1.92-3.32L19.2 13.2Z" />
    </svg>
  )
}

