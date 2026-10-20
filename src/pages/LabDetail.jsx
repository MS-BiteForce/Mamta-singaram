import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FlaskConical, Search, Users, Package, CheckCircle, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { getLabDetail, markLabOrderPaid } from '../lib/api'
import { useToast } from '../hooks/useToast'

function formatMoney(v) { return Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }) }
function formatDate(d) {
  if (!d) return '-'
  try { return format(new Date(d), 'dd MMM yyyy') } catch { return String(d).slice(0, 10) }
}

const statusColor = {
  Ordered: 'bg-amber-50 text-amber-700 ring-amber-200',
  Received: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Cancelled: 'bg-slate-100 text-slate-500 ring-slate-200',
}

export default function LabDetail() {
  const { labId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      const filters = {}
      if (statusFilter !== 'All') filters.status = statusFilter
      if (dateFrom) filters.from = dateFrom
      if (dateTo) filters.to = dateTo
      if (search.trim()) filters.patient_search = search.trim()
      const res = await getLabDetail(labId, filters)
      setData(res)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { load() }, [labId, statusFilter])

  const handleSearch = (e) => {
    e.preventDefault()
    load()
  }

  const [payingId, setPayingId] = useState('')
  const markOrderPaid = async (o) => {
    const name = o.patient_name || 'this patient'
    if (!window.confirm(`Mark "${o.test_name}" for ${name} as fully paid (₹${formatMoney(o.cost)})?`)) return
    setPayingId(o.id)
    try {
      await markLabOrderPaid(o.id)
      showToast('Lab order marked as paid', 'success')
      await load()
    } catch (e) { showToast(e.message, 'error') } finally { setPayingId('') }
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading lab...</div>
  if (error) return <div className="flex h-64 items-center justify-center text-red-500">{error}</div>
  if (!data) return null

  const { lab, summary, orders } = data

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <button type="button" onClick={() => navigate('/labs')} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <ArrowLeft className="h-4 w-4" /> Back to Labs
      </button>

      {/* Lab info */}
      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-teal-600" />
              {lab.name}
            </h1>
            <span className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${lab.is_active === false ? 'bg-slate-100 text-slate-500 ring-slate-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}`}>
              {lab.is_active === false ? 'Inactive' : 'Active'}
            </span>
          </div>
        </div>

        {/* Financial summary */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase text-slate-500">Patients</p>
            <p className="mt-1 flex items-center gap-1 text-lg font-bold text-slate-900"><Users className="h-4 w-4" /> {summary.patient_count}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase text-slate-500">Orders</p>
            <p className="mt-1 flex items-center gap-1 text-lg font-bold text-slate-900"><Package className="h-4 w-4" /> {summary.order_count}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase text-slate-500">Total Spent</p>
            <p className="mt-1 text-lg font-bold text-slate-900">₹{formatMoney(summary.total_cost)}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3">
            <p className="text-xs font-medium uppercase text-emerald-700">Total Paid</p>
            <p className="mt-1 text-lg font-bold text-emerald-700">₹{formatMoney(summary.total_paid)}</p>
          </div>
          <div className="rounded-lg bg-rose-50 p-3">
            <p className="text-xs font-medium uppercase text-rose-700">Outstanding</p>
            <p className="mt-1 text-lg font-bold text-rose-700">₹{formatMoney(summary.total_outstanding)}</p>
          </div>
          <div className="rounded-lg bg-sky-50 p-3">
            <p className="text-xs font-medium uppercase text-sky-700">This Month</p>
            <p className="mt-1 text-lg font-bold text-sky-700">₹{formatMoney(summary.month_cost)}</p>
            <p className="text-xs text-sky-600">Paid ₹{formatMoney(summary.month_paid)} · Owed ₹{formatMoney(summary.month_outstanding)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-white p-4">
        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Search Patient</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, phone..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="All">All</option>
              <option value="Ordered">Ordered</option>
              <option value="Received">Received</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">Filter</button>
          {(search || dateFrom || dateTo || statusFilter !== 'All') && (
            <button type="button" onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setStatusFilter('All') }} className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Clear</button>
          )}
        </form>
      </div>

      {/* Orders */}
      <div className="rounded-xl border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold text-slate-900">Orders / Products ({orders.length})</h2>
        </div>
        {orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No orders found for this lab.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Order Date</th>
                  <th className="px-4 py-3">Required</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => navigate(`/patients/${o.patient_id}`)} className="text-teal-600 hover:underline font-medium">
                        {o.patient_name || o.patient_id.slice(0, 8)}
                      </button>
                      <p className="text-xs text-slate-400">{o.patient_code || ''}</p>
                    </td>
                    <td className="px-4 py-3 font-medium">{o.test_name}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(o.entry_date)}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(o.required_date)}</td>
                    <td className="px-4 py-3 text-right">₹{formatMoney(o.cost)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">₹{formatMoney(o.amount_paid)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${o.outstanding > 0 ? 'text-rose-600' : 'text-slate-400'}`}>₹{formatMoney(o.outstanding)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${statusColor[o.status] || 'bg-slate-50 text-slate-600'}`}>{o.status || 'Ordered'}</span>
                    </td>
                    <td className="max-w-[150px] truncate px-4 py-3 text-xs text-slate-500">{o.notes || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      {Number(o.outstanding) > 0 && (
                        <button
                          type="button"
                          onClick={() => markOrderPaid(o)}
                          disabled={payingId === o.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {payingId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                          Mark as Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
