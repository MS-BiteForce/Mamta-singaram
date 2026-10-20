import { useEffect, useState, useMemo, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { Calendar, Plus, Search, X, Loader2, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../hooks/useToast'
import { getAppointments, createAppointment, updateAppointment, deleteAppointment, getPatients, createPatient } from '../lib/api'
import { getLocations, createLocation } from '../lib/api'
import { isPastDate, isPastTimeSlot } from '../lib/appointmentTime'
import AppointmentCalendar from '../components/AppointmentCalendar'
import AppointmentDetailModal from '../components/AppointmentDetailModal'
import AppointmentDayTimeline, { formatTime12 } from '../components/AppointmentDayTimeline'
import AppointmentWeekView from '../components/AppointmentWeekView'
import MasterSelect from '../components/MasterSelect'

export default function Appointments(){
  const navigate=useNavigate()
  const {showToast}=useToast()
  const [view,setView]=useState('month') // today | week | month
  const [currentDate,setCurrentDate]=useState(new Date())
  const [appointments,setAppointments]=useState([])
  const [loading,setLoading]=useState(true)
  const [selectedDate,setSelectedDate]=useState(new Date())
  const [selectedAppt,setSelectedAppt]=useState(null)
  const [showCreate,setShowCreate]=useState(false)
  const [showDayDetail,setShowDayDetail]=useState(null)
  const [form,setForm]=useState({ patient_id:'', appointment_date:'', appointment_time:'', title:'', notes:'', location_id:'', status:'Scheduled' })
  const [saving,setSaving]=useState(false)
  const [patients,setPatients]=useState([])
  const [search,setSearch]=useState('')
  const [patientSearch,setPatientSearch]=useState('')
  const [quickCreate,setQuickCreate]=useState(false)
  const [quickForm,setQuickForm]=useState({ full_name:'', phone:'' })
  const [quickSaving,setQuickSaving]=useState(false)
  const [upcoming,setUpcoming]=useState([])

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd')
  const selectedIsPast = isPastDate(selectedDateKey)

  // Booking guard: block past dates entirely; on today, block passed time slots
  const canBookSlot = useCallback((date, time='09:00') => {
    const key = format(date, 'yyyy-MM-dd')
    return !isPastTimeSlot(key, time)
  }, [])

  const load = async (date=currentDate, v=view)=>{
    setLoading(true)
    try{
      let start, end
      if(v==='today'){ start=end=format(date,'yyyy-MM-dd') }
      else if(v==='week'){ start=format(startOfWeek(date,{weekStartsOn:1}),'yyyy-MM-dd'); end=format(endOfWeek(date,{weekStartsOn:1}),'yyyy-MM-dd') }
      else { start=format(startOfMonth(date),'yyyy-MM-dd'); end=format(endOfMonth(date),'yyyy-MM-dd') }
      const [data, up] = await Promise.all([
        getAppointments({ date_from:start, date_to:end }),
        getAppointments({ date_from: todayStr, date_to: format(addDays(new Date(),10),'yyyy-MM-dd') })
      ])
      const arr=Array.isArray(data)?data: data?.data ?? data?.rows ?? []
      setAppointments(arr)
      const uarr=Array.isArray(up)?up: up?.data ?? up?.rows ?? []
      setUpcoming(uarr)
    }catch(e){ showToast(e.message,'error')}
    finally{ setLoading(false)}
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(()=>{ load(currentDate, view) },[currentDate, view])
  useEffect(()=>{
    getPatients().then(d=> setPatients(Array.isArray(d)?d: d?.data ?? [])).catch(()=>{})
  },[])

  const openCreate = (date, time) => {
    const d = date ? format(date,'yyyy-MM-dd') : format(selectedDate,'yyyy-MM-dd')
    if (isPastDate(d) || isPastTimeSlot(d, time || '09:00')) {
      showToast('Cannot book appointments in the past.', 'warning')
      return
    }
    setForm({ patient_id:'', appointment_date:d, appointment_time: time || '', title:'', notes:'', location_id:'', status:'Scheduled' })
    setPatientSearch('')
    setQuickCreate(false)
    setShowCreate(true)
  }

  const handleSlotClick = (date, time) => openCreate(date, time)
  const handleMonthDayClick = (date) => { setSelectedDate(date); setShowDayDetail(date) }

  const filteredPatients = useMemo(()=> {
    if(!patientSearch.trim()) return patients.slice(0,50)
    const q=patientSearch.toLowerCase()
    return patients.filter(p=> p.full_name.toLowerCase().includes(q) || String(p.phone||'').includes(q) || String(p.patient_id||'').toLowerCase().includes(q)).slice(0,50)
  },[patients, patientSearch])

  const handleQuickCreate = async (e)=>{
    e.preventDefault()
    if(!quickForm.full_name.trim()) return showToast('Name required','warning')
    if(!quickForm.phone.trim()) return showToast('Phone required','warning')
    setQuickSaving(true)
    try{
      const created = await createPatient({ full_name: quickForm.full_name.trim(), phone: quickForm.phone.trim() })
      const newPatient = created?.data || created
      // refresh patients
      const d=await getPatients()
      const arr=Array.isArray(d)?d: d?.data ?? []
      setPatients(arr)
      setForm(f=>({...f, patient_id: newPatient.id || newPatient._id}))
      setPatientSearch(newPatient.full_name)
      setQuickCreate(false)
      setQuickForm({full_name:'', phone:''})
      showToast('Patient created','success')
    }catch(err){ showToast(err.message,'error')}
    finally{ setQuickSaving(false)}
  }

  const handleCreate=async(e)=>{
    e.preventDefault()
    if(!form.patient_id) return showToast('Patient is required','warning')
    if(!form.appointment_date) return showToast('Date is required','warning')
    if(isPastDate(form.appointment_date) || isPastTimeSlot(form.appointment_date, form.appointment_time || '09:00')) return showToast('Cannot book appointments in the past.','warning')
    setSaving(true)
    try{
      await createAppointment(form)
      showToast('Appointment created','success')
      setShowCreate(false)
      setForm({ patient_id:'', appointment_date:'', appointment_time:'', title:'', notes:'', location_id:'', status:'Scheduled' })
      await load(currentDate, view)
    }catch(err){ showToast(err.message,'error')}
    finally{ setSaving(false)}
  }

  const handleStatusChange=async(appt,status)=>{
    try{ await updateAppointment(appt.id,{status}); showToast('Status updated','success'); setSelectedAppt(null); await load(currentDate, view)}catch(e){ showToast(e.message,'error')}
  }
  const handleDelete=async(appt)=>{
    if(!confirm('Delete appointment?')) return
    try{ await deleteAppointment(appt.id); showToast('Deleted','success'); setSelectedAppt(null); await load(currentDate, view)}catch(e){ showToast(e.message,'error')}
  }

  const filteredDay = appointments.filter(a=> String(a.appointment_date).split('T')[0]===format(selectedDate,'yyyy-MM-dd'))
  const filteredSearch = search ? filteredDay.filter(a=> (a.title||'').toLowerCase().includes(search.toLowerCase()) || (a.notes||'').toLowerCase().includes(search.toLowerCase())) : filteredDay

  // Enrich appointments with patient_name for display
  const patientMap = useMemo(()=>{ const m={}; patients.forEach(p=> m[p.id]=p.full_name); return m },[patients])
  const enriched = useMemo(()=> appointments.map(a=> ({...a, patient_name: patientMap[a.patient_id] || ''})), [appointments, patientMap])

  // Upcoming appointments grouped by date (today -> +10 days)
  const upcomingGroups = useMemo(()=>{
    const startKey = format(new Date(),'yyyy-MM-dd')
    const endKey = format(addDays(new Date(),10),'yyyy-MM-dd')
    const list = upcoming
      .map(a=> ({...a, patient_name: patientMap[a.patient_id] || '', dateKey: String(a.appointment_date).split('T')[0]}))
      .filter(a=> a.dateKey>=startKey && a.dateKey<=endKey)
      .sort((a,b)=> a.dateKey.localeCompare(b.dateKey) || String(a.appointment_time||'').localeCompare(String(b.appointment_time||'')))
    const groups=[]
    list.forEach(a=>{
      const last=groups[groups.length-1]
      if(last && last.key===a.dateKey) last.items.push(a)
      else groups.push({ key:a.dateKey, label:format(new Date(a.dateKey+'T00:00:00'),'EEE, dd MMM'), items:[a] })
    })
    return groups
  },[upcoming, patientMap])

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Appointments</h1>
          <p className="mt-1 text-sm text-slate-500">Today · Week · Month — click a slot to book</p>
        </div>
        {selectedIsPast ? (
          <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"><Plus className="h-4 w-4"/> New Appointment</span>
        ) : (
          <button type="button" onClick={()=>openCreate(selectedDate,'')} className="inline-flex flex-wrap items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"><Plus className="h-4 w-4"/> New Appointment</button>
        )}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-lg border bg-white p-1 shadow-sm">
          {['today','week','month'].map(v=> (
            <button key={v} type="button" onClick={()=>setView(v)} className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${view===v?'bg-teal-600 text-white shadow-sm':'text-slate-600 hover:bg-slate-50'}`}>{v}</button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <button type="button" onClick={()=>setCurrentDate(subMonths(currentDate,1))} className={`rounded-md border bg-white px-3 py-1.5 text-sm ${view!=='month'?'hidden':''}`}>‹ Prev</button>
          <button type="button" onClick={()=>setCurrentDate(new Date())} className="rounded-md border bg-white px-3 py-1.5 text-sm">Today</button>
          <button type="button" onClick={()=>setCurrentDate(addMonths(currentDate,1))} className={`rounded-md border bg-white px-3 py-1.5 text-sm ${view!=='month'?'hidden':''}`}>Next ›</button>
          {view==='week' && (
            <>
              <button type="button" onClick={()=>setCurrentDate(addDays(currentDate,-7))} className="rounded-md border bg-white px-3 py-1.5 text-sm">‹ Week</button>
              <button type="button" onClick={()=>setCurrentDate(addDays(currentDate,7))} className="rounded-md border bg-white px-3 py-1.5 text-sm">Week ›</button>
            </>
          )}
          {view==='today' && (
            <>
              <button type="button" onClick={()=>setCurrentDate(addDays(currentDate,-1))} className="rounded-md border bg-white px-3 py-1.5 text-sm">‹ Day</button>
              <button type="button" onClick={()=>setCurrentDate(addDays(currentDate,1))} className="rounded-md border bg-white px-3 py-1.5 text-sm">Day ›</button>
            </>
          )}
          <span className="ml-2 text-sm font-medium text-slate-700">{view==='today'? format(currentDate,'dd MMM yyyy') : view==='week' ? `${format(startOfWeek(currentDate,{weekStartsOn:1}),'dd MMM')} – ${format(endOfWeek(currentDate,{weekStartsOn:1}),'dd MMM yyyy')}` : format(currentDate,'MMMM yyyy')}</span>
        </div>
      </div>

      {loading ? <div className="h-64 animate-pulse rounded-xl bg-slate-100"/> : (
        <>
          {view==='month' && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <AppointmentCalendar appointments={enriched} currentMonth={currentDate} onMonthChange={setCurrentDate} onSelectDate={handleMonthDayClick} selectedDate={selectedDate} onAppointmentClick={setSelectedAppt} />
                <p className="mt-2 text-xs text-slate-400">Click a date to see its full timeline. Click a time slot to book.</p>
              </div>
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{format(selectedDate,'dd MMM yyyy')}</h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{filteredDay.length} appts</span>
                </div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search title/notes" className="w-full rounded-md border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none"/>
                </div>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {filteredSearch.length===0 ? (
                    <div className="py-8 text-center text-sm text-slate-500">
                      <Calendar className="mx-auto mb-2 h-6 w-6 text-slate-300"/>No appointments on this date
                      {!selectedIsPast && (
                        <button type="button" onClick={()=>openCreate(selectedDate,'09:00')} className="mt-3 block w-full rounded-lg border border-dashed py-2 text-sm text-teal-600 hover:bg-teal-50">+ Book 9:00 AM</button>
                      )}
                    </div>
                  ) : filteredSearch.map(a=>(
                    <button key={a.id} type="button" onClick={()=>setSelectedAppt(a)} className="w-full rounded-lg border p-3 text-left hover:bg-slate-50">
                      <p className="text-sm font-medium text-slate-900">{a.title || 'Appointment'} <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ring-1 ${a.status==='Completed'?'bg-emerald-50 text-emerald-700 ring-emerald-200': a.status==='Cancelled'?'bg-slate-100 text-slate-600 ring-slate-200': a.status==='No-Show'?'bg-rose-50 text-rose-700 ring-rose-200':'bg-blue-50 text-blue-700 ring-blue-200'}`}>{a.status}</span></p>
                      <p className="text-xs text-slate-500">{a.appointment_time ? formatTime12(a.appointment_time)+' · ' : ''}{a.location_name || ''}</p>
                      {a.notes && <p className="mt-1 truncate text-xs text-slate-600">{a.notes}</p>}
                    </button>
                  ))}
                </div>

                {/* ── Upcoming (Next 10 Days) ─────────────────────────────── */}
                <div className="mt-4 border-t pt-4">
                  <h4 className="mb-2 text-sm font-semibold text-slate-900">Upcoming (Next 10 Days)</h4>
                  {upcomingGroups.length===0 ? (
                    <p className="py-4 text-center text-xs text-slate-400">No upcoming appointments</p>
                  ) : (
                    <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                      {upcomingGroups.map(group=> (
                        <div key={group.key}>
                          <p className="sticky top-0 z-10 bg-white text-xs font-semibold text-teal-700 py-1">{group.label}</p>
                          <div className="space-y-1">
                            {group.items.map(a=> (
                              <button key={a.id} type="button" onClick={()=>{ setSelectedDate(new Date(group.key+'T00:00:00')); setCurrentDate(new Date(group.key+'T00:00:00')) }} className="w-full rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-left text-xs text-slate-700 hover:border-teal-300 hover:bg-teal-50">
                                <span className="font-medium">{a.appointment_time ? formatTime12(a.appointment_time) : 'No time'}</span> — {a.patient_name || 'Walk-in'}{a.title ? ` (${a.title})` : ''}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {view==='week' && (
            <AppointmentWeekView currentDate={currentDate} appointments={enriched} onAppointmentClick={setSelectedAppt} onSlotClick={handleSlotClick} selectedDate={selectedDate} canBookSlot={canBookSlot} />
          )}
          {view==='today' && (
            <AppointmentDayTimeline date={currentDate} appointments={enriched.filter(a=> String(a.appointment_date).split('T')[0]===format(currentDate,'yyyy-MM-dd'))} onAppointmentClick={setSelectedAppt} onSlotClick={handleSlotClick} canBookSlot={canBookSlot} />
          )}
        </>
      )}

      {/* Day detail modal from month */}
      {showDayDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={()=>setShowDayDetail(null)}>
          <div onClick={e=>e.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-4 py-3">
              <h3 className="font-semibold">{format(showDayDetail,'EEEE, dd MMM yyyy')}</h3>
              <button type="button" onClick={()=>setShowDayDetail(null)} className="rounded p-1 hover:bg-slate-100"><X className="h-5 w-5"/></button>
            </div>
            <div className="p-4">
              <AppointmentDayTimeline date={showDayDetail} appointments={enriched.filter(a=> String(a.appointment_date).split('T')[0]===format(showDayDetail,'yyyy-MM-dd'))} onAppointmentClick={(a)=>{ setShowDayDetail(null); setSelectedAppt(a)}} onSlotClick={(d,t)=>{ setShowDayDetail(null); handleSlotClick(d,t)}} canBookSlot={canBookSlot} />
            </div>
          </div>
        </div>
      )}

      {selectedAppt && (
        <AppointmentDetailModal
          appointment={selectedAppt}
          onClose={()=>setSelectedAppt(null)}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onNavigatePatient={(pid)=>{ setSelectedAppt(null); navigate(`/patients/${pid}`)}}
          onNavigateSession={(sid,pid)=>{ setSelectedAppt(null); if(sid) navigate(`/sessions/edit/${sid}`); else if(pid) navigate(`/patients/${pid}`)}}
        />
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={()=>setShowCreate(false)}>
          <form onSubmit={handleCreate} onClick={e=>e.stopPropagation()} className="my-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">New Appointment {form.appointment_date && <span className="text-sm font-normal text-slate-500">· {format(new Date(form.appointment_date+'T00:00:00'),'dd MMM yyyy')} {form.appointment_time ? formatTime12(form.appointment_time):''}</span>}</h3><button type="button" onClick={()=>setShowCreate(false)} className="rounded p-1 hover:bg-slate-100"><X className="h-5 w-5"/></button></div>

            {/* Patient with search + quick create */}
            <div>
              <label className="block text-sm font-medium text-slate-700">Patient *</label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                <input value={patientSearch} onChange={e=>setPatientSearch(e.target.value)} placeholder="Search patient by name/phone..." className="w-full rounded border pl-9 pr-3 py-2 text-sm" />
              </div>
              <select value={form.patient_id} onChange={e=>setForm({...form, patient_id:e.target.value})} className="mt-2 w-full rounded border px-3 py-2 text-sm" required>
                <option value="">Select patient</option>
                {filteredPatients.map(p=> <option key={p.id} value={p.id}>{p.full_name} — {p.patient_id} {p.phone? `· ${p.phone}`:''}</option>)}
              </select>
              {!quickCreate ? (
                <button type="button" onClick={()=>setQuickCreate(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700"><UserPlus className="h-3.5 w-3.5"/> + Create New Patient</button>
              ) : (
                <div className="mt-3 rounded-lg border bg-slate-50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Quick Create Patient</p>
                  <input value={quickForm.full_name} onChange={e=>setQuickForm({...quickForm, full_name:e.target.value})} placeholder="Full name *" className="w-full rounded border px-3 py-2 text-sm" />
                  <input value={quickForm.phone} onChange={e=>setQuickForm({...quickForm, phone:e.target.value})} placeholder="Phone *" className="w-full rounded border px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <button type="button" onClick={handleQuickCreate} disabled={quickSaving} className="rounded bg-teal-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">{quickSaving? <Loader2 className="h-3 w-3 animate-spin inline"/> : 'Create & Select'}</button>
                    <button type="button" onClick={()=>setQuickCreate(false)} className="rounded border px-3 py-1.5 text-xs">Cancel</button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm">Date *<input type="date" min={format(new Date(),'yyyy-MM-dd')} value={form.appointment_date} onChange={e=>setForm({...form, appointment_date:e.target.value})} className="mt-1 w-full rounded border px-3 py-2 text-sm" required/></label>
              <label className="block text-sm">Time <span className="text-xs text-slate-400">({form.appointment_time ? formatTime12(form.appointment_time):'—'})</span><input type="time" value={form.appointment_time} onChange={e=>setForm({...form, appointment_time:e.target.value})} step="900" className="mt-1 w-full rounded border px-3 py-2 text-sm"/></label>
            </div>
            <label className="block text-sm">Title<input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Follow-up, Cleaning..." className="mt-1 w-full rounded border px-3 py-2 text-sm"/></label>
            <div>
              <label className="block text-sm">Location</label>
              <MasterSelect label="" value={form.location_id} onChange={v=>setForm({...form, location_id:v})} fetchFn={getLocations} createFn={createLocation} placeholder="Select location" />
            </div>
            <label className="block text-sm">Status<select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="mt-1 w-full rounded border px-3 py-2 text-sm"><option>Scheduled</option><option>Completed</option><option>Cancelled</option><option>No-Show</option></select></label>
            <label className="block text-sm">Notes<textarea value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} rows={2} className="mt-1 w-full rounded border px-3 py-2 text-sm"/></label>
            <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={()=>setShowCreate(false)} className="rounded border px-4 py-2 text-sm">Cancel</button><button type="submit" disabled={saving} className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Create'}</button></div>
          </form>
        </div>
      )}
    </div>
  )
}
