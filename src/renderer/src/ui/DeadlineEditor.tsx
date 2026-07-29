import { useEffect, useState } from 'react'
import type { KeyboardEvent, ReactElement } from 'react'
import type { ActivityEntry } from '../model'
import { formatDeadlineDay, parseDeadlineInput } from '../deadline'
import { useMastery } from '../store'
import { DeadlineIcon } from './DeadlineIcon'
import { OpportunityIcon } from './OpportunityIcon'

export type ScheduleKind = 'deadline' | 'opportune'

interface DeadlineEditorProps {
  entry: ActivityEntry
  compact?: boolean
  kind?: ScheduleKind
}

export function DeadlineEditor({
  entry,
  compact = false,
  kind = 'deadline'
}: DeadlineEditorProps): ReactElement {
  const setUpdateDeadline = useMastery((state) => state.setUpdateDeadline)
  const setUpdateOpportune = useMastery((state) => state.setUpdateOpportune)
  const storedDate = kind === 'deadline' ? entry.deadlineOn : entry.opportuneOn
  const label = kind === 'deadline' ? 'Deadline' : 'Opportune time'
  const [value, setValue] = useState(storedDate ? formatDeadlineDay(storedDate) : '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValue(storedDate ? formatDeadlineDay(storedDate) : '')
    setError(null)
  }, [entry.id, kind, storedDate])

  const updateDate = (dateKey?: string): void => {
    if (kind === 'deadline') {
      setUpdateDeadline(entry.nodeId, entry.id, dateKey)
    } else {
      setUpdateOpportune(entry.nodeId, entry.id, dateKey)
    }
  }

  const reset = (): void => {
    setValue(storedDate ? formatDeadlineDay(storedDate) : '')
    setError(null)
  }

  const save = (): boolean => {
    const result = parseDeadlineInput(value)
    if (!result.dateKey) {
      setError(result.error ?? `Enter a valid ${label.toLowerCase()} day.`)
      return false
    }

    updateDate(result.dateKey)
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

  const RemoveIcon = kind === 'deadline' ? DeadlineIcon : OpportunityIcon

  return (
    <div
      className={`deadline-editor deadline-editor--${kind} nowheel nodrag ${compact ? 'deadline-editor--compact' : ''}`}
    >
      <label>
        <span>{label}</span>
        <input
          value={value}
          placeholder="Type date or weekday"
          aria-label={`${label} day`}
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
      {storedDate && (
        <button
          className="deadline-editor__remove"
          type="button"
          title={`Remove ${label.toLowerCase()}`}
          aria-label={`Remove ${label.toLowerCase()}`}
          onClick={(event) => {
            event.stopPropagation()
            updateDate(undefined)
            setValue('')
            setError(null)
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <RemoveIcon crossedOut />
        </button>
      )}
      {error && <small role="alert">{error}</small>}
    </div>
  )
}
