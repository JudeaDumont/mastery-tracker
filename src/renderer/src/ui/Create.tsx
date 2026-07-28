import React, { useEffect, useMemo } from 'react'
import type { ReactElement } from 'react'
import type { RootAccent } from '../model'
import {
  MAX_INCOMING_RELATIONSHIPS,
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

  useEffect(() => {
    if (!draft) return undefined

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      escape()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [draft, escape])

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
        Esc {draft.step === 'from' ? 'cancels creation' : 'returns to From selection'}
      </small>
    </section>
  )
}
