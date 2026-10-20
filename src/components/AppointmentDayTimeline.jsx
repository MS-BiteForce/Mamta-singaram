import { format } from 'date-fns'

const statusBadge = {
  Scheduled: 'bg-blue-50 text-blue-700 ring-blue-200 border-blue-200',
  Completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200 border-emerald-200',
  Cancelled: 'bg-slate-100 text-slate-600 ring-slate-200 border-slate-200',
  'No-Show': 'bg-rose-50 text-rose-700 ring-rose-200 border-rose-200',
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatTime12(t) {
  if (!t) return '-'
  const s = String(t).slice(0, 5)
  const [hStr, mStr] = s.split(':')
  let h = Number(hStr)
  const m = mStr || '00'
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${m} ${ampm}`
}

function timeToMinutes(t) {
  if (!t) return 9999
  const [h, m] = String(t).slice(0, 5).split(':').map(Number)
  return h * 60 + (m || 0)
}

export default function AppointmentDayTimeline({ date, appointments = [], onAppointmentClick, onSlotClick, canBookSlot }) {
  const hours = []
  for (let h = 0; h < 24; h++) {
    const ampm = h >= 12 ? 'PM' : 'AM'
    let dh = h % 12
    if (dh === 0) dh = 12
    hours.push({ h, label: `${dh}:00 ${ampm}` })
  }
  // Filter to business hours 6am-10pm for display, but keep all for completeness
  const displayHours = hours.slice(6, 22) // 6:00 AM - 9:00 PM

  const sorted = [...appointments].sort((a, b) => timeToMinutes(a.appointment_time) - timeToMinutes(b.appointment_time))

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{format(date, 'EEEE, dd MMM yyyy')}</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-2 text-xs font-medium text-slate-700">{sorted.length} appts</span>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {displayHours.map(({ h, label }) => {
          const slotAppts = sorted.filter(a => {
            const mins = timeToMinutes(a.appointment_time)
            return Math.floor(mins / 60) === h
          })
          const appts = h === 9 ? [...slotAppts, ...sorted.filter(a => !a.appointment_time)] : slotAppts
          return (
            <div key={h} className="flex border-b border-slate-100 last:border-0 min-h-[48px]">
              <div className="w-24 shrink-0 border-r bg-slate-50 px-3 py-2 text-right">
                <span className="text-xs font-medium text-slate-500">{label}</span>
              </div>
              <div className="flex-1 p-2">
                <div className="space-y-1">
                  {appts.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onAppointmentClick && onAppointmentClick(a)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:shadow-sm transition ${statusBadge[a.status] || 'bg-white ring-slate-200'}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{a.title || 'Appointment'}</p>
                        <p className="text-xs text-slate-600 truncate">{a.patient_name || a.patient_id?.slice(0, 8) || ''} {a.location_name ? `· ${a.location_name}` : ''}</p>
                      </div>
                      <span className="shrink-0 text-xs font-medium">{a.appointment_time ? formatTime12(a.appointment_time) : 'No time'}</span>
                    </button>
                  ))}
                  {(!canBookSlot || canBookSlot(date, `${String(h).padStart(2, '0')}:00`)) && (
                    <button
                      type="button"
                      onClick={() => onSlotClick && onSlotClick(date, `${String(h).padStart(2, '0')}:00`)}
                      className="w-full rounded border border-dashed border-slate-200 py-2 text-xs text-slate-400 hover:border-teal-300 hover:text-teal-600"
                    >
                      + Book {label}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {/* Untimed appointments section if any outside display hours */}
        {sorted.some(a => { const m = timeToMinutes(a.appointment_time); return m < 6 * 60 || m >= 22 * 60 }) && (
          <div className="border-t bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-700">Outside business hours</p>
            <div className="mt-2 space-y-1">
              {sorted.filter(a => { const m = timeToMinutes(a.appointment_time); return m < 6 * 60 || m >= 22 * 60 }).map(a => (
                <button key={a.id} type="button" onClick={() => onAppointmentClick(a)} className="w-full rounded-lg border bg-white px-3 py-2 text-left text-sm">
                  {formatTime12(a.appointment_time)} — {a.title || 'Appointment'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
