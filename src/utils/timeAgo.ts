import { formatLocalDate, parseServerDateTime } from './dateTime'

export function timeAgo(time: string | Date): string {
  const pastDate = parseServerDateTime(time)
  const past = pastDate.getTime()
  if (Number.isNaN(past)) return String(time)

  const now = Date.now()
  const diff = Math.max(0, now - past)

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 30) return `${days}天前`

  return formatLocalDate(pastDate, 'zh-CN')
}
