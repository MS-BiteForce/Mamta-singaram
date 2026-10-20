import { useEffect, useState } from 'react'
import { format, addDays } from 'date-fns'
import {
  Calendar,
  Clock,
  IndianRupee,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../hooks/useToast'
import { getPatients, getSessions, getAppointments } from '../lib/api'
import { formatTime12 } from '../components/AppointmentDayTimeline'

const initialStats = {
  totalPatients: 0,
  sessionsThisMonth: 0,
  todayAppointments: 0,
  pendingPayments: 0,
  pendingAmount: 0,
}

function Dashboard() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [stats, setStats] = useState(initialStats)
  const [recentPatients, setRecentPatients] = useState([])
  const [upcomingAppointments, setUpcomingAppointments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true)

      try {
        // Local-timezone-safe date strings (toISOString() would shift in IST)
        const today = format(new Date(), 'yyyy-MM-dd')
        const next7 = format(addDays(new Date(), 7), 'yyyy-MM-dd')
        // Widen the server-side window by +1 day to absorb the UTC serialization
        // offset of pg DATE values (local midnight → T18:30:00.000Z in IST);
        // the exact 7-day cut is applied client-side via string compare, same
        // pattern as the Appointments page sidebar.
        const fetchTo = format(addDays(new Date(), 8), 'yyyy-MM-dd')
        const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')

        // 1. Total patients & recent patients — from single getPatients call
        // 2. Sessions this month — backend filter on visit_date
        // 3. Upcoming appointments — same source of truth as the Appointments page: `appointments` table
        const [allPatients, monthSessions, weekAppointmentsRes] = await Promise.all([
          getPatients(),
          getSessions({ visit_date_from: monthStart }),
          getAppointments({ date_from: today, date_to: fetchTo }),
        ])
        const totalPatients = allPatients.length
        const sessionsThisMonth = monthSessions.length
        const weekAppointments = Array.isArray(weekAppointmentsRes)
          ? weekAppointmentsRes
          : weekAppointmentsRes?.data ?? weekAppointmentsRes?.rows ?? []

        const patientMap = {}
        allPatients.forEach((p) => { patientMap[p.id] = p })

        // Normalize + sort chronologically (soonest first), same as Appointments.jsx sidebar
        const upcoming = weekAppointments
          .map((a) => ({ ...a, dateKey: String(a.appointment_date).split('T')[0], patient_name: patientMap[a.patient_id]?.full_name || '' }))
          .filter((a) => a.dateKey >= today && a.dateKey <= next7)
          .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || String(a.appointment_time || '').localeCompare(String(b.appointment_time || '')))

        const todayAppointments = upcoming.filter((a) => a.dateKey === today).length

        // 4. Pending dues — two queries merged
        const [pending, partial] = await Promise.all([
          getSessions({ payment_status: 'Pending' }),
          getSessions({ payment_status: 'Partial' }),
        ])
        const pendingSessions = [...pending, ...partial]
        const pendingAmount = pendingSessions.reduce(
          (sum, s) => sum + Number(s.treatment_cost || 0) - Number(s.amount_paid || 0),
          0,
        )

        // 5. Recent patients — sort by created_at desc, limit 5
        const recentPatients = [...allPatients]
          .sort((a, b) => toMillis(b.created_at) - toMillis(a.created_at))
          .slice(0, 5)

        setStats({
          totalPatients,
          sessionsThisMonth,
          todayAppointments,
          pendingPayments: pendingSessions.length,
          pendingAmount,
        })
        setRecentPatients(recentPatients)
        setUpcomingAppointments(upcoming)
      } catch (error) {
        showToast(error.message || 'Unable to load dashboard.', 'error')
      } finally {
        setLoading(false)
      }
    }

    Promise.resolve().then(loadDashboard)
  }, [showToast])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-2 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-2 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-normal text-slate-900">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Patients"
          value={stats.totalPatients}
          className="border-teal-100 bg-teal-50 text-teal-700"
        />
        <StatCard
          icon={TrendingUp}
          label="Sessions This Month"
          value={stats.sessionsThisMonth}
          className="border-blue-100 bg-blue-50 text-blue-700"
        />
        <StatCard
          icon={Calendar}
          label="Today's Appointments"
          value={stats.todayAppointments}
          className="border-purple-100 bg-purple-50 text-purple-700"
        />
        <StatCard
          icon={IndianRupee}
          label="Pending Dues"
          value={`₹${stats.pendingAmount.toLocaleString('en-IN')}`}
          detail={`${stats.pendingPayments} sessions`}
          className="border-red-100 bg-red-50 text-red-700"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold tracking-normal text-slate-700">
              <Clock className="h-4 w-4 text-purple-500" />
              Upcoming Appointments
            </h2>
            <span className="text-xs text-slate-400">Next 7 days</span>
          </div>

          {upcomingAppointments.length === 0 ? (
            <EmptyState icon={Calendar} message="No upcoming appointments" />
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.map((appointment) => (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={() => navigate(`/patients/${appointment.patient_id}`)}
                  className="flex w-full items-center justify-between gap-4 rounded-lg border border-slate-100 p-3 text-left transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {appointment.appointment_time
                        ? `${formatTime12(appointment.appointment_time)} — `
                        : ''}
                      {appointment.patient_name || appointment.patients?.full_name || 'Patient'}
                    </p>
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
              ))}
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
