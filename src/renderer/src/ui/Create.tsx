import { useEffect, useMemo } from 'react'
import type { ReactElement } from 'react'
import {
  NODE_CAPACITY,
  createSelectionFull,
  nodeTitle,
  toCandidateIds,
  useMastery
} from '../store'

export function Create(): ReactElement | null {
  const roots = useMastery((state) => state.roots)
  const skills = useMastery((state) => state.skills)
  const links = useMastery((state) => state.links)
  const draft = useMastery((state) => state.create)
  const setTitle = useMastery((state) => state.setCreateTitle)
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

  const ids = draft.step === 'from' ? draft.fromIds : draft.toIds
  const label = ids.length > 0
    ? ids.map((id) => nodeTitle(id, roots, skills)).join(' · ')
    : draft.step === 'from'
      ? 'Root — create a new category'
      : 'None — create a terminal node'
  const full = createSelectionFull(draft)
  const used = draft.fromIds.length + draft.toIds.length

  return (
    <section className="create-card" aria-label="Create node wizard">
      <div className="create-card__step">
        <span>{draft.step === 'from' ? '1' : '2'} of 2</span>
        <strong>{draft.step === 'from' ? 'Select From nodes' : 'Select To nodes'}</strong>
      </div>

      <label className="create-name">
        Name
        <input
          value={draft.title}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)}
          autoFocus
        />
      </label>

      <p className="create-copy">
        {draft.step === 'from'
          ? 'Click nodes in the grid to choose where this mastery comes from. Clear everything to create a new root.'
          : 'Green nodes are legal destinations. The grid chooses and previews the final placement for you.'}
      </p>

      <div className={`selection-log ${full && draft.step === 'to' ? 'selection-log--full' : ''}`}>
        <span>{draft.step === 'from' ? 'From' : 'To'}</span>
        <strong title={label}>{label}</strong>
      </div>

      {draft.step === 'to' && (
        <div className="create-capacity">
          <span>{used}/{NODE_CAPACITY} structural connections</span>
          <span>{full ? 'Capacity reached' : `${candidateCount} candidates`}</span>
        </div>
      )}

      <div className="create-actions">
        <button type="button" onClick={clear}>Clear</button>
        <button className="create-continue" type="button" disabled={!draft.title.trim()} onClick={next}>
          Continue
        </button>
      </div>

      <small className="create-escape">
        Esc {draft.step === 'from' ? 'cancels creation' : 'returns to From selection'}
      </small>
    </section>
  )
}
