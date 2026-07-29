import type { ReactElement } from 'react'

export function DeadlineIcon({ crossedOut = false }: { crossedOut?: boolean }): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3v3M18 3v3M4.5 8.5h15" />
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M12 11v4M12 17.3h.01" />
      {crossedOut && <path className="deadline-icon__slash" d="M3 3 21 21" />}
    </svg>
  )
}
