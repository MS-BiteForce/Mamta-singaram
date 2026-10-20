import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPaymentAnalytics, getPaymentSessions, getLocations, updateSession, getPatientLedger, getLabSummary } from '../lib/api'
import { useToast } from '../hooks/useToast'
import { CheckCircle, Search, ArrowDownLeft, IndianRupee, MapPin, Calendar, FlaskConical, Pencil } from 'lucide-react'
import { format } from 'date-fns'

function fmt(n){ return Number(n||0).toLocaleString('en-IN') }
function fmtDate(d){ try{ return format(new Date(d),'dd MMM yyyy')}catch{ return d||'-' } }

const statusStyle = {
  Pending: 'bg-red-100 text-red-700 ring-red-200',
  Partial: 'bg-yellow-100 text-yellow-700 ring-yellow-200',
  Paid: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
}

export default function Payments(){
  const navigate=useNavigate()
  const {showToast}=useToast()
  const [analytics,setAnalytics]=useState(null)
  const [labSpent,setLabSpent]=useState(0)
  const [sessions,setSessions]=useState([])
  const [total,setTotal]=useState(0)
  const [loading,setLoading]=useState(true)
  const [locations,setLocations]=useState([])
  const [selectedSession,setSelectedSession]=useState(null)
  const [ledger,setLedger]=useState([])

  // filters
  const getMonthRange = ()=>{
    const now=new Date()
    const from=new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const to=new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().split('T')[0]
    return {from,to}
  }
  const [datePreset,setDatePreset]=useState('month')
  const [from,setFrom]=useState(getMonthRange().from)
  const [to,setTo]=useState(getMonthRange().to)
  const [locationId,setLocationId]=useState('')
  const [status,setStatus]=useState('All')
  const [search,setSearch]=useState('')
  const [searchInput,setSearchInput]=useState('')

  const applyPreset = (preset)=>{
    setDatePreset(preset)
    const now=new Date()
    if(preset==='today'){
      const d=now.toISOString().split('T')[0]; setFrom(d); setTo(d)
    } else if(preset==='week'){
      const day=now.getDay(); const mon=new Date(now); mon.setDate(now.getDate()-(day===0?6:day-1))
      const sun=new Date(mon); sun.setDate(mon.getDate()+6)
      setFrom(mon.toISOString().split('T')[0]); setTo(sun.toISOString().split('T')[0])
    } else if(preset==='month'){
      const r=getMonthRange(); setFrom(r.from); setTo(r.to)
    } else if(preset==='prevMonth'){
      const r={from:new Date(now.getFullYear(), now.getMonth()-1,1).toISOString().split('T')[0], to:new Date(now.getFullYear(), now.getMonth(),0).toISOString().split('T')[0]}; setFrom(r.from); setTo(r.to)
    } else if(preset==='30days'){
      const f=new Date(now); f.setDate(now.getDate()-30); setFrom(f.toISOString().split('T')[0]); setTo(now.toISOString().split('T')[0])
    }
    // custom keeps current from/to
  }

  const load = useCallback(async ()=>{
    setLoading(true)
    try{
      const [a, s, labSummary] = await Promise.all([
        getPaymentAnalytics({from,to, location_id: locationId}),
        getPaymentSessions({from,to, location_id: locationId, status, search, limit:100}),
        // Same calculation as the Laboratory page: all-time sum of lab order costs
        getLabSummary().catch(()=>[]),
      ])
      setAnalytics(a)
      const labRows = Array.isArray(labSummary) ? labSummary : labSummary?.data ?? []
      setLabSpent(labRows.reduce((sum, l) => sum + Number(l.total_cost||0), 0))
      const rows = Array.isArray(s.rows)?s.rows: Array.isArray(s)?s: s.rows||[]
      setSessions(rows)
      setTotal(s.total ?? rows.length)
    }catch(e){ showToast(e.message,'error') } finally{ setLoading(false) }
  },[from,to,locationId,status,search,showToast])

  useEffect(()=>{ getLocations(true).then(d=> setLocations(Array.isArray(d)?d: d?.data??[])).catch(()=>{}) },[])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{ load() },[load])
  // debounce search
  useEffect(()=>{
    const t=setTimeout(()=> setSearch(searchInput), 400)
    return ()=> clearTimeout(t)
  },[searchInput])

  const openDetail = async (s)=>{
    setSelectedSession(s)
    try{
      const data=await getPatientLedger(s.patient_id)
      const arr=Array.isArray(data)?data: data?.data??[]
      // filter to this session's ledger? show all for patient but highlight session
      setLedger(arr)
    }catch{ setLedger([]) }
  }

  const markAsPaid = async (s)=>{
    try{
      await updateSession(s.id, { amount_paid: s.treatment_cost, payment_status:'Paid' })
      showToast('Marked as paid','success'); load()
      if(selectedSession?.id===s.id) setSelectedSession(null)
    }catch(e){ showToast(e.message,'error')}
  }

  const saveNote = async (s, note)=>{
    const nextNotes = note || null
    if ((s.notes || null) === nextNotes) return
    // Optimistic update so the UI reflects the change immediately
    setSessions(rows=> rows.map(r=> r.id===s.id ? {...r, notes: nextNotes} : r))
    setSelectedSession(cur=> cur && cur.id===s.id ? {...cur, notes: nextNotes} : cur)
    try{
      await updateSession(s.id, { notes: nextNotes })
      showToast('Note saved','success')
    }catch(e){
      setSessions(rows=> rows.map(r=> r.id===s.id ? {...r, notes: s.notes ?? null} : r))
      showToast(e.message,'error')
    }
  }

  const activePeriodLabel = datePreset==='custom' ? `${fmtDate(from)} - ${fmtDate(to)}` : datePreset==='today' ? fmtDate(from) : `${fmtDate(from)} - ${fmtDate(to)}`

  return (
    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <p className="mt-1 text-sm text-slate-500">Financial overview — <span className="font-medium text-slate-700">{activePeriodLabel}</span> {locationId && <span>· {locations.find(l=>l.id===locationId)?.name}</span>} {status!=='All' && <span>· {status}</span>}</p>
      </header>

      {/* Summary cards - patient-focused: Incoming, Total Paid, Pending, Partial, Outstanding */}
      {analytics ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border bg-white p-4">
            <p className="flex items-center gap-1 text-xs font-medium uppercase text-slate-500"><ArrowDownLeft className="h-3 w-3 text-emerald-600"/> Incoming</p>
            <p className="mt-1 text-lg font-bold text-emerald-700" title="Money received from patients in selected period">₹{fmt(analytics.incomingThisMonth)}</p>
            <p className="text-xs text-slate-400">This period</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="flex items-center gap-1 text-xs font-medium uppercase text-slate-500"><FlaskConical className="h-3 w-3 text-indigo-600"/> Total Lab Spent</p>
            <p className="mt-1 text-lg font-bold text-indigo-700" title="Total cost of all lab orders (all time)">₹{fmt(labSpent)}</p>
            <p className="text-xs text-slate-400">All time</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs font-medium uppercase text-slate-500">Total Paid</p>
            <p className="mt-1 text-lg font-bold text-slate-900" title="Total amount patients have paid in selected period">₹{fmt(analytics.totalPaid)}</p>
            <p className="text-xs text-slate-400">{analytics.counts.paid} paid sessions</p>
          </div>
          <div className="rounded-xl border bg-amber-50 p-4">
            <p className="text-xs font-medium uppercase text-amber-700" title="Patients who have paid nothing">Pending</p>
            <p className="mt-1 text-lg font-bold text-amber-700">₹{fmt(analytics.pendingAmount)}</p>
            <p className="text-xs text-slate-500">{analytics.counts.pending} sessions</p>
          </div>
          <div className="rounded-xl border bg-yellow-50 p-4">
            <p className="text-xs font-medium uppercase text-yellow-700" title="Remaining amount for partially paid patients">Partial</p>
            <p className="mt-1 text-lg font-bold text-yellow-700">₹{fmt(analytics.partialAmount)}</p>
            <p className="text-xs text-slate-500">{analytics.counts.partial} sessions</p>
          </div>
          <div className="rounded-xl border bg-rose-50 p-4">
            <p className="text-xs font-medium uppercase text-rose-700" title="Pending + Partial outstanding">Outstanding</p>
            <p className="mt-1 text-lg font-bold text-rose-700">₹{fmt(analytics.outstanding)}</p>
            <p className="text-xs text-slate-500">{analytics.counts.sessions} sessions · {analytics.counts.patients} patients</p>
          </div>
        </div>
      ) : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{Array.from({length:6}).map((_,i)=><div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100"/> )}</div>}

      {/* Filters */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                ['today','Today'],['week','This Week'],['month','This Month'],['prevMonth','Prev Month'],['30days','30 Days'],['custom','Custom']
              ].map(([v,l])=>(
                <button key={v} type="button" onClick={()=>applyPreset(v)} className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${datePreset===v?'bg-teal-600 text-white border-teal-600':'bg-white text-slate-600 hover:bg-slate-50'}`}>{l}</button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
              <input value={searchInput} onChange={e=>setSearchInput(e.target.value)} placeholder="Search patient name/ID..." className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm"/>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="text-xs font-medium text-slate-600">From</label>
              <input type="date" value={from} onChange={e=>{setFrom(e.target.value); setDatePreset('custom')}} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">To</label>
              <input type="date" value={to} onChange={e=>{setTo(e.target.value); setDatePreset('custom')}} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Location</label>
              <select value={locationId} onChange={e=>setLocationId(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                <option value="">All Locations</option>
                {locations.map(l=> <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Status</label>
              <select value={status} onChange={e=>setStatus(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                <option value="All">All</option>
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Payment table */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-slate-900">Sessions ({total})</h2>
          <span className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="h-3 w-3"/>{fmtDate(from)} - {fmtDate(to)}</span>
        </div>

        {loading ? (
          <div className="space-y-3 p-4">{Array.from({length:4}).map((_,i)=><div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100"/>)}</div>
        ) : sessions.length===0 ? (
          <div className="py-16 text-center">
            <CheckCircle className="mx-auto h-10 w-10 text-slate-300"/>
            <p className="mt-2 text-sm font-medium text-slate-600">No payments found</p>
            <p className="text-xs text-slate-400">Try adjusting filters.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Visit Date</th>
                    <th className="px-4 py-3"><span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3"/>Location</span></th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Outstanding</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sessions.map(s=>{
                    const due=Math.max(Number(s.treatment_cost||0)-Number(s.amount_paid||0),0)
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 cursor-pointer" onClick={()=>openDetail(s)}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{s.patient_name||'Unknown'}</p>
                          <p className="text-xs text-slate-400">{s.patient_code||s.patient_id.slice(0,8)}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{fmtDate(s.visit_date)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{s.location_name||'—'}</td>
                        <td className="px-4 py-3 text-right font-medium">₹{fmt(s.treatment_cost)}</td>
                        <td className="px-4 py-3 text-right text-emerald-700">₹{fmt(s.amount_paid)}</td>
                        <td className="px-4 py-3 text-right font-bold text-rose-600">₹{fmt(due)}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${statusStyle[s.payment_status]}`}>{s.payment_status}</span></td>
                        <td className="px-4 py-3"><NotesCell session={s} onSave={saveNote} /></td>
                        <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                          {s.payment_status!=='Paid' && <button onClick={()=>markAsPaid(s)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">Mark Paid</button>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="space-y-3 p-3 sm:hidden">
              {sessions.map(s=>{
                const due=Math.max(Number(s.treatment_cost||0)-Number(s.amount_paid||0),0)
                return (
                  <div key={s.id} className="rounded-xl border p-4" onClick={()=>openDetail(s)}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{s.patient_name||'Unknown'}</p>
                        <p className="text-xs text-slate-400">{fmtDate(s.visit_date)} · {s.location_name||'No location'}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${statusStyle[s.payment_status]}`}>{s.payment_status}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                      <div><p className="text-xs text-slate-500">Total</p><p className="font-semibold">₹{fmt(s.treatment_cost)}</p></div>
                      <div><p className="text-xs text-slate-500">Paid</p><p className="font-semibold text-emerald-700">₹{fmt(s.amount_paid)}</p></div>
                      <div><p className="text-xs text-slate-500">Due</p><p className="font-bold text-rose-600">₹{fmt(due)}</p></div>
                    </div>
                    <div className="mt-3 border-t pt-2">
                      <NotesCell session={s} onSave={saveNote} />
                    </div>
                    {s.payment_status!=='Paid' && <button onClick={(e)=>{e.stopPropagation(); markAsPaid(s)}} className="mt-3 w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white">Mark Paid</button>}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Detail drawer */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={()=>setSelectedSession(null)}>
          <div onClick={e=>e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{selectedSession.patient_name}</h3>
              <button onClick={()=>setSelectedSession(null)} className="rounded p-1 hover:bg-slate-100">✕</button>
            </div>
            <p className="text-xs text-slate-500">{selectedSession.patient_code} · {fmtDate(selectedSession.visit_date)} · {selectedSession.location_name||'No location'}</p>
            <div className="mt-4 rounded-xl border bg-slate-50 p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-xs text-slate-500">Total</p><p className="font-bold">₹{fmt(selectedSession.treatment_cost)}</p></div>
                <div><p className="text-xs text-slate-500">Paid</p><p className="font-bold text-emerald-700">₹{fmt(selectedSession.amount_paid)}</p></div>
                <div><p className="text-xs text-slate-500">Outstanding</p><p className="font-bold text-rose-600">₹{fmt(Math.max(Number(selectedSession.treatment_cost||0)-Number(selectedSession.amount_paid||0),0))}</p></div>
              </div>
              <p className="mt-2 text-center"><span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${statusStyle[selectedSession.payment_status]}`}>{selectedSession.payment_status}</span></p>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-semibold flex items-center gap-1"><IndianRupee className="h-4 w-4"/>Payment History</h4>
              {ledger.length===0 ? <p className="mt-2 text-sm text-slate-400">No ledger entries.</p> : (
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                  {ledger.map(e=>(
                    <div key={e.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium capitalize">{e.entry_type} <span className="text-xs text-slate-400">{fmtDate(e.entry_date)}</span></p>
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">{e.description||''}</p>
                      </div>
                      <p className={`font-bold ${e.entry_type==='payment'?'text-emerald-700':'text-slate-900'}`}>₹{fmt(e.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={()=>navigate(`/patients/${selectedSession.patient_id}`)} className="flex-1 rounded-lg border px-4 py-2 text-sm">View Patient</button>
              <button onClick={()=>navigate(`/sessions/edit/${selectedSession.id}`)} className="flex-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white">View Session</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function NotesCell({ session, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(session.notes || '')
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)

  const commit = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setEditing(false)
    setSaving(true)
    try {
      await onSave(session, value.trim())
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setValue(session.notes || ''); setEditing(true) }}
        className="group flex max-w-[200px] items-start gap-1 text-left text-xs text-slate-600 hover:text-teal-700"
        title="Edit note"
        disabled={saving}
      >
        <span className="line-clamp-2">{session.notes || <span className="text-slate-400">Add note</span>}</span>
        <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-slate-400 group-hover:text-teal-600" />
      </button>
    )
  }

  return (
    <div className="flex max-w-[220px] items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setValue(session.notes || ''); setEditing(false) }
        }}
        onBlur={commit}
        placeholder="Add note..."
        className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-teal-500 focus:outline-none"
      />
    </div>
  )
}
