import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  FileText,
  FlaskConical,
  Paperclip,
  Pencil,
  Syringe,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CONSULTATION_FORMS } from '../lib/consultationForms'
import { getLabEntries, getSurgeryNotes } from '../lib/api'

const visitTypeStyles = {
  New: 'bg-blue-50 text-blue-700 ring-blue-200',
  'Follow-up': 'bg-purple-50 text-purple-700 ring-purple-200',
  Emergency: 'bg-rose-50 text-rose-700 ring-rose-200',
  'Routine Checkup': 'bg-slate-100 text-slate-700 ring-slate-200',
}

const paymentStyles = {
  Pending: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
  Partial: 'bg-orange-50 text-orange-700 ring-orange-200',
  Paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
}

function SessionCard({ session, followupSession, onEdit, onDeleteFile }) {
  const navigate = useNavigate()
  const [showTreatment, setShowTreatment] = useState(false)
  const [viewConsultationForm, setViewConsultationForm] = useState(null)
  const [labEntries, setLabEntries] = useState([])
  const [surgeryNotes, setSurgeryNotes] = useState('')
  const doctors = session.doctors || []
  const files = session.files || session.session_files || []
  const consultationForms = session.consultationForms || session.consultation_forms || []
  const hasLongTreatment = (session.treatment_given || '').length > 140
  const isEdited = isDifferentDateTime(session.created_at, session.updated_at)

  useEffect(() => {
    if (!session.id) return
    getLabEntries(session.id)
      .then(data => {
        const arr = Array.isArray(data) ? data : data?.data ?? data?.rows ?? []
        setLabEntries(arr)
      })
      .catch(() => setLabEntries([]))
  }, [session.id])

  // Surgery notes live in their own per-session record (read-only fetch)
  useEffect(() => {
    if (!session.id) return
    getSurgeryNotes(session.id)
      .then(data => {
        const record = data?.data ?? data?.surgery_notes ?? data
        const text = typeof record === 'string' ? record : record?.notes
        setSurgeryNotes(text ? String(text).trim() : '')
      })
      .catch(() => setSurgeryNotes(''))
  }, [session.id])

  const handleEdit = () => {
    if (onEdit) {
      onEdit(session.id)
      return
    }

    navigate(`/sessions/edit/${session.id}`)
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Calendar className="h-4 w-4 text-slate-400" />
              {formatDate(session.visit_date)}
            </span>
            <Badge
              className={
                visitTypeStyles[session.visit_type] ||
                'bg-slate-100 text-slate-700 ring-slate-200'
              }
            >
              {session.visit_type}
            </Badge>
            {session.injection_given && (
              <Badge className="bg-cyan-50 text-cyan-700 ring-cyan-200">
                <Syringe className="h-3 w-3" />
                Injection
              </Badge>
            )}
          </div>

          {session.followup_of && (
            <p className="mt-2 text-sm text-slate-500">
              Follow-up of{' '}
              <span className="font-medium text-purple-700">
                {followupSession ? formatDate(followupSession.visit_date) : 'previous visit'}
              </span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleEdit}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>

      {/* Session Vitals Display - supports both nested vitals and flat columns */}
      {(() => {
        const v = session.vitals || { age: session.age, weight: session.weight, blood_pressure: session.blood_pressure, blood_sugar: session.blood_sugar, pulse_rate: session.pulse_rate, spo2: session.spo2 }
        if (!v || !Object.values(v).some(x => x !== null && x !== '' && x !== undefined)) return null
        return (
          <div className="mt-4 flex flex-wrap gap-2">
            {v.age && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">Age: {v.age}y</span>}
            {v.weight && <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100">Wt: {v.weight}kg</span>}
            {v.blood_pressure && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100">BP: {v.blood_pressure}</span>}
            {v.blood_sugar && <span className="text-xs bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded-full border border-yellow-100">Sugar: {v.blood_sugar}mg/dL</span>}
            {v.pulse_rate && <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full border border-purple-100">Pulse: {v.pulse_rate}bpm</span>}
            {v.spo2 && <span className="text-xs bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full border border-teal-100">SPO2: {v.spo2}%</span>}
          </div>
        )
      })()}

      <div className="mt-5 space-y-4">
        <div>
          <h3 className="text-base font-semibold tracking-normal text-slate-950">
            {session.chief_complaint}
          </h3>
          {session.diagnosis && (
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Diagnosis:</span>{' '}
              {session.diagnosis}
            </p>
          )}
        </div>

        {session.treatment_given && (
          <div>
            <p
              className={`text-sm leading-6 text-slate-600 ${
                showTreatment ? '' : 'line-clamp-2'
              }`}
            >
              <span className="font-medium text-slate-800">Treatment:</span>{' '}
              {session.treatment_given}
            </p>
            {hasLongTreatment && (
              <button
                type="button"
                onClick={() => setShowTreatment((current) => !current)}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"
              >
                {showTreatment ? 'Show less' : 'Show more'}
                {showTreatment ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        )}

        <CollapsibleField label="Notes" text={session.notes} />
        <CollapsibleField label="Surgery Notes" text={surgeryNotes} />

        {doctors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {doctors.map((doctor) => (
              <span
                key={doctor.id}
                className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200">
                  <User className="h-3.5 w-3.5" />
                </span>
                {doctor.name}
                {doctor.specialty && (
                  <span className="font-normal text-slate-500">· {doctor.specialty}</span>
                )}
              </span>
            ))}
          </div>
        )}

        {session.chartEntries && session.chartEntries.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Dental Chart ({session.chartEntries.length} entr{session.chartEntries.length === 1 ? 'y' : 'ies'})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {session.chartEntries.map((entry, index) => (
                <span
                  key={entry.id || index}
                  className="inline-flex items-center bg-blue-50 text-blue-700 border border-blue-100 text-xs px-2.5 py-1 rounded-full">
                  <span className="font-medium">{entry.region}</span>
                  {entry.tooth_number && (
                    <span className="ml-1 text-blue-500">#{entry.tooth_number}</span>
                  )}
                  <span className="mx-1 text-blue-300">·</span>
                  <span>{entry.procedure_done}</span>
                  {entry.notes && (
                    <span className="ml-1 text-blue-400 italic">({entry.notes})</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              <Paperclip className="inline h-3 w-3 mr-1" />
              Documents ({files.length})
            </p>
            <div className="space-y-1.5">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-700">
                      {file.file_name}
                    </p>
                    {file.uploaded_at && (
                      <p className="text-xs text-slate-400">
                        {formatDate(file.uploaded_at)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                      <button
                      type="button"
                      onClick={() => window.open(file.download_url || file.file_url || file.url, '_blank', 'noopener,noreferrer')}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-teal-700 transition hover:bg-teal-50"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </button>
                    {onDeleteFile && (
                      <button
                        type="button"
                        onClick={() => onDeleteFile(file)}
                        className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {consultationForms.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              <FileText className="inline h-3 w-3 mr-1" />
              Consultation Forms ({consultationForms.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {consultationForms.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => {
                    const matchingForm = CONSULTATION_FORMS.find((f) => f.id === record.form_type)
                    setViewConsultationForm({ ...record, pdfFile: matchingForm?.file })
                  }}
                  className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs px-2.5 py-1.5 rounded-full hover:bg-emerald-100 transition cursor-pointer"
                >
                  <img
                    src={record.signature_url}
                    alt="sig"
                    className="h-5 w-5 rounded-full border border-emerald-200 object-cover"
                  />
                  <span className="font-medium">{record.form_label}</span>
                  <Eye className="h-3 w-3 text-emerald-500" />
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Read-only consultation form modal */}
        {viewConsultationForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewConsultationForm(null)}>
            <div className="relative w-full max-w-4xl max-h-[95vh] overflow-y-auto rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 rounded-t-xl">
                <h3 className="text-lg font-semibold text-slate-900">
                  {viewConsultationForm.form_label}
                </h3>
                <button
                  type="button"
                  onClick={() => setViewConsultationForm(null)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                {viewConsultationForm.pdfFile && (
                  <iframe
                    src={viewConsultationForm.pdfFile}
                    style={{ width: '100%', height: '70vh', border: 'none' }}
                    title={viewConsultationForm.form_label}
                  />
                )}

                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Patient Signature</p>
                  <img
                    src={viewConsultationForm.signature_url}
                    alt="Patient signature"
                    className="max-h-40 rounded-lg border border-slate-200"
                  />
                </div>
              </div>
              <div className="sticky bottom-0 flex items-center justify-end border-t border-slate-200 bg-white px-6 py-4 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setViewConsultationForm(null)}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {labEntries.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <FlaskConical className="h-4 w-4 text-sky-500" />
              Lab Entries ({labEntries.length})
              <span className="text-xs font-normal text-slate-500">Total: ₹{labEntries.reduce((s, e) => s + (Number(e.cost) || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-2.5 py-1.5">Lab / Vendor</th>
                    <th className="px-2.5 py-1.5">Test</th>
                    <th className="px-2.5 py-1.5 text-right">Cost</th>
                    <th className="px-2.5 py-1.5">Date</th>
                    <th className="px-2.5 py-1.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {labEntries.map((entry) => (
                    <tr key={entry.id} className="bg-white">
                      <td className="px-2.5 py-1.5 font-medium text-slate-700">{entry.lab_vendor_name || '-'}</td>
                      <td className="px-2.5 py-1.5 text-slate-700">{entry.test_name}</td>
                      <td className="px-2.5 py-1.5 text-right font-medium text-slate-900">₹{formatMoney(entry.cost)}</td>
                      <td className="px-2.5 py-1.5 text-slate-500">{entry.entry_date ? format(parseISO(String(entry.entry_date).split('T')[0]), 'dd MMM yyyy') : '-'}</td>
                      <td className="max-w-[150px] truncate px-2.5 py-1.5 text-slate-500">{entry.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 px-4 py-3 text-sm text-slate-700">
          <span>Treatment Cost ₹{formatMoney(session.treatment_cost)}</span>
          <span className="hidden h-4 w-px bg-slate-200 sm:block" />
          <span>Paid ₹{formatMoney(session.amount_paid)}</span>
          <Badge
            className={
              paymentStyles[session.payment_status] ||
              'bg-slate-100 text-slate-700 ring-slate-200'
            }
          >
            {session.payment_status}
          </Badge>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          {session.next_visit_date && (
            <p className="text-sm font-medium text-teal-700">
              Next appointment: {formatDate(session.next_visit_date)}
            </p>
          )}
        </div>

        {isEdited && (
          <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
            Last updated: {formatDate(session.updated_at)}
          </p>
        )}
      </div>
    </article>
  )
}

function CollapsibleField({ label, text }) {
  const [expanded, setExpanded] = useState(false)
  const value = (text || '').trim()
  if (!value) return null
  const isLong = value.length > 140
  return (
    <div>
      <p className={`text-sm leading-6 text-slate-600 ${expanded ? '' : 'line-clamp-2'}`}>
        <span className="font-medium text-slate-800">{label}:</span> {value}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"
        >
          {expanded ? 'Show less' : 'Show more'}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  )
}

function Badge({ className, children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${className}`}
    >
      {children}
    </span>
  )
}

function formatDate(dateValue) {
  if (!dateValue) return '-'
  return format(parseISO(dateValue), 'dd MMM yyyy')
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })
}

function isDifferentDateTime(createdAt, updatedAt) {
  if (!createdAt || !updatedAt) return false
  return new Date(createdAt).getTime() !== new Date(updatedAt).getTime()
}

export default SessionCard
