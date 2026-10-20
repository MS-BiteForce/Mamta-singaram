import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, Search, Users, Package, AlertCircle, Plus, CheckCircle, Loader2 } from 'lucide-react'
import { getLabSummary, getLabOrders, createLabVendor, updateLabVendor, getPatients, getSessions, createLabOrder, markLabOrderPaid } from '../lib/api'
import { useToast } from '../hooks/useToast'

function formatMoney(v) {
  return Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export default function Labs() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [labs, setLabs] = useState([])
  const [orders, setOrders] = useState([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [showAddLab, setShowAddLab] = useState(false)
  const [newLabName, setNewLabName] = useState('')
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [orderForm, setOrderForm] = useState({ patient_id:'', session_id:'', lab_vendor_id:'', test_name:'', cost:'', amount_paid:'', entry_date:'', required_date:'', status:'Ordered', notes:'' })
  const [patientSearch, setPatientSearch] = useState('')
  const [patients, setPatients] = useState([])
  const [sessions, setSessions] = useState([])
  const [orderFilter, setOrderFilter] = useState({ status:'', from:'', to:'', patient_search:'' })

  const loadLabs = async ()=>{
    const data = await getLabSummary()
    const arr = Array.isArray(data) ? data : data?.data ?? []
    setLabs(arr)
  }
  const loadOrders = async ()=>{
    const data = await getLabOrders({ limit: 50, ...orderFilter })
    const rows = data?.rows || (Array.isArray(data)?data:[])
    setOrders(rows)
    setOrdersTotal(data?.total || rows.length)
  }

  const [payingId, setPayingId] = useState('')
  const markOrderPaid = async (o) => {
    const name = o.patient_name || 'this patient'
    if (!window.confirm(`Mark "${o.test_name}" for ${name} as fully paid (₹${formatMoney(o.cost)})?`)) return
    setPayingId(o.id)
    try {
      await markLabOrderPaid(o.id)
      showToast('Lab order marked as paid', 'success')
      await Promise.all([loadLabs(), loadOrders()])
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setPayingId('')
    }
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        await Promise.all([loadLabs(), loadOrders()])
      } catch (e) {
        setError(e.message)
      } finally { setLoading(false) }
    }
    load()
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(()=>{ loadOrders() }, [orderFilter])
  useEffect(()=>{
    getPatients().then(d=> setPatients(Array.isArray(d)?d: d?.data??[])).catch(()=>{})
  },[])
  useEffect(()=>{
    if(!orderForm.patient_id) { setSessions([]); return }
    getSessions({patient_id: orderForm.patient_id}).then(d=>{
      const arr=Array.isArray(d)?d: d?.data??[]
      setSessions(arr)
    }).catch(()=> setSessions([]))
  },[orderForm.patient_id])

  const filtered = search
    ? labs.filter(l => l.lab_vendor_name.toLowerCase().includes(search.toLowerCase()))
    : labs

  const filteredPatients = patientSearch ? patients.filter(p=> p.full_name.toLowerCase().includes(patientSearch.toLowerCase()) || String(p.phone||'').includes(patientSearch) ).slice(0,20) : patients.slice(0,20)

  const handleCreateLab = async (e)=>{
    e.preventDefault()
    if(!newLabName.trim()) return showToast('Lab name required','warning')
    try{
      await createLabVendor({ name: newLabName.trim() })
      showToast('Lab created','success')
      setNewLabName(''); setShowAddLab(false)
      await loadLabs()
    }catch(err){ showToast(err.message,'error') }
  }

  const toggleLabActive = async (lab)=>{
    try{
      await updateLabVendor(lab.lab_vendor_id, { is_active: lab.is_active===false ? true : false })
      showToast(lab.is_active===false ? 'Lab activated':'Lab deactivated','success')
      await loadLabs()
    }catch(err){ showToast(err.message,'error')}
  }

  const handleCreateOrder = async (e)=>{
    e.preventDefault()
    if(!orderForm.patient_id) return showToast('Patient required','warning')
    if(!orderForm.test_name.trim()) return showToast('Product required','warning')
    if(orderForm.cost!=='' && Number(orderForm.cost)<0) return showToast('Cost invalid','warning')
    if(Number(orderForm.amount_paid||0) > Number(orderForm.cost||0)) return showToast('Paid cannot exceed cost','warning')
    try{
      await createLabOrder({
        patient_id: orderForm.patient_id,
        session_id: orderForm.session_id || null,
        lab_vendor_id: orderForm.lab_vendor_id || null,
        test_name: orderForm.test_name.trim(),
        cost: orderForm.cost==='' ? 0 : Number(orderForm.cost),
        amount_paid: orderForm.amount_paid==='' ? 0 : Number(orderForm.amount_paid),
        entry_date: orderForm.entry_date || null,
        required_date: orderForm.required_date || null,
        status: orderForm.status,
        notes: orderForm.notes.trim() || null,
      })
      showToast('Lab order created','success')
      setShowAddOrder(false)
      setOrderForm({ patient_id:'', session_id:'', lab_vendor_id:'', test_name:'', cost:'', amount_paid:'', entry_date:'', required_date:'', status:'Ordered', notes:''})
      setPatientSearch('')
      await Promise.all([loadLabs(), loadOrders()])
    }catch(err){ showToast(err.message,'error')}
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-400">Loading labs...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <AlertCircle className="h-6 w-6 text-red-400" />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-teal-600" />
            Lab Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">Aggregate view across all patients and sessions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={()=>setShowAddLab(true)} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"><Plus className="h-4 w-4"/> Add Lab</button>
          <button type="button" onClick={()=>setShowAddOrder(true)} className="inline-flex items-center gap-1 rounded-lg border border-teal-600 bg-white px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"><Plus className="h-4 w-4"/> Add Lab Order</button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search labs..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Total Labs</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{labs.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Total Orders</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{labs.reduce((s, l) => s + l.order_count, 0)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Total Spent</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">₹{formatMoney(labs.reduce((s, l) => s + l.total_cost, 0))}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs font-medium uppercase text-slate-500">Outstanding</p>
          <p className="mt-1 text-2xl font-bold text-rose-600">₹{formatMoney(labs.reduce((s, l) => s + l.total_outstanding, 0))}</p>
        </div>
      </div>

      {/* Lab list - table on desktop, cards on mobile */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-12 text-center">
          <FlaskConical className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-600">No labs found</p>
          <p className="mt-1 text-xs text-slate-400">Click + Add Lab to create a laboratory.</p>
          <button type="button" onClick={()=>setShowAddLab(true)} className="mt-3 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white">+ Add Lab</button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border bg-white sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Lab Name</th>
                    <th className="px-4 py-3 font-semibold text-center"><span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> Patients</span></th>
                    <th className="px-4 py-3 font-semibold text-center"><span className="inline-flex items-center gap-1"><Package className="h-3 w-3" /> Orders</span></th>
                    <th className="px-4 py-3 font-semibold text-right">This Month</th>
                    <th className="px-4 py-3 font-semibold text-right">Total Spent</th>
                    <th className="px-4 py-3 font-semibold text-right">Paid</th>
                    <th className="px-4 py-3 font-semibold text-right">Outstanding</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(lab => (
                    <tr
                      key={lab.lab_key}
                      className="hover:bg-teal-50/50 transition"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 cursor-pointer" onClick={() => navigate(`/labs/${lab.lab_vendor_id || 'unassigned'}`)}>{lab.lab_vendor_name}</td>
                      <td className="px-4 py-3 text-center">{lab.patient_count}</td>
                      <td className="px-4 py-3 text-center">{lab.order_count}</td>
                      <td className="px-4 py-3 text-right">₹{formatMoney(lab.month_cost)}</td>
                      <td className="px-4 py-3 text-right">₹{formatMoney(lab.total_cost)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">₹{formatMoney(lab.total_paid)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${lab.total_outstanding > 0 ? 'text-rose-600' : 'text-slate-400'}`}>₹{formatMoney(lab.total_outstanding)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${lab.is_active === false ? 'bg-slate-100 text-slate-500 ring-slate-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}`}>
                          {lab.is_active === false ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {lab.lab_vendor_id && (
                          <button type="button" onClick={()=>toggleLabActive(lab)} className="rounded border px-2 py-1 text-xs hover:bg-slate-50">{lab.is_active===false?'Activate':'Deactivate'}</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 sm:hidden">
            {filtered.map(lab => (
              <div
                key={lab.lab_key}
                className="rounded-xl border bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => navigate(`/labs/${lab.lab_vendor_id || 'unassigned'}`)} className="font-semibold text-slate-900 text-left">{lab.lab_vendor_name}</button>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${lab.is_active === false ? 'bg-slate-100 text-slate-500 ring-slate-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}`}>
                    {lab.is_active === false ? 'Inactive' : 'Active'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-slate-500">Patients</p>
                    <p className="font-bold text-slate-900">{lab.patient_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Orders</p>
                    <p className="font-bold text-slate-900">{lab.order_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Outstanding</p>
                    <p className={`font-bold ${lab.total_outstanding > 0 ? 'text-rose-600' : 'text-slate-400'}`}>₹{formatMoney(lab.total_outstanding)}</p>
                  </div>
                </div>
                {lab.lab_vendor_id && <button type="button" onClick={()=>toggleLabActive(lab)} className="mt-2 w-full rounded border py-1 text-xs">{lab.is_active===false?'Activate':'Deactivate'}</button>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Orders list */}
      <div className="rounded-xl border bg-white">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold">Lab Orders ({ordersTotal})</h2>
          <div className="flex flex-wrap gap-2">
            <select value={orderFilter.status||''} onChange={e=>setOrderFilter({...orderFilter, status:e.target.value})} className="rounded border px-3 py-1.5 text-sm">
              <option value="">All Status</option><option>Ordered</option><option>Received</option><option>Cancelled</option>
            </select>
            <input type="date" value={orderFilter.from||''} onChange={e=>setOrderFilter({...orderFilter, from:e.target.value})} className="rounded border px-3 py-1.5 text-sm" />
            <input type="date" value={orderFilter.to||''} onChange={e=>setOrderFilter({...orderFilter, to:e.target.value})} className="rounded border px-3 py-1.5 text-sm" />
            <div className="relative">
              <input value={orderFilter.patient_search||''} onChange={e=>setOrderFilter({...orderFilter, patient_search:e.target.value})} placeholder="Search patient..." className="rounded border pl-8 pr-3 py-1.5 text-sm" />
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400"/>
            </div>
          </div>
        </div>
        {orders.length===0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No lab orders recorded yet. Click + Add Lab Order.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                <th className="px-4 py-3">Patient</th><th className="px-4 py-3">Lab</th><th className="px-4 py-3">Product</th><th className="px-4 py-3">Order Date</th><th className="px-4 py-3">Required</th><th className="px-4 py-3 text-right">Cost</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
              </tr></thead>
              <tbody className="divide-y">
                {orders.map(o=> (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3"><button onClick={()=>navigate(`/patients/${o.patient_id}`)} className="font-medium text-teal-700 hover:underline">{o.patient_name||o.patient_id.slice(0,8)}</button><p className="text-xs text-slate-400">{o.patient_code||''}</p></td>
                    <td className="px-4 py-3">{o.lab_vendor_name||'-'}</td>
                    <td className="px-4 py-3 font-medium">{o.test_name}</td>
                    <td className="px-4 py-3 text-xs">{o.entry_date?.slice(0,10)||'-'}</td>
                    <td className="px-4 py-3 text-xs">{o.required_date?.slice(0,10)||'-'}</td>
                    <td className="px-4 py-3 text-right">₹{formatMoney(o.cost)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">₹{formatMoney(o.amount_paid)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${o.outstanding>0?'text-rose-600':'text-slate-400'}`}>₹{formatMoney(o.outstanding)}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{o.status}</span></td>
                    <td className="px-4 py-3 text-right">
                      {Number(o.outstanding) > 0 && (
                        <button
                          type="button"
                          onClick={()=>markOrderPaid(o)}
                          disabled={payingId===o.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {payingId===o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <CheckCircle className="h-3.5 w-3.5"/>}
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

      {/* Add Lab modal */}
      {showAddLab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={()=>setShowAddLab(false)}>
          <form onClick={e=>e.stopPropagation()} onSubmit={handleCreateLab} className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl space-y-3">
            <h3 className="font-semibold">Add Laboratory</h3>
            <input value={newLabName} onChange={e=>setNewLabName(e.target.value)} placeholder="Lab/Vendor Name" className="w-full rounded border px-3 py-2 text-sm" autoFocus />
            <div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowAddLab(false)} className="rounded border px-4 py-2 text-sm">Cancel</button><button type="submit" className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white">Save</button></div>
          </form>
        </div>
      )}

      {/* Add Lab Order modal */}
      {showAddOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={()=>setShowAddOrder(false)}>
          <form onClick={e=>e.stopPropagation()} onSubmit={handleCreateOrder} className="my-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold">Add Lab Order</h3>
            <div>
              <label className="text-sm font-medium">Patient *</label>
              <input value={patientSearch} onChange={e=>setPatientSearch(e.target.value)} placeholder="Search patient..." className="mt-1 w-full rounded border px-3 py-2 text-sm" />
              <select value={orderForm.patient_id} onChange={e=>setOrderForm({...orderForm, patient_id:e.target.value, session_id:''})} className="mt-2 w-full rounded border px-3 py-2 text-sm" required>
                <option value="">Select patient</option>
                {filteredPatients.map(p=> <option key={p.id} value={p.id}>{p.full_name} — {p.patient_id}</option>)}
              </select>
            </div>
            {orderForm.patient_id && sessions.length>0 && (
              <label className="block text-sm">Session (optional)<select value={orderForm.session_id} onChange={e=>setOrderForm({...orderForm, session_id:e.target.value})} className="mt-1 w-full rounded border px-3 py-2 text-sm"><option value="">Auto-select latest (no new session)</option>{sessions.map(s=> <option key={s.id} value={s.id}>{s.visit_date?.slice(0,10)} — {s.chief_complaint} ({s.visit_type})</option>)}</select></label>
            )}
            {orderForm.patient_id && sessions.length===0 && <p className="text-xs text-amber-600">No existing session — lab will be linked to latest session automatically. No new session will be created.</p>}
            <select value={orderForm.lab_vendor_id} onChange={e=>setOrderForm({...orderForm, lab_vendor_id:e.target.value})} className="w-full rounded border px-3 py-2 text-sm">
              <option value="">Select lab/vendor</option>
              {labs.filter(l=>l.is_active!==false).map(l=> <option key={l.lab_vendor_id} value={l.lab_vendor_id}>{l.lab_vendor_name}</option>)}
            </select>
            <input value={orderForm.test_name} onChange={e=>setOrderForm({...orderForm, test_name:e.target.value})} placeholder="Product / Lab Work *" className="w-full rounded border px-3 py-2 text-sm" required />
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={orderForm.entry_date} onChange={e=>setOrderForm({...orderForm, entry_date:e.target.value})} className="w-full rounded border px-3 py-2 text-sm" />
              <input type="date" value={orderForm.required_date} onChange={e=>setOrderForm({...orderForm, required_date:e.target.value})} className="w-full rounded border px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" min="0" step="0.01" value={orderForm.cost} onChange={e=>setOrderForm({...orderForm, cost:e.target.value})} placeholder="Cost" className="w-full rounded border px-3 py-2 text-sm" />
              <input type="number" min="0" step="0.01" value={orderForm.amount_paid} onChange={e=>setOrderForm({...orderForm, amount_paid:e.target.value})} placeholder="Amount Paid" className="w-full rounded border px-3 py-2 text-sm" />
            </div>
            <select value={orderForm.status} onChange={e=>setOrderForm({...orderForm, status:e.target.value})} className="w-full rounded border px-3 py-2 text-sm"><option>Ordered</option><option>Received</option><option>Cancelled</option></select>
            <textarea value={orderForm.notes} onChange={e=>setOrderForm({...orderForm, notes:e.target.value})} rows={2} placeholder="Notes" className="w-full rounded border px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2"><button type="button" onClick={()=>setShowAddOrder(false)} className="rounded border px-4 py-2 text-sm">Cancel</button><button type="submit" className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white">Create Order</button></div>
          </form>
        </div>
      )}
    </div>
  )
}
