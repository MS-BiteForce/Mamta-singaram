/* eslint-disable no-unused-vars, no-undef */
import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Check,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Trash2,
  X,
} from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { CONSULTATION_FORMS } from '../lib/consultationForms'
import MasterSelect from '../components/MasterSelect'
import LabEntryForm from '../components/LabEntryForm'
import SessionConsentSection from '../components/SessionConsentSection'
import FileUpload from '../components/FileUpload'
import {
  getSession,
  getPatient,
  getDoctors,
  updateSession,
  deleteSession,
  getSessionFiles,
  deleteSessionFile,
  getConsultationForms,
  deleteConsultationForm,
  getLocations,
  createLocation,
  getFacialBones,
  createFacialBone,
  getSurgeryNotes,
  upsertSurgeryNotes,
  deleteSurgeryNotes,
  getSurgeryForms,
  getSessionSurgeryForms,
  linkSurgeryForm,
  unlinkSurgeryForm,
} from '../lib/api'

const emptyChartForm = {
  region: 'Upper Jaw',
  tooth_number: '',
  procedure_done: '',
  notes: '',
}

function EditSession() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [patientId, setPatientId] = useState(null)
  const [patientName, setPatientName] = useState('')
  const [visitDate, setVisitDate] = useState('')
  const [visitType, setVisitType] = useState('New')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [treatmentGiven, setTreatmentGiven] = useState('')
  const [injectionGiven, setInjectionGiven] = useState(false)
  const [injectionDetails, setInjectionDetails] = useState('')
  const [treatmentCost, setTreatmentCost] = useState('')
  const [amountPaid, setAmountPaid] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('Pending')
  const [notes, setNotes] = useState('')
  const [nextVisitDate, setNextVisitDate] = useState('')
  const [chartEntries, setChartEntries] = useState([])
  const [chartForm, setChartForm] = useState(emptyChartForm)
  const [allDoctors, setAllDoctors] = useState([])
  const [selectedDoctors, setSelectedDoctors] = useState([])

  const [locationId, setLocationId] = useState('')
  const [locationNameSnapshot, setLocationNameSnapshot] = useState('')
  const [surgeryNotes, setSurgeryNotes] = useState('')
  const [facialBoneId, setFacialBoneId] = useState('')
  const [facialBoneNameSnapshot, setFacialBoneNameSnapshot] = useState('')
  const [surgeryForms, setSurgeryForms] = useState([])
  const [linkedForms, setLinkedForms] = useState([])
  const [availableForms, setAvailableForms] = useState([])
  const [linkingForm, setLinkingForm] = useState(false)

  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [bloodPressure, setBloodPressure] = useState('')
  const [bloodSugar, setBloodSugar] = useState('')
  const [pulseRate, setPulseRate] = useState('')
  const [spo2, setSpo2] = useState('')

  const [sessionFiles, setSessionFiles] = useState([])
  const fileUploadRef = useRef(null)
  const [deletingFileId, setDeletingFileId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // ── Consultation Forms state ──
  const [savedConsultationForms, setSavedConsultationForms] = useState([])
  const [pendingConsultationForms, setPendingConsultationForms] = useState([])
  const [consultationModalForm, setConsultationModalForm] = useState(null)
  const [modalHasRead, setModalHasRead] = useState(false)
  const [viewConsultationForm, setViewConsultationForm] = useState(null)
  const [deletingConsultationId, setDeletingConsultationId] = useState(null)
  const [saving, setSaving] = useState(false)

  // Modal action handlers to prevent implicit form submits
  const handleModalCancel = (event) => {
    if (event && event.preventDefault) event.preventDefault()
    if (event && event.stopPropagation) event.stopPropagation()
    setConsultationModalForm(null)
  }

  const handleConfirmAttach = (event) => {
    if (event && event.preventDefault) event.preventDefault()
    if (event && event.stopPropagation) event.stopPropagation()

    if (!modalHasRead) return

    setPendingConsultationForms((prev) => [
      ...prev,
      {
        formId: consultationModalForm.id,
        formLabel: consultationModalForm.label,
      },
    ])
    setConsultationModalForm(null)
  }

  useEffect(() => {
    const loadAll = async () => {
      try {
        const sessionData = await getSession(sessionId)
        const session = sessionData?.session ?? sessionData?.data ?? sessionData
        if (!session || (!session.id && !session.patient_id)) {
          console.error('Session not found:', sessionId, sessionData)
          setLoading(false)
          return
        }

        const sid = session.id || sessionId
        setPatientId(session.patient_id)
        setVisitDate(formatInputDate(session.visit_date))
        setVisitType(session.visit_type || 'New')
        setChiefComplaint(session.chief_complaint || '')
        setDiagnosis(session.diagnosis || '')
        setTreatmentGiven(session.treatment_given || '')
        setInjectionGiven(session.injection_given || false)
        setInjectionDetails(session.injection_details || '')
        setTreatmentCost(String(session.treatment_cost ?? ''))
        setAmountPaid(String(session.amount_paid ?? ''))
        setPaymentStatus(session.payment_status || 'Pending')
        setNotes(session.notes || '')
        setNextVisitDate(formatInputDate(session.next_visit_date))
        setLocationId(session.location_id || '')
        setLocationNameSnapshot(session.location_name || '')
        // Fetch surgery notes (dedicated per-session)
        try {
          const snRes = await getSurgeryNotes(sid)
          const sn = snRes?.data ?? snRes?.surgery_notes ?? snRes
          // handle array vs object
          const snObj = Array.isArray(sn) ? sn[0] : sn
          if (snObj && (snObj.notes || snObj.facial_bone_id || snObj.facial_bone_name)) {
            setSurgeryNotes(snObj.notes || '')
            setFacialBoneId(snObj.facial_bone_id || '')
            setFacialBoneNameSnapshot(snObj.facial_bone_name || snObj.facialBoneName || '')
          } else if (snObj && typeof snObj === 'object' && snObj.notes !== undefined) {
            setSurgeryNotes(snObj.notes || '')
            setFacialBoneId(snObj.facial_bone_id || '')
            setFacialBoneNameSnapshot(snObj.facial_bone_name || '')
          }
        } catch (e) {
          void e
        }

        // Fetch surgery forms (available + linked)
        try {
          const [allForms, linkedRes] = await Promise.all([
            getSurgeryForms(true),
            getSessionSurgeryForms(sid)
          ])
          const formsArr = Array.isArray(allForms) ? allForms : allForms?.data ?? []
          const linkedArr = Array.isArray(linkedRes) ? linkedRes : linkedRes?.data ?? []
          setSurgeryForms(formsArr)
          setLinkedForms(linkedArr)
          const linkedIds = new Set(linkedArr.map(f => f.surgery_form_id))
          setAvailableForms(formsArr.filter(f => !linkedIds.has(f.id)))
        } catch {
          setSurgeryForms([])
          setLinkedForms([])
          setAvailableForms([])
        }

        // Handle both nested vitals and flat columns
        if (session.vitals) {
          setAge(session.vitals.age != null ? String(session.vitals.age) : '')
          setWeight(session.vitals.weight != null ? String(session.vitals.weight) : '')
          setBloodPressure(session.vitals.blood_pressure || '')
          setBloodSugar(session.vitals.blood_sugar != null ? String(session.vitals.blood_sugar) : '')
          setPulseRate(session.vitals.pulse_rate != null ? String(session.vitals.pulse_rate) : '')
          setSpo2(session.vitals.spo2 != null ? String(session.vitals.spo2) : '')
        } else {
          setAge(session.age != null ? String(session.age) : '')
          setWeight(session.weight != null ? String(session.weight) : '')
          setBloodPressure(session.blood_pressure || '')
          setBloodSugar(session.blood_sugar != null ? String(session.blood_sugar) : '')
          setPulseRate(session.pulse_rate != null ? String(session.pulse_rate) : '')
          setSpo2(session.spo2 != null ? String(session.spo2) : '')
        }

        // Patient name
        try {
          const patientRes = await getPatient(session.patient_id)
          const p = patientRes?.patient ?? patientRes?.data ?? patientRes
          setPatientName(p?.full_name || '')
        } catch (e) {
          console.error('Patient name load error:', e)
        }

        // Chart entries and doctors may be embedded in session response
        const embeddedCharts = session.dental_chart_entries ?? session.chart_entries ?? session.chartEntries ?? null
        const embeddedDoctors = session.doctors ?? session.session_doctors ?? null

        if (Array.isArray(embeddedCharts)) {
          setChartEntries(
            embeddedCharts.map((c) => ({
              id: c.id,
              tempId: c.id,
              region: c.region,
              tooth_number: c.tooth_number ?? null,
              procedure_done: c.procedure_done,
              notes: c.notes ?? null,
            })),
          )
        }

        if (Array.isArray(embeddedDoctors)) {
          // doctors may be array of ids or objects with doctor_id/id
          const ids = embeddedDoctors.map((d) => {
            if (typeof d === 'string') return d
            return d.doctor_id ?? d.id ?? d.doctorId
          }).filter(Boolean)
          setSelectedDoctors(ids)
        }

        // Load all active doctors
        try {
          const doctorsRes = await getDoctors(true)
          const list = Array.isArray(doctorsRes) ? doctorsRes : (doctorsRes?.data ?? doctorsRes?.doctors ?? [])
          setAllDoctors(list.map((d) => ({ id: d.id, ...d })))
        } catch (e) {
          console.error('Doctors load error:', e)
        }

        // If not embedded, chart entries / doctors are loaded via session already; otherwise fetch separately would duplicate.
        // No separate fetch needed; backend handles transaction.

        // Load existing session files
        try {
          const filesRes = await getSessionFiles(sid)
          const filesList = Array.isArray(filesRes) ? filesRes : (filesRes?.data ?? filesRes?.files ?? [])
          setSessionFiles(filesList.map((f) => ({ id: f.id, ...f })))
        } catch (e) {
          console.error('Session files load error:', e)
        }

        // Load existing consultation form records
        try {
          const cfRes = await getConsultationForms(sid)
          const cfList = Array.isArray(cfRes) ? cfRes : (cfRes?.data ?? cfRes?.consultation_forms ?? [])
          setSavedConsultationForms(cfList)
        } catch (e) {
          console.error('Consultation forms load error:', e)
        }
      } catch (loadError) {
        console.error('Session load error:', loadError)
        showToast(loadError.message || 'Unable to load session.', 'error')
      } finally {
        setLoading(false)
      }
    }

    Promise.resolve().then(loadAll)
  }, [sessionId, showToast])

  useEffect(() => {
    const cost = Number.parseFloat(treatmentCost) || 0
    const paid = Number.parseFloat(amountPaid) || 0

    let nextStatus = 'Partial'
    if (cost === 0) {
      nextStatus = 'Paid'
    } else if (paid <= 0) {
      nextStatus = 'Pending'
    } else if (paid >= cost) {
      nextStatus = 'Paid'
    }

    const timer = window.setTimeout(() => setPaymentStatus(nextStatus), 0)
    return () => window.clearTimeout(timer)
  }, [treatmentCost, amountPaid])

  const addChartEntry = () => {
    if (!chartForm.procedure_done.trim()) return

    const entry = {
      tempId: Date.now(),
      region: chartForm.region,
      tooth_number: chartForm.tooth_number.trim() || null,
      procedure_done: chartForm.procedure_done.trim(),
      notes: chartForm.notes.trim() || null,
    }

    setChartEntries((previousEntries) => [...previousEntries, entry])
    setChartForm(emptyChartForm)
  }

  const toggleDoctor = (doctorId) => {
    setSelectedDoctors((previousDoctors) =>
      previousDoctors.includes(doctorId)
        ? previousDoctors.filter((id) => id !== doctorId)
        : [...previousDoctors, doctorId],
    )
  }

  const handleUpdate = async () => {
    if (saving) return
    if (!chiefComplaint.trim()) {
      window.alert('Chief complaint is required')
      return
    }
    if (sessionFiles.length === 0 && (!fileUploadRef.current || !fileUploadRef.current.hasPending())) {
      showToast('Upload Photos is required — please add at least one photo/document.', 'warning')
      return
    }

    setSaving(true)
    const entriesToSave = [...chartEntries]
    const doctorsToSave = [...selectedDoctors]
    console.log('[EditSession] Update - chart entries:', entriesToSave.length)

    try {
      const payload = {
        visit_date: visitDate,
        visit_type: visitType,
        chief_complaint: chiefComplaint.trim(),
        diagnosis: diagnosis.trim(),
        treatment_given: treatmentGiven.trim(),
        injection_given: injectionGiven,
        injection_details: injectionGiven ? injectionDetails.trim() : '',
        treatment_cost: Math.round((Number.parseFloat(treatmentCost) || 0) * 100) / 100 || 0,
        amount_paid: Math.round((Number.parseFloat(amountPaid) || 0) * 100) / 100 || 0,
        payment_status: paymentStatus,
        notes: notes.trim(),
        next_visit_date: nextVisitDate || null,
        age: age ? parseInt(age) : null,
        weight: weight ? parseFloat(weight) : null,
        blood_pressure: bloodPressure.trim() || null,
        blood_sugar: bloodSugar ? parseFloat(bloodSugar) : null,
        pulse_rate: pulseRate ? parseInt(pulseRate) : null,
        spo2: spo2 ? parseInt(spo2) : null,
        location_id: locationId || null,
        doctors: doctorsToSave,
        chart_entries: entriesToSave.map((entry) => ({
          region: entry.region,
          tooth_number: entry.tooth_number || null,
          procedure_done: entry.procedure_done,
          notes: entry.notes || null,
        })),
      }

      await updateSession(sessionId, payload)
      console.log('[EditSession] Session updated successfully via REST API')

      // Upload pending files if any are selected
      if (fileUploadRef.current && fileUploadRef.current.hasPending()) {
        try {
          const { success } = await fileUploadRef.current.uploadAll(sessionId)

          if (!success) {
            showToast(
              'Session updated, but some document uploads failed. Click Update Session again to retry.',
              'warning',
            )
            return
          }

          // Reload documents from backend
          const filesRes = await getSessionFiles(sessionId)
          const filesList = Array.isArray(filesRes) ? filesRes : (filesRes?.data ?? filesRes?.files ?? [])
          setSessionFiles(filesList.map((f) => ({ id: f.id, ...f })))
        } catch (uploadErr) {
          console.error('File upload error:', uploadErr)
          showToast(
            'Session updated, but document upload encountered an error. Click Update Session again to retry.',
            'warning',
          )
          return
        }
      }

      // Save new consultation form acknowledgements if any are attached
      if (pendingConsultationForms.length > 0) {
        try {
          let formsToUpload = [...pendingConsultationForms]
          const MAX_SYNC_ATTEMPTS = 3

          for (let syncAttempt = 1; syncAttempt <= MAX_SYNC_ATTEMPTS; syncAttempt += 1) {
            const results = await Promise.allSettled(
              formsToUpload.map(async (item) => {
                await createConsultationForm(sessionId, {
                  form_type: item.formId,
                  form_label: item.formLabel,
                  acknowledged: true,
                })
              }),
            )

            const failedForms = []
            const succeededForms = []

            results.forEach((result, index) => {
              if (result.status === 'fulfilled') {
                succeededForms.push(formsToUpload[index])
              } else {
                failedForms.push(formsToUpload[index])
              }
            })

            formsToUpload = failedForms

            if (formsToUpload.length === 0) {
              setPendingConsultationForms([])
              break
            }

            if (syncAttempt < MAX_SYNC_ATTEMPTS) {
              await new Promise((resolve) => setTimeout(resolve, 400 * syncAttempt))
            }
          }

          if (formsToUpload.length > 0) {
            setPendingConsultationForms(formsToUpload)
            showToast(
              'Unable to sync some consultation acknowledgements to backend. Please check network and click Update Session once more.',
              'warning',
            )
            return
          }

          // Refresh saved consultation forms list
          try {
            const cfRes = await getConsultationForms(sessionId)
            const cfList = Array.isArray(cfRes) ? cfRes : (cfRes?.data ?? cfRes?.consultation_forms ?? [])
            setSavedConsultationForms(cfList)
          } catch (cfFetchErr) {
            console.error('Failed to refresh consultation forms:', cfFetchErr)
          }
        } catch (cfErr) {
          console.error('Consultation form upload error:', cfErr)
          showToast(
            'Consultation form sync failed unexpectedly. Please click Update Session once more.',
            'warning',
          )
          return
        }
      }

      // Surgery notes upsert / delete (dedicated per-session)
      if (surgeryNotes.trim() || facialBoneId) {
        try { await upsertSurgeryNotes(sessionId, { notes: surgeryNotes.trim(), facial_bone_id: facialBoneId || null }) } catch(e){ console.error(e); showToast(e.message,'warning') }
      } else {
        // Both empty -> attempt delete if existing record
        try { await deleteSurgeryNotes(sessionId) } catch (e) { void e }
      }

      showToast('Session updated successfully.', 'success')
      window.setTimeout(() => navigate(`/patients/${patientId}`), 700)
    } catch (error) {
      console.error('Update error:', error)
      showToast(error.message || 'Failed to update session.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this session permanently? This cannot be undone.')) {
      return
    }

    try {
      await deleteSession(sessionId)
      showToast('Session deleted!', 'success')
      navigate(`/patients/${patientId}`)
    } catch (error) {
      console.error('Delete error:', error)
      showToast(error.message || 'Failed to delete session.', 'error')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 -mt-4 flex flex-wrap items-center justify-between gap-2 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 shrink-0">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-100" />
          <div className="flex gap-2">
            <div className="h-8 w-20 animate-pulse rounded bg-slate-100" />
            <div className="h-8 w-32 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
        <div className="py-6 space-y-4">
          <div className="mx-auto max-w-4xl space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-xl border bg-white p-4 shadow-sm">
                <div className="h-5 w-32 rounded bg-slate-100" />
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="h-10 rounded bg-slate-50" />
                  <div className="h-10 rounded bg-slate-50" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50">
      {/* Sticky top bar - Sticks to the top of AppLayout's main scroll container */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 -mt-4 px-4 sm:px-6 py-3 bg-white border-b border-gray-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <h1 className="text-lg font-bold text-slate-900 truncate max-w-[200px] sm:max-w-none">
            Edit Session — {patientName}
          </h1>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleDelete}
            className="rounded border border-red-400 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition"
            disabled={saving}
          >
            Delete
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={saving}
            className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Session'}
          </button>
        </div>
      </div>

      {/* Form content - Scrolls with AppLayout's primary scrollbar */}
      <div className="py-6 pb-16 space-y-4">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="mb-4 rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-semibold">Visit Info</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-gray-600">
                Visit Date
                <input
                  type="date"
                  value={visitDate}
                  onChange={(event) => setVisitDate(event.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-600">
                Visit Type
                <select
                  value={visitType}
                  onChange={(event) => setVisitType(event.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                >
                  <option>New</option>
                  <option>Follow-up</option>
                  <option>Emergency</option>
                  <option>Routine Checkup</option>
                </select>
              </label>
            </div>
            <div className="mt-3">
              <MasterSelect label="Location" value={locationId} onChange={setLocationId} fetchFn={getLocations} createFn={createLocation} placeholder="Select location" currentValueLabel={locationNameSnapshot} />
            </div>
          </div>

          <div className="mb-4 rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-semibold">Vital Signs</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <label className="text-sm text-gray-600">
                Age (years)
                <input
                  type="number" min="0" max="120"
                  placeholder="e.g. 35"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-600">
                Weight (kg)
                <input
                  type="number" min="0" step="any"
                  placeholder="e.g. 70"
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-600">
                Blood Pressure
                <input
                  type="text"
                  placeholder="e.g. 120/80 mmHg"
                  value={bloodPressure}
                  onChange={e => setBloodPressure(e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-600">
                Blood Sugar (mg/dL)
                <input
                  type="number" min="0" step="any"
                  placeholder="e.g. 110"
                  value={bloodSugar}
                  onChange={e => setBloodSugar(e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-600">
                Pulse Rate (bpm)
                <input
                  type="number" min="0" step="1"
                  placeholder="e.g. 72"
                  value={pulseRate}
                  onChange={e => setPulseRate(e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-600">
                SPO2 (%)
                <input
                  type="number" min="0" max="100" step="any"
                  placeholder="e.g. 98"
                  value={spo2}
                  onChange={e => setSpo2(e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
            </div>
          </div>

          <div className="mb-4 rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-semibold">Clinical Notes</h2>
            <div className="space-y-3">
              <label className="block text-sm text-gray-600">
                Chief Complaint *
                <input
                  value={chiefComplaint}
                  onChange={(event) => setChiefComplaint(event.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                  placeholder="Main reason for visit"
                />
              </label>
              <label className="block text-sm text-gray-600">
                Diagnosis
                <textarea
                  value={diagnosis}
                  onChange={(event) => setDiagnosis(event.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                  rows="2"
                />
              </label>
              <label className="block text-sm text-gray-600">
                Treatment Given
                <textarea
                  value={treatmentGiven}
                  onChange={(event) => setTreatmentGiven(event.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                  rows="2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={injectionGiven}
                  onChange={(event) => setInjectionGiven(event.target.checked)}
                />
                Injection Given
              </label>
              {injectionGiven && (
                <input
                  value={injectionDetails}
                  onChange={(event) => setInjectionDetails(event.target.value)}
                  className="w-full rounded border px-3 py-2"
                  placeholder="Injection details"
                />
              )}
            </div>
          </div>

          <div className="mb-4 rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-semibold">Surgery Notes</h2>
            <p className="mb-3 text-sm text-gray-600">Dedicated surgery notes preserved per session. Historical facial bone selection remains even if master changes.</p>
            <MasterSelect label="Facial Bone" value={facialBoneId} onChange={setFacialBoneId} fetchFn={getFacialBones} createFn={createFacialBone} placeholder="Select facial bone" currentValueLabel={facialBoneNameSnapshot} />
            <label className="block mt-3 text-sm text-gray-600">
              Dedicated Surgery Notes
              <textarea value={surgeryNotes} onChange={e=>setSurgeryNotes(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" rows={3} placeholder="Dedicated surgery notes..." />
            </label>
          </div>

          {/* Surgery Forms — framework for future form submissions */}
          <div className="mb-4 rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-semibold">Surgery Forms</h2>
            {linkedForms.length === 0 && availableForms.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <FileText className="mx-auto h-6 w-6 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">No surgery forms available</p>
                <p className="mt-1 text-xs text-slate-400">Surgery forms will appear here once registered by the administrator.</p>
              </div>
            ) : (
              <>
                {linkedForms.length > 0 && (
                  <div className="mb-3 space-y-2">
                    <p className="text-xs font-medium uppercase text-slate-500">Linked Forms</p>
                    {linkedForms.map(link => (
                      <div key={link.id} className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50 p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-teal-900">{link.title}</p>
                          {link.form_description && <p className="mt-0.5 text-xs text-teal-700">{link.form_description}</p>}
                          <p className="mt-0.5 text-xs text-teal-600">Status: {link.status || 'draft'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {link.file_url && (
                            <a href={link.file_url} target="_blank" rel="noopener noreferrer" className="rounded p-1 text-teal-600 hover:bg-teal-100">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          <button type="button" onClick={async () => {
                            try {
                              await unlinkSurgeryForm(sessionId, link.id)
                              const linkedRes = await getSessionSurgeryForms(sessionId)
                              const linkedArr = Array.isArray(linkedRes) ? linkedRes : linkedRes?.data ?? []
                              setLinkedForms(linkedArr)
                              const linkedIds = new Set(linkedArr.map(f => f.surgery_form_id))
                              setAvailableForms(surgeryForms.filter(f => !linkedIds.has(f.id)))
                              showToast('Form unlinked', 'success')
                            } catch(e) { showToast(e.message, 'error') }
                          }} className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {availableForms.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-slate-500">Available Forms</p>
                    <div className="flex flex-wrap gap-2">
                      {availableForms.map(form => (
                        <button
                          key={form.id}
                          type="button"
                          disabled={linkingForm}
                          onClick={async () => {
                            setLinkingForm(true)
                            try {
                              await linkSurgeryForm(sessionId, { surgery_form_id: form.id })
                              const linkedRes = await getSessionSurgeryForms(sessionId)
                              const linkedArr = Array.isArray(linkedRes) ? linkedRes : linkedRes?.data ?? []
                              setLinkedForms(linkedArr)
                              const linkedIds = new Set(linkedArr.map(f => f.surgery_form_id))
                              setAvailableForms(surgeryForms.filter(f => !linkedIds.has(f.id)))
                              showToast('Form linked', 'success')
                            } catch(e) { showToast(e.message, 'error') }
                            finally { setLinkingForm(false) }
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {form.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mb-4 rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-semibold">Lab Entries</h2>
            <p className="mb-3 text-sm text-gray-600">Lab/vendor records linked to this session. Historical entries are preserved even if a lab is later deactivated.</p>
            <LabEntryForm sessionId={sessionId} patientId={patientId} />
          </div>

          <div className="mb-4 rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-semibold">Consent Forms</h2>
            <p className="mb-3 text-sm text-gray-600">Select the relevant consent form, open the PDF in a new tab, confirm patient name and acknowledge.</p>
            <SessionConsentSection sessionId={sessionId} patientName={patientName} />
          </div>

          <div className="mb-4 rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-semibold">Doctors</h2>
            <div className="flex flex-wrap gap-2">
              {allDoctors.map((doctor) => (
                <button
                  key={doctor.id}
                  type="button"
                  onClick={() => toggleDoctor(doctor.id)}
                  className={`rounded-full border px-3 py-2 text-sm transition ${
                    selectedDoctors.includes(doctor.id)
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  {doctor.name} · {doctor.specialty}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4 rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-semibold">Billing</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm text-gray-600">
                Treatment Cost ₹
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={treatmentCost}
                  onChange={(event) => setTreatmentCost(event.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-600">
                Amount Paid ₹
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={amountPaid}
                  onChange={(event) => setAmountPaid(event.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
              <div>
                <label className="mb-1 block text-sm text-gray-500">Payment Status</label>
                <span
                  className={`inline-block rounded-lg px-3 py-1.5 text-sm font-medium ${
                    paymentStatus === 'Paid'
                      ? 'bg-green-100 text-green-700'
                      : paymentStatus === 'Partial'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-600'
                  }`}
                >
                  {paymentStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-semibold">Additional Info</h2>
            <div className="space-y-3">
              <label className="block text-sm text-gray-600">
                Additional Notes
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                  rows="2"
                />
              </label>
              <label className="block text-sm text-gray-600">
                Next Visit Date
                <input
                  type="date"
                  value={nextVisitDate}
                  onChange={(event) => setNextVisitDate(event.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
            </div>
          </div>

          {/* ── Upload Photos (mandatory) ──────────────────────────────────── */}
          <div className="mb-6 rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-semibold">Upload Photos <span className="text-rose-600">*</span></h2>
            <FileUpload
              ref={fileUploadRef}
              required
              showExistingFiles
              existingFiles={sessionFiles}
              deletingFileId={deletingFileId}
              confirmDeleteId={confirmDeleteId}
              onOpenFile={(file) => window.open(file.file_url || file.download_url, '_blank', 'noopener,noreferrer')}
              onDeleteFile={async (file) => {
                try {
                  setDeletingFileId(file.id)
                  await deleteSessionFile(file.id)
                  setSessionFiles((prev) => prev.filter((f) => f.id !== file.id))
                  showToast('File deleted', 'success')
                } catch (err) {
                  console.error('Delete error:', err)
                  showToast('Failed to delete file', 'error')
                } finally {
                  setDeletingFileId(null)
                  setConfirmDeleteId(null)
                }
              }}
              onConfirmDelete={(fileId) => setConfirmDeleteId(fileId)}
              onCancelDelete={() => setConfirmDeleteId(null)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function formatInputDate(dateValue) {
  if (!dateValue) return ''
  if (dateValue?.toDate) return dateValue.toDate().toISOString().split('T')[0]
  return String(dateValue).split('T')[0]
}

export default EditSession
