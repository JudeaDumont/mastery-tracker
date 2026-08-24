import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { LevelDefaults, RootAccent, RootEngraving } from '../model'
import {
  MAX_INCOMING_RELATIONSHIPS,
  MAX_LEVEL_LIMIT,
  MAX_OUTGOING_RELATIONSHIPS,
  ROOT_ACCENTS,
  ROOT_ACCENT_LABELS,
  createSelectionFull,
  nodeRootId,
  nodeTitle,
  toCandidateIds,
  useMastery
} from '../store'
import {
  EngravingGlyph,
  ROOT_ENGRAVINGS,
  ROOT_ENGRAVING_LABELS,
  rootAccentRgb
} from '../rootEngravings'

export function Create(): ReactElement | null {
  const roots = useMastery((state) => state.roots)
  const skills = useMastery((state) => state.skills)
  const links = useMastery((state) => state.links)
  const draft = useMastery((state) => state.create)
  const setTitle = useMastery((state) => state.setCreateTitle)
  const setAccent = useMastery((state) => state.setCreateAccent)
  const setEngraving = useMastery((state) => state.setCreateEngraving)
  const clear = useMastery((state) => state.clearCreateSelection)
  const next = useMastery((state) => state.continueCreate)
  const escape = useMastery((state) => state.escapeCreate)
  const levelDefaults = useMastery((state) => state.levelDefaults)
  const configureLevelDefaults = useMastery((state) => state.configureLevelDefaults)
  const [titleValue, setTitleValue] = useState(() => draft?.title ?? '')
  const draftTitle = draft?.title

  // Keep keystrokes local to this small dialog. Updating the global create draft on
  // every character makes the graph renderer wake up unnecessarily; a short
  // debounce keeps the preview label current without blocking fast typing.
  useEffect(() => {
    if (draftTitle === undefined || draftTitle === titleValue) return undefined

    const timeout = window.setTimeout(() => setTitle(titleValue), 140)
    return () => window.clearTimeout(timeout)
  }, [draftTitle, setTitle, titleValue])

  const advance = useCallback((): void => {
    if (draftTitle === undefined || !titleValue.trim()) return
    if (draftTitle !== titleValue) setTitle(titleValue)
    next()
  }, [draftTitle, next, setTitle, titleValue])

  useEffect(() => {
    if (draftTitle === undefined) return undefined

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        escape()
        return
      }

      if (event.key !== 'Enter' || event.isComposing || event.repeat) return

      const target = event.target
      if (target instanceof HTMLElement) {
        if (target.closest('[data-create-enter="commit-and-advance"]')) return
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

      if (!titleValue.trim()) return

      event.preventDefault()
      advance()
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [advance, draftTitle, escape, titleValue])

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
          value={titleValue}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setTitleValue(event.target.value)}
          onBlur={() => {
            if (draft.title !== titleValue) setTitle(titleValue)
          }}
          data-create-enter="advance"
          autoFocus
        />
      </label>

      {draft.step === 'from' && creatingRoot && (
        <div className="create-color-picker" role="group" aria-label="Root color">
          <span className="create-field-label">
            Root color · <strong>{ROOT_ACCENT_LABELS[draft.accent]}</strong>
          </span>
          <div className="create-color-options">
            {ROOT_ACCENTS.map((accent) => (
              <button
                key={accent}
                className={`create-color-option create-color-option--${accent} ${draft.accent === accent ? 'create-color-option--selected' : ''}`}
                type="button"
                aria-label={ROOT_ACCENT_LABELS[accent]}
                aria-pressed={draft.accent === accent}
                title={`${ROOT_ACCENT_LABELS[accent]} — UI-safe root family color`}
                onClick={() => setAccent(accent)}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      {draft.step === 'from' && creatingRoot && (
        <CreateEngravingPicker
          engraving={draft.engraving}
          accent={draft.accent}
          onChange={setEngraving}
        />
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
          onAdvance={next}
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
          disabled={!titleValue.trim()}
          onClick={advance}
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
  onChange,
  onAdvance
}: {
  defaults: LevelDefaults
  onChange: (patch: Partial<LevelDefaults>) => void
  onAdvance: () => void
}): ReactElement {
  const [stepValue, setStepValue] = useState(String(defaults.levelStepXp))
  const [maxLevelValue, setMaxLevelValue] = useState(String(defaults.maxLevel))

  useEffect(() => {
    setStepValue(String(defaults.levelStepXp))
    setMaxLevelValue(String(defaults.maxLevel))
  }, [defaults.levelStepXp, defaults.maxLevel])

  const commitStep = (): boolean => {
    const parsed = Number(stepValue)
    if (!Number.isFinite(parsed) || parsed < 1) {
      setStepValue(String(defaults.levelStepXp))
      return false
    }

    const levelStepXp = Math.max(1, Math.trunc(parsed))
    setStepValue(String(levelStepXp))
    onChange({ levelStepXp })
    return true
  }

  const commitMaxLevel = (): boolean => {
    const parsed = Number(maxLevelValue)
    if (!Number.isFinite(parsed) || parsed < 1) {
      setMaxLevelValue(String(defaults.maxLevel))
      return false
    }

    const maxLevel = Math.min(MAX_LEVEL_LIMIT, Math.max(1, Math.trunc(parsed)))
    setMaxLevelValue(String(maxLevel))
    onChange({ maxLevel })
    return true
  }

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    commit: () => boolean,
    reset: () => void
  ): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      if (commit()) onAdvance()
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
      data-create-enter="commit-and-advance"
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



function CreateEngravingPicker({
  engraving,
  accent,
  onChange
}: {
  engraving: RootEngraving
  accent: RootAccent
  onChange: (engraving: RootEngraving) => void
}): ReactElement {
  return (
    <div
      className="create-engraving-picker"
      role="group"
      aria-label="Root engraving"
      style={{ '--engraving-option-rgb': rootAccentRgb(accent) } as CSSProperties}
    >
      <span className="create-field-label">
        Root engraving · <strong>{ROOT_ENGRAVING_LABELS[engraving]}</strong>
      </span>
      <div className="create-engraving-options">
        {ROOT_ENGRAVINGS.map((option) => (
          <button
            key={option}
            className={`create-engraving-option ${engraving === option ? 'create-engraving-option--selected' : ''}`}
            type="button"
            aria-label={ROOT_ENGRAVING_LABELS[option]}
            aria-pressed={engraving === option}
            title={ROOT_ENGRAVING_LABELS[option]}
            onClick={() => onChange(option)}
          >
            <span className="create-engraving-option__icon" aria-hidden="true">
              <EngravingGlyph type={option} className="create-engraving-option__icon-svg" />
            </span>
            <span>{ROOT_ENGRAVING_LABELS[option]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
