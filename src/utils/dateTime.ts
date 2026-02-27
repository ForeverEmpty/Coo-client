const NO_TZ_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function resolveServerOffsetMinutes(): number | null {
  const raw = import.meta.env.VITE_SERVER_TZ_OFFSET_MINUTES
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return null
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function padMs(msRaw?: string) {
  if (!msRaw) return 0
  if (msRaw.length === 1) return Number(msRaw) * 100
  if (msRaw.length === 2) return Number(msRaw) * 10
  return Number(msRaw.slice(0, 3))
}

export function parseServerDateTime(input: string | Date): Date {
  if (input instanceof Date) return input

  const raw = String(input).trim()
  if (!raw) return new Date(NaN)

  // Already contains timezone info: let runtime parse directly.
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(raw)) {
    return new Date(raw)
  }

  const match = raw.match(NO_TZ_DATETIME_RE)
  if (match) {
    const [, year, month, day, hour, minute, second = '0', msRaw] = match
    const y = Number(year)
    const mon = Number(month) - 1
    const d = Number(day)
    const h = Number(hour)
    const min = Number(minute)
    const sec = Number(second)
    const ms = padMs(msRaw)

    const serverOffsetMinutes = resolveServerOffsetMinutes()

    // Default: no server offset config -> interpret as local datetime (no forced conversion).
    if (serverOffsetMinutes === null) {
      return new Date(y, mon, d, h, min, sec, ms)
    }

    const utcMs =
      Date.UTC(
        y,
        mon,
        d,
        h,
        min,
        sec,
        ms,
      ) -
      serverOffsetMinutes * 60 * 1000

    return new Date(utcMs)
  }

  return new Date(raw)
}

export function parseLocalDate(input: string | Date): Date {
  if (input instanceof Date) return input

  const raw = String(input).trim()
  if (!raw) return new Date(NaN)

  const match = raw.match(DATE_ONLY_RE)
  if (match) {
    const [, year, month, day] = match
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  return parseServerDateTime(raw)
}

export function formatLocalDateTime(input: string | Date, locale = 'zh-CN') {
  const date = parseServerDateTime(input)
  if (Number.isNaN(date.getTime())) return String(input)
  return date.toLocaleString(locale)
}

export function formatLocalDate(input: string | Date, locale = 'zh-CN') {
  const date = parseServerDateTime(input)
  if (Number.isNaN(date.getTime())) return String(input)
  return date.toLocaleDateString(locale)
}
