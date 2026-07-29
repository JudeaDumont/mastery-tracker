import type { ReactElement } from 'react'
import { DeadlineIcon } from './DeadlineIcon'
import { OpportunityIcon } from './OpportunityIcon'

interface ScheduleIconProps {
  deadlineActive?: boolean
  opportuneActive?: boolean
  opportuneToday?: boolean
}

export function ScheduleIcon({
  deadlineActive = true,
  opportuneActive = true,
  opportuneToday = false
}: ScheduleIconProps): ReactElement {
  const classes = [
    'schedule-combo-icon',
    deadlineActive ? 'schedule-combo-icon--deadline-active' : '',
    opportuneActive ? 'schedule-combo-icon--opportune-active' : '',
    opportuneToday ? 'schedule-combo-icon--opportune-today' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes} aria-hidden="true">
      <span className="schedule-combo-icon__opportune">
        <OpportunityIcon />
      </span>
      <span className="schedule-combo-icon__deadline">
        <DeadlineIcon />
      </span>
    </span>
  )
}
