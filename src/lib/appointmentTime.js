// Date/time helpers for booking guards
export function dateAtStartOfDay(dateString) {
  if (!dateString) return null
  const s = String(dateString)
  const d = new Date(s.length === 10 ? s + 'T00:00:00' : s)
  d.setHours(0, 0, 0, 0)
  return d
}

// True when the given date (yyyy-MM-dd or Date) is strictly before today
export function isPastDate(dateString) {
  const d = dateAtStartOfDay(dateString)
  if (!d) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}

// True when the slot (yyyy-MM-dd + HH:mm) has already passed:
// - any past date
// - today, times earlier than the current minute
export function isPastTimeSlot(dateString, timeString) {
  if (isPastDate(dateString)) return true
  const d = dateAtStartOfDay(dateString)
  if (!d) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (d.getTime() > today.getTime()) return false
  const [h, m] = String(timeString || '').slice(0, 5).split(':').map(Number)
  if (Number.isNaN(h)) return false
  const now = new Date()
  const slotMinutes = h * 60 + (m || 0)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return slotMinutes < nowMinutes
}
