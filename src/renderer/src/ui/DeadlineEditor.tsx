import { useEffect, useState } from 'react'
import type { KeyboardEvent, ReactElement } from 'react'
import type { ActivityEntry } from '../model'
import { formatDeadlineDay, parseDeadlineInput } from '../deadline'
import { useMastery } from '../store'
import { DeadlineIcon } from './DeadlineIcon'

interface DeadlineEditorProps {
  entry: ActivityEntry
  compact?: boolean
}

export function DeadlineEditor({ entry, compact = false }: DeadlineEditorProps): ReactElement {
  const setUpdateDeadline = useMastery((state) => state.setUpdateDeadline)
  const [value, setValue] = useState(entry.deadlineOn ? formatDeadlineDay(entry.deadlineOn) : '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValue(entry.deadlineOn ? formatDeadlineDay(entry.deadlineOn) : '')
    setError(null)
  }, [entry.deadlineOn, entry.id])

  const reset = (): void => {
    setValue(entry.deadlineOn ? formatDeadlineDay(entry.deadlineOn) : '')
    setError(null)
  }

  const save = (): boolean => {
    const result = parseDeadlineInput(value)
    if (!result.dateKey) {
      setError(result.error ?? 'Enter a valid deadline day.')
      return false
    }

    setUpdateDeadline(entry.nodeId, entry.id, result.dateKey)
    setValue(formatDeadlineDay(result.dateKey))
    setError(null)
    return true
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    event.stopPropagation()
    if (event.key === 'Enter') {
      event.preventDefault()
      save()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      reset()
      event.currentTarget.blur()
    }
  }

  return (
    <div className={`deadline-editor nowheel nodrag ${compact ? 'deadline-editor--compact' : ''}`}>
      <label>
        <span>Deadline</span>
        <input
          value={value}
          placeholder="Type date numbers"
          aria-label="Deadline day"
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (!value.trim()) {
              reset()
              return
            }
            save()
          }}
        />
      </label>
      {entry.deadlineOn && (
        <button
          className="deadline-editor__remove"
          type="button"
          title="Remove deadline"
          aria-label="Remove deadline"
          onClick={(event) => {
            event.stopPropagation()
            setUpdateDeadline(entry.nodeId, entry.id, undefined)
            setValue('')
            setError(null)
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <DeadlineIcon crossedOut />
        </button>
      )}
      {error && <small role="alert">{error}</small>}
    </div>
  )
}
