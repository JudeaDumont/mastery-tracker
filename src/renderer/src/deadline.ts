export interface DeadlineParseResult {
  dateKey?: string
  error?: string
}

const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const WEEKDAYS = new Map([
  ['sun', 0], ['sunday', 0],
  ['mon', 1], ['monday', 1],
  ['tue', 2], ['tues', 2], ['tuesday', 2],
  ['wed', 3], ['weds', 3], ['wednesday', 3],
  ['thu', 4], ['thur', 4], ['thurs', 4], ['thursday', 4],
  ['fri', 5], ['friday', 5],
  ['sat', 6], ['saturday', 6]
])

const MONTHS = new Map([
  ['jan', 1], ['january', 1],
  ['feb', 2], ['february', 2],
  ['mar', 3], ['march', 3],
  ['apr', 4], ['april', 4],
  ['may', 5],
  ['jun', 6], ['june', 6],
  ['jul', 7], ['july', 7],
  ['aug', 8], ['august', 8],
  ['sep', 9], ['sept', 9], ['september', 9],
  ['oct', 10], ['october', 10],
  ['nov', 11], ['november', 11],
  ['dec', 12], ['december', 12]
])

export function parseDeadlineInput(input: string, now = new Date()): DeadlineParseResult {
  const value = input.trim()
  if (!value) return { error: 'Enter a date.' }

  const normalized = value.toLowerCase().replace(/\s+/g, ' ')
  const today = startOfLocalDay(now)

  if (normalized === 'today') return { dateKey: localDateKey(today) }
  if (normalized === 'tomorrow') return { dateKey: localDateKey(addLocalDays(today, 1)) }

  const weekdayMatch = normalized.match(/^(?:next\s+)?([a-z]+)$/)
  if (weekdayMatch) {
    const weekday = WEEKDAYS.get(weekdayMatch[1])
    if (weekday !== undefined) {
      return { dateKey: localDateKey(nextLocalWeekday(today, weekday)) }
    }
  }

  const relativeMatch = normalized.match(/^(?:in\s+)?(\d+)\s*(?:d|day|days)$/)
  if (relativeMatch) {
    const days = Number(relativeMatch[1])
    if (!Number.isSafeInteger(days) || days < 0 || days > 365000) {
      return { error: 'That relative date is too large.' }
    }
    return { dateKey: localDateKey(addLocalDays(today, days)) }
  }

  const compact = normalized.replace(/\s/g, '')
  if (/^\d{8}$/.test(compact)) {
    const leadingYear = Number(compact.slice(0, 4))
    if (leadingYear >= 1000) {
      return explicitDateResult(
        leadingYear,
        Number(compact.slice(4, 6)),
        Number(compact.slice(6, 8))
      )
    }

    return explicitDateResult(
      Number(compact.slice(4, 8)),
      Number(compact.slice(0, 2)),
      Number(compact.slice(2, 4))
    )
  }

  if (/^\d{4}$/.test(compact)) {
    return yearlessDateResult(Number(compact.slice(0, 2)), Number(compact.slice(2, 4)), today)
  }

  const monthNameFirst = normalized.match(
    /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/
  )
  if (monthNameFirst) {
    const month = MONTHS.get(monthNameFirst[1])
    if (!month) return { error: 'That month name is not recognized.' }
    const day = Number(monthNameFirst[2])
    return monthNameFirst[3]
      ? explicitDateResult(Number(monthNameFirst[3]), month, day)
      : yearlessDateResult(month, day, today)
  }

  const dayFirstMonthName = normalized.match(
    /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:,?\s+(\d{4}))?$/
  )
  if (dayFirstMonthName) {
    const month = MONTHS.get(dayFirstMonthName[2])
    if (!month) return { error: 'That month name is not recognized.' }
    const day = Number(dayFirstMonthName[1])
    return dayFirstMonthName[3]
      ? explicitDateResult(Number(dayFirstMonthName[3]), month, day)
      : yearlessDateResult(month, day, today)
  }

  const slashParts = normalized.split(/[\/-]/).map((part) => part.trim())
  if (slashParts.length === 2 && slashParts.every((part) => /^\d{1,2}$/.test(part))) {
    return yearlessDateResult(Number(slashParts[0]), Number(slashParts[1]), today)
  }

  if (
    slashParts.length === 3 &&
    slashParts.every((part) => /^\d{1,4}$/.test(part))
  ) {
    if (slashParts[0].length === 4) {
      return explicitDateResult(
        Number(slashParts[0]),
        Number(slashParts[1]),
        Number(slashParts[2])
      )
    }

    const rawYear = Number(slashParts[2])
    const year = slashParts[2].length === 2 ? 2000 + rawYear : rawYear
    return explicitDateResult(year, Number(slashParts[0]), Number(slashParts[1]))
  }

  if (!/[\d]/.test(normalized)) {
    return { error: 'Enter a date or weekday, such as 08/13, 13 days, or Thursday.' }
  }

  const parsed = new Date(`${value} 12:00:00`)
  if (Number.isFinite(parsed.getTime())) {
    return { dateKey: localDateKey(parsed) }
  }

  return {
    error: 'Could not interpret that day. Try 08/13, 1231, 13 days, or Thursday.'
  }
}

export function normalizeDeadlineDay(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const candidate = value.trim().slice(0, 10)
  const match = candidate.match(ISO_DAY_PATTERN)
  if (!match) return undefined

  const result = explicitDateResult(Number(match[1]), Number(match[2]), Number(match[3]))
  return result.dateKey
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateFromDeadlineDay(value: string): Date {
  const normalized = normalizeDeadlineDay(value)
  if (!normalized) return new Date(Number.NaN)
  const [year, month, day] = normalized.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatDeadlineDay(value: string): string {
  const date = dateFromDeadlineDay(value)
  if (!Number.isFinite(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  })
}

export function formatDeadlineLong(value: string): string {
  const date = dateFromDeadlineDay(value)
  if (!Number.isFinite(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

export function deadlineStatus(value: string, now = new Date()): 'overdue' | 'today' | 'upcoming' {
  const todayKey = localDateKey(startOfLocalDay(now))
  if (value < todayKey) return 'overdue'
  if (value === todayKey) return 'today'
  return 'upcoming'
}

function yearlessDateResult(month: number, day: number, today: Date): DeadlineParseResult {
  let year = today.getFullYear()
  let candidate = createValidatedLocalDate(year, month, day)
  if (!candidate) return { error: 'That month and day are not valid.' }

  if (candidate.getTime() < today.getTime()) {
    year += 1
    candidate = createValidatedLocalDate(year, month, day)
  }

  return candidate
    ? { dateKey: localDateKey(candidate) }
    : { error: 'That month and day are not valid.' }
}

function explicitDateResult(year: number, month: number, day: number): DeadlineParseResult {
  if (year < 1 || year > 9999) return { error: 'Enter a four-digit year.' }
  const date = createValidatedLocalDate(year, month, day)
  return date
    ? { dateKey: localDateKey(date) }
    : { error: 'That calendar day is not valid.' }
}

function createValidatedLocalDate(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function nextLocalWeekday(date: Date, weekday: number): Date {
  const daysUntil = (weekday - date.getDay() + 7) % 7 || 7
  return addLocalDays(date, daysUntil)
}
