import { useMemo } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { isPastDate } from '../lib/appointmentTime'

const statusColor = {
  Scheduled: 'bg-blue-500',
  Completed: 'bg-emerald-500',
  Cancelled: 'bg-slate-400',
  'No-Show': 'bg-rose-500',
}

export default function AppointmentCalendar({ appointments = [], currentMonth, onMonthChange, onSelectDate, selectedDate, onAppointmentClick }) {
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const days = useMemo(() => {
    const arr = []
    let d = gridStart
    while (d <= gridEnd) {
      arr.push(new Date(d))
      d = addDays(d, 1)
    }
    return arr
  }, [gridStart, gridEnd])

  const byDate = useMemo(() => {
    const map = {}
    appointments.forEach(a => {
      const key = String(a.appointment_date).split('T')[0]
      if (!map[key]) map[key] = []
      map[key].push(a)
    })
    return map
  }, [appointments])

  const weekDays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{format(currentMonth, 'MMMM yyyy')}</h3>
        <div className="flex gap-1">
          <button type="button" onClick={() => onMonthChange(subMonths(currentMonth,1))} className="rounded-md p-2 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => onMonthChange(new Date())} className="rounded-md px-3 py-1 text-xs font-medium hover:bg-slate-100">Today</button>
          <button type="button" onClick={() => onMonthChange(addMonths(currentMonth,1))} className="rounded-md p-2 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
        {weekDays.map(w => <div key={w} className="py-2">{w}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd')
          const dayApps = byDate[key] || []
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isSelected = selectedDate && isSameDay(day, selectedDate)
          const isToday = isSameDay(day, new Date())
          const dayKey = format(day, 'yyyy-MM-dd')
          const isDisabled = isPastDate(dayKey)
          return (
            <button
              key={key}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectDate(new Date(day))}
              className={`relative flex min-h-[72px] flex-col rounded-lg border p-1.5 text-left transition ${isSelected ? 'border-teal-500 bg-teal-50' : 'border-slate-100 bg-white hover:bg-slate-50'} ${!isCurrentMonth ? 'opacity-40' : ''} ${isToday ? 'ring-1 ring-teal-300' : ''} ${isDisabled ? 'cursor-not-allowed opacity-50 hover:bg-white' : ''}`}
            >
              <span className={`text-xs font-medium ${isSelected ? 'text-teal-700' : 'text-slate-700'}`}>{format(day,'d')}</span>
              <div className="mt-1 space-y-1">
                {dayApps.slice(0,3).map(a => (
                  <span
                    key={a.id}
                    onClick={(e)=>{ e.stopPropagation(); onAppointmentClick && onAppointmentClick(a)}}
                    className={`block truncate rounded px-1.5 py-1 text-[10px] font-medium text-white ${statusColor[a.status]||'bg-slate-500'}`}
                    title={`${a.title||''} ${a.appointment_time||''} ${a.status}`}
                  >
                    {a.appointment_time ? `${(() => { const [h,m]=String(a.appointment_time).slice(0,5).split(':'); let hr=Number(h)%12; if(hr===0) hr=12; return `${hr}:${m} ${Number(h)>=12?'PM':'AM'}` })()} ` : ''}{a.title || 'Appt'}
                  </span>
                ))}
                {dayApps.length>3 && <span className="text-[10px] text-slate-500">+{dayApps.length-3} more</span>}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500"/> Scheduled</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500"/> Completed</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400"/> Cancelled</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500"/> No-Show</span>
      </div>
    </div>
  )
}
