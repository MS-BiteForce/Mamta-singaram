import { format, addDays, startOfWeek, isSameDay } from 'date-fns'
import { formatTime12 } from './AppointmentDayTimeline'



export default function AppointmentWeekView({ currentDate, appointments = [], onAppointmentClick, onSlotClick, selectedDate, canBookSlot }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = []
  for (let h = 7; h <= 20; h++) {
    let dh = h % 12; if (dh === 0) dh = 12
    const ampm = h >= 12 ? 'PM' : 'AM'
    hours.push({ h, label: `${dh}:00 ${ampm}` })
  }

  const byDay = {}
  appointments.forEach(a => {
    const key = String(a.appointment_date).split('T')[0]
    if (!byDay[key]) byDay[key] = []
    byDay[key].push(a)
  })
  Object.values(byDay).forEach(arr => arr.sort((a, b) => String(a.appointment_time || '').localeCompare(String(b.appointment_time || ''))))

  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <div className="min-w-[700px]">
        {/* Header */}
        <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b bg-slate-50">
          <div className="border-r px-2 py-3 text-xs font-medium text-slate-400" />
          {days.map(d => {
            const isToday = isSameDay(d, new Date())
            const isSelected = selectedDate && isSameDay(d, selectedDate)
            return (
              <div key={d.toISOString()} className={`border-r px-2 py-2 text-center last:border-0 ${isSelected ? 'bg-teal-50' : ''} ${isToday ? 'bg-teal-100/50' : ''}`}>
                <p className="text-xs font-medium text-slate-500">{format(d, 'EEE')}</p>
                <p className={`text-sm font-bold ${isToday ? 'text-teal-700' : 'text-slate-900'}`}>{format(d, 'd MMM')}</p>
              </div>
            )
          })}
        </div>
        {/* Time grid */}
        <div className="max-h-[55vh] overflow-y-auto">
          {hours.map(({ h, label }) => (
            <div key={h} className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-slate-100 min-h-[56px]">
              <div className="border-r bg-slate-50 px-2 py-2 text-right">
                <span className="text-xs font-medium text-slate-500">{label}</span>
              </div>
              {days.map(d => {
                const key = format(d, 'yyyy-MM-dd')
                const dayAppts = (byDay[key] || []).filter(a => {
                  if (!a.appointment_time) return h === 9
                  const hh = Number(String(a.appointment_time).slice(0, 2))
                  return hh === h
                })
                return (
                  <div key={key + h} className="border-r p-1 last:border-0">
                    <div className="space-y-1">
                      {dayAppts.map(a => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => onAppointmentClick(a)}
                          className="block w-full truncate rounded px-1.5 py-1 text-left text-xs font-medium text-white hover:opacity-90"
                          style={{ backgroundColor: a.status === 'Completed' ? '#10b981' : a.status === 'Cancelled' ? '#94a3b8' : a.status === 'No-Show' ? '#f43f5e' : '#3b82f6' }}
                          title={`${a.title || 'Appointment'} ${a.appointment_time ? formatTime12(a.appointment_time) : ''}`}
                        >
                          {a.appointment_time ? formatTime12(a.appointment_time).replace(':00 ', ' ') + ' ' : ''}{a.title || 'Appt'}
                        </button>
                      ))}
                      {(!canBookSlot || canBookSlot(d, `${String(h).padStart(2, '0')}:00`)) && (
                        <button type="button" onClick={() => onSlotClick(d, `${String(h).padStart(2, '0')}:00`)} className="flex w-full rounded border border-dashed py-1.5 text-[10px] justify-center text-slate-300 hover:border-teal-300 hover:text-teal-500 group-hover:block sm:block">
                          +
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
