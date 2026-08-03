import React, { useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import type { LevelDefaults, RootAccent } from '../model'
import {
  MAX_INCOMING_RELATIONSHIPS,
  MAX_LEVEL_LIMIT,
  MAX_OUTGOING_RELATIONSHIPS,
  ROOT_ACCENTS,
  createSelectionFull,
  nodeRootId,
  nodeTitle,
  toCandidateIds,
  useMastery
} from '../store'

const ACCENT_LABELS: Record<RootAccent, string> = {
  teal: 'Teal',
  violet: 'Violet',
  amber: 'Amber',
  rose: 'Rose',
  green: 'Green',
  blue: 'Blue'
}

export function Create(): ReactElement | null {
  const roots = useMastery((state) => state.roots)
  const skills = useMastery((state) => state.skills)
  const links = useMastery((state) => state.links)
  const draft = useMastery((state) => state.create)
  const setTitle = useMastery((state) => state.setCreateTitle)
  const setAccent = useMastery((state) => state.setCreateAccent)
  const clear = useMastery((state) => state.clearCreateSelection)
  const next = useMastery((state) => state.continueCreate)
  const escape = useMastery((state) => state.escapeCreate)
  const levelDefaults = useMastery((state) => state.levelDefaults)
  const configureLevelDefaults = useMastery((state) => state.configureLevelDefaults)

  useEffect(() => {
    if (!draft) return undefined

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        escape()
        return
      }

      if (event.key !== 'Enter' || event.isComposing || event.repeat) return

      const target = event.target
      if (target instanceof HTMLElement) {
        if (target.closest('[data-create-enter="commit-only"]')) return
        if (
          target.isContentEditable ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLButtonElement ||
          target instanceof HTMLSelectElement
        ) {
          return
        }

        if (
          target instanceof HTMLInputElement &&
          !target.matches('[data-create-enter="advance"]')
        ) {
          return
        }
      }

      if (!draft.title.trim()) return

      event.preventDefault()
      next()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [draft, escape, next])

  const candidateCount = useMemo(() => {
    if (!draft || draft.step !== 'to') return 0
    return toCandidateIds(roots, skills, links, draft).size
  }, [draft, links, roots, skills])

  if (!draft) return null

  const creatingRoot = draft.fromIds.length === 0
  const selectedRootId = draft.fromIds[0]
    ? nodeRootId(draft.fromIds[0], roots, skills)
    : undefined
  const selectedRoot = roots.find((root) => root.id === selectedRootId)
  const ids = draft.step === 'from' ? draft.fromIds : draft.toIds
  const label =
    ids.length > 0
      ? ids.map((id) => nodeTitle(id, roots, skills)).join(' · ')
      : draft.step === 'from'
        ? 'None — create a root'
        : 'None — terminal node'
  const full = createSelectionFull(draft)
  const used = draft.step === 'from' ? draft.fromIds.length : draft.toIds.length
  const capacity =
    draft.step === 'from' ? MAX_INCOMING_RELATIONSHIPS : MAX_OUTGOING_RELATIONSHIPS
  const relationshipDirection = draft.step === 'from' ? 'incoming' : 'outgoing'
  const stepCount = creatingRoot ? 1 : 2

  return (
    <section className="create-card" aria-label="Create node wizard">
      <div className="create-card__step">
        <span>
          {draft.step === 'from' ? '1' : '2'} of {stepCount}
        </span>
        <strong>
          {draft.step === 'from' ? 'Choose From relationships' : 'Choose To relationships'}
        </strong>
      </div>

      <label className="create-name">
        Name
        <input
          value={draft.title}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)}
          data-create-enter="advance"
          autoFocus
        />
      </label>

      {draft.step === 'from' && creatingRoot && (
        <div className="create-color-picker" role="group" aria-label="Root color">
          <span className="create-field-label">
            Root color · <strong>{ACCENT_LABELS[draft.accent]}</strong>
          </span>
          <div className="create-color-options">
            {ROOT_ACCENTS.map((accent) => (
              <button
                key={accent}
                className={`create-color-option create-color-option--${accent} ${draft.accent === accent ? 'create-color-option--selected' : ''}`}
                type="button"
                aria-label={ACCENT_LABELS[accent]}
                aria-pressed={draft.accent === accent}
                title={`${ACCENT_LABELS[accent]} — UI-safe root family color`}
                onClick={() => setAccent(accent)}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="create-copy">
        {draft.step === 'from'
          ? creatingRoot
            ? 'Click any eligible root or non-root node in the graph to make it a parent. Leave From empty to create a new root instead.'
            : `The new node will belong to ${selectedRoot?.title ?? 'the selected root family'}. Click additional eligible nodes in that family to add more parents, then continue.`
          : 'Click graph nodes this new node should point To. Green nodes are available; red nodes are unavailable or at incoming capacity. Leave To empty for a terminal node.'}
      </p>

      {!creatingRoot && (
        <CreateLevelDefaults
          defaults={levelDefaults}
          onChange={configureLevelDefaults}
        />
      )}

      <div className={`selection-log ${full && !creatingRoot ? 'selection-log--full' : ''}`}>
        <span>{draft.step === 'from' ? 'From' : 'To'}</span>
        <strong title={label}>{label}</strong>
      </div>

      {!creatingRoot && (
        <div className="create-capacity">
          <span>
            {used}/{capacity} {relationshipDirection} relationships
          </span>
          <span>
            {full
              ? `${relationshipDirection === 'incoming' ? 'Incoming' : 'Outgoing'} capacity reached`
              : draft.step === 'to'
                ? `${candidateCount} available on graph`
                : `${capacity - used} remaining`}
          </span>
        </div>
      )}

      <div className="create-actions">
        <button type="button" disabled={ids.length === 0} onClick={clear}>
          {draft.step === 'from' ? 'Clear From' : 'Clear To'}
        </button>
        <button
          className="create-continue"
          type="button"
          disabled={!draft.title.trim()}
          onClick={next}
        >
          {draft.step === 'from'
            ? creatingRoot
              ? 'Create Root'
              : 'Choose To Relationships'
            : 'Create Node'}
        </button>
      </div>

      <small className="create-escape">
        Enter{' '}
        {draft.step === 'from'
          ? creatingRoot
            ? 'creates the root'
            : 'continues to To selection'
          : 'creates the node'}
        {' · '}Esc {draft.step === 'from' ? 'cancels creation' : 'returns to From selection'}
      </small>
    </section>
  )
}

function CreateLevelDefaults({
  defaults,
  onChange
}: {
  defaults: LevelDefaults
  onChange: (patch: Partial<LevelDefaults>) => void
}): ReactElement {
  const [stepValue, setStepValue] = useState(String(defaults.levelStepXp))
  const [maxLevelValue, setMaxLevelValue] = useState(String(defaults.maxLevel))

  useEffect(() => {
    setStepValue(String(defaults.levelStepXp))
    setMaxLevelValue(String(defaults.maxLevel))
  }, [defaults.levelStepXp, defaults.maxLevel])

  const commitStep = (): void => {
    const parsed = Number(stepValue)
    if (!Number.isFinite(parsed) || parsed < 1) {
      setStepValue(String(defaults.levelStepXp))
      return
    }

    const levelStepXp = Math.max(1, Math.trunc(parsed))
    setStepValue(String(levelStepXp))
    onChange({ levelStepXp })
  }

  const commitMaxLevel = (): void => {
    const parsed = Number(maxLevelValue)
    if (!Number.isFinite(parsed) || parsed < 1) {
      setMaxLevelValue(String(defaults.maxLevel))
      return
    }

    const maxLevel = Math.min(MAX_LEVEL_LIMIT, Math.max(1, Math.trunc(parsed)))
    setMaxLevelValue(String(maxLevel))
    onChange({ maxLevel })
  }

  const handleKeyDown = (
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
    <section
      className="level-defaults level-defaults--create"
      aria-label="New node level setup"
      data-create-enter="commit-only"
    >
      <div className="level-defaults__heading">
        <div>
          <strong>Level setup</strong>
          <span>Used for this node and remembered for the next one</span>
        </div>
        <span>Saved immediately</span>
      </div>
      <div className="level-defaults__fields">
        <label>
          Level step
          <div className="input-with-unit">
            <input
              type="number"
              min="1"
              step="10"
              value={stepValue}
              aria-label="XP required for each level of the new node"
              onChange={(event) => setStepValue(event.target.value)}
              onBlur={commitStep}
              onKeyDown={(event) =>
                handleKeyDown(event, commitStep, () =>
                  setStepValue(String(defaults.levelStepXp))
                )
              }
            />
            <span>XP</span>
          </div>
        </label>
        <label>
          Max levels
          <input
            type="number"
            min="1"
            max={MAX_LEVEL_LIMIT}
            step="1"
            value={maxLevelValue}
            aria-label="Maximum levels for the new node"
            onChange={(event) => setMaxLevelValue(event.target.value)}
            onBlur={commitMaxLevel}
            onKeyDown={(event) =>
              handleKeyDown(event, commitMaxLevel, () =>
                setMaxLevelValue(String(defaults.maxLevel))
              )
            }
          />
        </label>
      </div>
    </section>
  )
}

