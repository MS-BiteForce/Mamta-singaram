import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
} from 'date-fns'
import {
  Calendar,
  Check,
  ChevronDown,
  Clock,
  IndianRupee,
  TrendingUp,
  Users,
  UserX,
  XCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../hooks/useToast'
import { getPatients, getSessions, getAppointments } from '../lib/api'
import { formatTime12 } from '../components/AppointmentDayTimeline'

const initialStats = {
  totalPatients: 0,
  sessions: 0,
  todayAppointments: 0,
  pendingPayments: 0,
  pendingAmount: 0,
}

const appointmentStatusStyles = {
  Scheduled: 'bg-blue-50 text-blue-700 ring-blue-200',
  Completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
  'No-Show': 'bg-rose-50 text-rose-700 ring-rose-200',
}

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'ytd', label: 'Year to Date (YTD)' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
]

function Dashboard() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [stats, setStats] = useState(initialStats)
  const [recentPatients, setRecentPatients] = useState([])
  const [upcomingAppointments, setUpcomingAppointments] = useState([])
  const [apptMetrics, setApptMetrics] = useState({ cancelled: 0, noShow: 0, total: 0 })
  const [todayBreakdown, setTodayBreakdown] = useState({ scheduled: 0, cancelled: 0, noShow: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Date range filter
  const [filterPreset, setFilterPreset] = useState('ytd')
  const [appliedCustom, setAppliedCustom] = useState({ start: '', end: '' })
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [showCustom, setShowCustom] = useState(false)

  const loadedRef = useRef(false)

  // All presets resolve to safe YYYY-MM-DD strings (never toISOString())
  const range = useMemo(() => {
    const now = new Date()
    const key = (d) => format(d, 'yyyy-MM-dd')
    switch (filterPreset) {
      case 'today':
        return { start: key(now), end: key(now), label: 'Today' }
      case 'yesterday': {
        const yesterday = subDays(now, 1)
        return { start: key(yesterday), end: key(yesterday), label: 'Yesterday' }
      }
      case 'week':
        return {
          start: key(startOfWeek(now, { weekStartsOn: 1 })),
          end: key(endOfWeek(now, { weekStartsOn: 1 })),
          label: 'This Week',
        }
      case 'month':
        return { start: key(startOfMonth(now)), end: key(endOfMonth(now)), label: 'This Month' }
      case 'year':
        return { start: key(startOfYear(now)), end: key(endOfYear(now)), label: 'This Year' }
      case 'all':
        return { start: null, end: null, label: 'All Time' }
      case 'custom':
        return {
          start: appliedCustom.start,
          end: appliedCustom.end,
          label: `${shortDate(appliedCustom.start)} – ${shortDate(appliedCustom.end)}`,
        }
      case 'ytd':
      default:
        return { start: key(startOfYear(now)), end: key(now), label: 'Year to Date' }
    }
  }, [filterPreset, appliedCustom])

  useEffect(() => {
    let active = true

    const loadDashboard = async () => {
      if (!loadedRef.current) setLoading(true)
      else setRefreshing(true)

      try {
        const today = format(new Date(), 'yyyy-MM-dd')
        const next7 = format(addDays(new Date(), 7), 'yyyy-MM-dd')

        // Ranges are compared against DATE columns server-side (exact string
        // comparison), which avoids the pg DATE → UTC serialization offset.
        const sessionFilters = range.start
          ? { visit_date_from: range.start, visit_date_to: range.end }
          : {}
        const appointmentFilters = range.start
          ? { date_from: range.start, date_to: range.end }
          : {}

        const [
          patientsRes,
          rangeSessionsRes,
          rangeAppointmentsRes,
          todayAppointmentsRes,
          upcomingRes,
        ] = await Promise.all([
          getPatients(),
          getSessions(sessionFilters),
          getAppointments(appointmentFilters),
          getAppointments({ date_from: today, date_to: today }),
          getAppointments({ date_from: today, date_to: next7 }),
        ])

        if (!active) return

        const allPatients = asArray(patientsRes)
        const rangeSessions = asArray(rangeSessionsRes)
        const rangeAppointments = asArray(rangeAppointmentsRes)
        const todayRows = asArray(todayAppointmentsRes)
        const upcomingRows = asArray(upcomingRes)

        // Patients: created_at is a timestamp, so a local YYYY-MM-DD key is safe
        const patientsInRange = range.start
          ? allPatients.filter((p) => {
              const key = localDateKey(p.created_at)
              return key && key >= range.start && key <= range.end
            })
          : allPatients

        const pendingSessions = rangeSessions.filter(
          (s) => s.payment_status === 'Pending' || s.payment_status === 'Partial',
        )

        const patientMap = {}
        allPatients.forEach((p) => {
          patientMap[p.id] = p
        })

        // Today (inclusive) through the next 7 days — strictly chronological
        const upcoming = upcomingRows
          .map((a) => ({
            ...a,
            dateKey: toDateKey(a.appointment_date),
            patient_name: patientMap[a.patient_id]?.full_name || '',
          }))
          .filter((a) => a.dateKey && a.dateKey >= today && a.dateKey <= next7)
          .sort(
            (a, b) =>
              a.dateKey.localeCompare(b.dateKey) ||
              String(a.appointment_time || '').localeCompare(String(b.appointment_time || '')),
          )

        setStats({
          totalPatients: patientsInRange.length,
          sessions: rangeSessions.length,
          todayAppointments: todayRows.length,
          pendingPayments: pendingSessions.length,
          pendingAmount: pendingSessions.reduce(
            (sum, s) => sum + Number(s.treatment_cost || 0) - Number(s.amount_paid || 0),
            0,
          ),
        })
        setApptMetrics({
          cancelled: rangeAppointments.filter((a) => a.status === 'Cancelled').length,
          noShow: rangeAppointments.filter((a) => a.status === 'No-Show').length,
          total: rangeAppointments.length,
        })
        setTodayBreakdown({
          scheduled: todayRows.filter((a) => a.status === 'Scheduled').length,
          cancelled: todayRows.filter((a) => a.status === 'Cancelled').length,
          noShow: todayRows.filter((a) => a.status === 'No-Show').length,
        })
        setRecentPatients(
          [...allPatients]
            .sort((a, b) => toMillis(b.created_at) - toMillis(a.created_at))
            .slice(0, 5),
        )
        setUpcomingAppointments(upcoming)
        loadedRef.current = true
      } catch (error) {
        if (active) showToast(error.message || 'Unable to load dashboard.', 'error')
      } finally {
        if (active) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    loadDashboard()
    return () => {
      active = false
    }
  }, [range, showToast])

  const toggleFilter = () => {
    setFilterOpen((prev) => {
      const next = !prev
      if (next) {
        setShowCustom(filterPreset === 'custom')
        setCustomStart(appliedCustom.start)
        setCustomEnd(appliedCustom.end)
      }
      return next
    })
  }

  const selectPreset = (value) => {
    if (value === 'custom') {
      setShowCustom(true)
      return
    }
    setShowCustom(false)
    setFilterPreset(value)
    setFilterOpen(false)
  }

  const applyCustomRange = () => {
    if (!customStart || !customEnd) {
      showToast('Select both a start and end date.', 'warning')
      return
    }
    if (customStart > customEnd) {
      showToast('Start date cannot be after the end date.', 'warning')
      return
    }
    setAppliedCustom({ start: customStart, end: customEnd })
    setFilterPreset('custom')
    setShowCustom(false)
    setFilterOpen(false)
  }

  const filterSummary = range.start
    ? `Showing data for ${range.label}`
    : 'Showing data for all time'

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-72 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-slate-800">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">{filterSummary}</p>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={toggleFilter}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Calendar className="h-4 w-4 text-teal-600" />
            <span className="max-w-48 truncate">{range.label}</span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
          </button>

          {filterOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Date Range
                </p>
                <div className="max-h-64 overflow-y-auto">
                  {DATE_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => selectPreset(preset.value)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                        filterPreset === preset.value
                          ? 'bg-teal-50 font-medium text-teal-700'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {preset.label}
                      {filterPreset === preset.value && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </div>

                {showCustom && (
                  <div className="mt-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-600">Start Date</span>
                      <input
                        type="date"
                        value={customStart}
                        max={customEnd || undefined}
                        onChange={(event) => setCustomStart(event.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-600">End Date</span>
                      <input
                        type="date"
                        value={customEnd}
                        min={customStart || undefined}
                        onChange={(event) => setCustomEnd(event.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={applyCustomRange}
                        className="flex-1 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-700"
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCustom(false)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <section
        className={`mb-8 mt-4 grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${
          refreshing ? 'opacity-60' : ''
        }`}
      >
        <StatCard
          icon={Users}
          label="Total Patients"
          value={stats.totalPatients}
          detail={range.label}
          className="border-teal-100 bg-teal-50 text-teal-700"
        />
        <StatCard
          icon={TrendingUp}
          label="Sessions"
          value={stats.sessions}
          detail={range.label}
          className="border-blue-100 bg-blue-50 text-blue-700"
        />
        <StatCard
          icon={Calendar}
          label="Today's Appointments"
          value={stats.todayAppointments}
          detail={`${todayBreakdown.scheduled} Scheduled · ${todayBreakdown.cancelled} Cancelled · ${todayBreakdown.noShow} No-Show`}
          className="border-purple-100 bg-purple-50 text-purple-700"
        />
        <StatCard
          icon={IndianRupee}
          label="Pending Dues"
          value={`₹${stats.pendingAmount.toLocaleString('en-IN')}`}
          detail={`${stats.pendingPayments} sessions`}
          className="border-red-100 bg-red-50 text-red-700"
        />
        <StatCard
          icon={XCircle}
          label="Cancellations"
          value={apptMetrics.cancelled}
          detail={`${apptMetrics.total} appointments in range`}
          className="border-rose-100 bg-rose-50 text-rose-700"
        />
        <StatCard
          icon={UserX}
          label="No-Shows"
          value={apptMetrics.noShow}
          detail={`${apptMetrics.total} appointments in range`}
          className="border-amber-100 bg-amber-50 text-amber-700"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold tracking-normal text-slate-700">
              <Clock className="h-4 w-4 text-purple-500" />
              Upcoming Appointments
            </h2>
            <button
              type="button"
              onClick={() => navigate('/appointments')}
              className="text-xs font-medium text-teal-600 hover:underline"
            >
              View all
            </button>
          </div>

          {upcomingAppointments.length === 0 ? (
            <EmptyState icon={Clock} message="No upcoming appointments in the next 7 days" />
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.map((appointment) => {
                const status = appointment.status || 'Scheduled'
                const isInactive = status === 'Cancelled' || status === 'No-Show'
                return (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => navigate(`/patients/${appointment.patient_id}`)}
                    className={`flex w-full items-center justify-between gap-4 rounded-lg border border-slate-100 p-3 text-left transition hover:bg-slate-50 ${
                      isInactive ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`truncate text-sm font-medium ${
                            isInactive ? 'text-slate-500 line-through' : 'text-slate-800'
                          }`}
                        >
                          {appointment.appointment_time
                            ? `${formatTime12(appointment.appointment_time)} — `
                            : ''}
                          {appointment.patient_name || appointment.patients?.full_name || 'Patient'}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                            appointmentStatusStyles[status] || 'bg-slate-100 text-slate-600 ring-slate-200'
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {appointment.title || appointment.chief_complaint || '-'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-purple-600">
                        {format(new Date(`${appointment.dateKey}T00:00:00`), 'EEE, dd MMM')}
                      </p>
                      <p className="text-xs text-slate-400">
                        {appointment.location_name || appointment.patients?.phone || '-'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold tracking-normal text-slate-700">
              <Users className="h-4 w-4 text-teal-500" />
              Recent Patients
            </h2>
            <button
              type="button"
              onClick={() => navigate('/patients')}
              className="text-xs font-medium text-teal-600 hover:underline"
            >
              View all
            </button>
          </div>

          {recentPatients.length === 0 ? (
            <EmptyState icon={Users} message="No patients yet" />
          ) : (
            <div className="space-y-3">
              {recentPatients.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => navigate(`/patients/${patient.id}`)}
                  className="flex w-full items-center justify-between gap-4 rounded-lg border border-slate-100 p-3 text-left transition hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
                      {patient.full_name?.charAt(0).toUpperCase() || 'P'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {patient.full_name}
                      </p>
                      <p className="text-xs text-slate-400">{patient.phone || '-'}</p>
                    </div>
                  </div>
                  <p className="shrink-0 text-xs text-slate-400">
                    {formatDate(patient.created_at)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function StatCard({ icon: Icon, label, value, detail, className }) {
  return (
    <div className={`rounded-xl border p-4 ${className}`}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-3xl font-bold tracking-normal">{value}</p>
      {detail && <p className="mt-1 text-xs opacity-70">{detail}</p>}
    </div>
  )
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="py-8 text-center">
      <Icon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}

function asArray(value) {
  if (Array.isArray(value)) return value
  return value?.data ?? value?.rows ?? []
}

// pg returns DATE columns as local midnight; JSON then serializes them in UTC,
// which lands on the previous day for timezones ahead of UTC (e.g. IST).
// Roll the date forward when the serialized UTC time is in the afternoon.
function toDateKey(dateValue) {
  if (!dateValue) return ''
  const raw = String(dateValue)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw.slice(0, 10)
  const isoDay = d.toISOString().slice(0, 10)
  if (d.getUTCHours() >= 12) {
    const rolled = new Date(`${isoDay}T00:00:00Z`)
    rolled.setUTCDate(rolled.getUTCDate() + 1)
    return rolled.toISOString().slice(0, 10)
  }
  return isoDay
}

function localDateKey(dateValue) {
  const d = toDate(dateValue)
  return d ? format(d, 'yyyy-MM-dd') : ''
}

function shortDate(dateString) {
  if (!dateString) return '—'
  const d = new Date(`${dateString}T00:00:00`)
  return isNaN(d.getTime()) ? dateString : format(d, 'dd MMM yyyy')
}

function formatDate(dateValue) {
  const d = toDate(dateValue)
  if (!d) return '—'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function toDate(dateValue) {
  if (!dateValue) return null
  const d = new Date(dateValue)
  return isNaN(d.getTime()) ? null : d
}

function toMillis(dateValue) {
  const d = toDate(dateValue)
  return d ? d.getTime() : -Infinity
}

export default Dashboard
