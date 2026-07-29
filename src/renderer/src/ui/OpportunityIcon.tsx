import type { ReactElement } from 'react'

export function OpportunityIcon({ crossedOut = false }: { crossedOut?: boolean }): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3.4 2" />
      <path d="m5.3 4.7 1.8 1.8M18.7 4.7l-1.8 1.8" />
      <path d="M12 2.5v2" />
      <path d="m17.8 16.8.8 1.8 1.9.8-1.9.8-.8 1.8-.8-1.8-1.9-.8 1.9-.8Z" />
      {crossedOut && <path className="deadline-icon__slash" d="M3 3 21 21" />}
    </svg>
  )
}
