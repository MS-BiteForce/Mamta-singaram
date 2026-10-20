const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  let res
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    })
  } catch (networkErr) {
    throw new Error(`Network error: ${networkErr.message}. Please check your connection and try again.`)
  }
  const text = await res.text()
  let data
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) {
    const serverMsg = data && typeof data === 'object' && data.error ? data.error : (data?.message || text || `Request failed ${res.status}`)
    throw new Error(`${serverMsg} (${res.status} ${url})`)
  }
  return data
}

// Patients
export function getPatients(search) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return request(`/api/patients${qs}`)
}
export function getPatient(id) { return request(`/api/patients/${id}`) }
export function createPatient(data) { return request('/api/patients', { method: 'POST', body: JSON.stringify(data) }) }
export function updatePatient(id, data) { return request(`/api/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deletePatient(id) { return request(`/api/patients/${id}`, { method: 'DELETE' }) }

// Doctors
export function getDoctors(isActive) {
  if (isActive === true) return request('/api/doctors?is_active=true')
  if (isActive === false) return request('/api/doctors?is_active=false')
  if (typeof isActive === 'string' && (isActive === 'true' || isActive === 'false')) return request(`/api/doctors?is_active=${isActive}`)
  return request('/api/doctors')
}
export function getDoctor(id) { return request(`/api/doctors/${id}`) }
export function createDoctor(data) { return request('/api/doctors', { method: 'POST', body: JSON.stringify(data) }) }
export function updateDoctor(id, data) { return request(`/api/doctors/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteDoctor(id) { return request(`/api/doctors/${id}`, { method: 'DELETE' }) }

// Sessions
export function getSessions(filters = {}) {
  const params = new URLSearchParams()
  if (filters.patient_id) params.set('patient_id', filters.patient_id)
  if (filters.payment_status) params.set('payment_status', filters.payment_status)
  if (filters.visit_date_from) params.set('visit_date_from', filters.visit_date_from)
  if (filters.visit_date_to) params.set('visit_date_to', filters.visit_date_to)
  if (filters.location_id) params.set('location_id', filters.location_id)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return request(`/api/sessions${qs}`)
}
export function getSession(id) { return request(`/api/sessions/${id}`) }
export function createSession(data) { return request('/api/sessions', { method: 'POST', body: JSON.stringify(data) }) }
export function updateSession(id, data) { return request(`/api/sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteSession(id) { return request(`/api/sessions/${id}`, { method: 'DELETE' }) }

// Session Doctors
export function getSessionDoctors(sessionId) { return request(`/api/sessions/${sessionId}/doctors`) }
export function addSessionDoctor(sessionId, doctorId) { return request(`/api/sessions/${sessionId}/doctors`, { method: 'POST', body: JSON.stringify({ doctor_id: doctorId }) }) }
export function removeSessionDoctor(sessionId, doctorId) { return request(`/api/sessions/${sessionId}/doctors/${doctorId}`, { method: 'DELETE' }) }

// Dental Chart
export function getChartEntries(sessionId) { return request(`/api/sessions/${sessionId}/chart`) }
export function addChartEntry(sessionId, data) { return request(`/api/sessions/${sessionId}/chart`, { method: 'POST', body: JSON.stringify(data) }) }
export function deleteChartEntry(sessionId, entryId) { return request(`/api/sessions/${sessionId}/chart/${entryId}`, { method: 'DELETE' }) }

// Consultation Forms
export function getConsultationForms(sessionId) { return request(`/api/sessions/${sessionId}/consultation-forms`) }
export function createConsultationForm(sessionId, data) { return request(`/api/sessions/${sessionId}/consultation-forms`, { method: 'POST', body: JSON.stringify(data) }) }
export function deleteConsultationForm(sessionId, formId) { return request(`/api/sessions/${sessionId}/consultation-forms/${formId}`, { method: 'DELETE' }) }

// Session Files (R2)
export function getSessionFiles(sessionId) { return request(`/api/sessions/${sessionId}/files`) }
export async function uploadSessionFile(sessionId, file, metadata = {}) {
  const form = new FormData()
  form.append('file', file)
  if (metadata.description) form.append('description', metadata.description)
  const url = `${BASE_URL}/api/sessions/${sessionId}/files`
  let res
  try {
    res = await fetch(url, { method: 'POST', body: form })
  } catch (networkErr) {
    throw new Error(`Upload failed: ${networkErr.message}. Please check your connection and try again.`)
  }
  const text = await res.text()
  let data
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) {
    const serverMsg = data && typeof data === 'object' && data.error ? data.error : `Upload failed ${res.status}`
    throw new Error(`${serverMsg} (${res.status} ${url})`)
  }
  return data
}
export function deleteSessionFile(fileId) { return request(`/api/files/${fileId}`, { method: 'DELETE' }) }

// Locations (master)
export function getLocations(isActive) {
  if (isActive === true) return request('/api/locations?is_active=true')
  if (isActive === false) return request('/api/locations?is_active=false')
  return request('/api/locations')
}
export function createLocation(data) { return request('/api/locations', { method: 'POST', body: JSON.stringify(data) }) }
export function updateLocation(id, data) { return request(`/api/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteLocation(id) { return request(`/api/locations/${id}`, { method: 'DELETE' }) }

// Lab Vendors (master)
export function getLabVendors(isActive) {
  if (isActive === true) return request('/api/lab-vendors?is_active=true')
  if (isActive === false) return request('/api/lab-vendors?is_active=false')
  return request('/api/lab-vendors')
}
export function createLabVendor(data) { return request('/api/lab-vendors', { method: 'POST', body: JSON.stringify(data) }) }
export function updateLabVendor(id, data) { return request(`/api/lab-vendors/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteLabVendor(id) { return request(`/api/lab-vendors/${id}`, { method: 'DELETE' }) }

// Facial Bones (master)
export function getFacialBones(isActive) {
  if (isActive === true) return request('/api/facial-bones?is_active=true')
  if (isActive === false) return request('/api/facial-bones?is_active=false')
  return request('/api/facial-bones')
}
export function createFacialBone(data) { return request('/api/facial-bones', { method: 'POST', body: JSON.stringify(data) }) }
export function updateFacialBone(id, data) { return request(`/api/facial-bones/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteFacialBone(id) { return request(`/api/facial-bones/${id}`, { method: 'DELETE' }) }

// Surgery Forms (framework)
export function getSurgeryForms(isActive) {
  if (isActive === true) return request('/api/surgery-forms?is_active=true')
  if (isActive === false) return request('/api/surgery-forms?is_active=false')
  return request('/api/surgery-forms')
}
export function createSurgeryForm(data) { return request('/api/surgery-forms', { method: 'POST', body: JSON.stringify(data) }) }
export function updateSurgeryForm(id, data) { return request(`/api/surgery-forms/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteSurgeryForm(id) { return request(`/api/surgery-forms/${id}`, { method: 'DELETE' }) }

// Appointments
export function getAppointments(filters = {}) {
  const p = new URLSearchParams()
  if (filters.patient_id) p.set('patient_id', filters.patient_id)
  if (filters.session_id) p.set('session_id', filters.session_id)
  if (filters.status) p.set('status', filters.status)
  if (filters.location_id) p.set('location_id', filters.location_id)
  if (filters.date_from) p.set('date_from', filters.date_from)
  if (filters.date_to) p.set('date_to', filters.date_to)
  const qs = p.toString() ? `?${p.toString()}` : ''
  return request(`/api/appointments${qs}`)
}
export function getAppointment(id) { return request(`/api/appointments/${id}`) }
export function createAppointment(data) { return request('/api/appointments', { method: 'POST', body: JSON.stringify(data) }) }
export function updateAppointment(id, data) { return request(`/api/appointments/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteAppointment(id) { return request(`/api/appointments/${id}`, { method: 'DELETE' }) }

// Surgery Notes (per session)
export function getSurgeryNotes(sessionId) { return request(`/api/sessions/${sessionId}/surgery-notes`) }
export function upsertSurgeryNotes(sessionId, data) { return request(`/api/sessions/${sessionId}/surgery-notes`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteSurgeryNotes(sessionId) { return request(`/api/sessions/${sessionId}/surgery-notes`, { method: 'DELETE' }) }

// Lab Entries (per session)
export function getLabEntries(sessionId) { return request(`/api/sessions/${sessionId}/lab-entries`) }
export function createLabEntry(sessionId, data) { return request(`/api/sessions/${sessionId}/lab-entries`, { method: 'POST', body: JSON.stringify(data) }) }
export function updateLabEntry(sessionId, entryId, data) { return request(`/api/sessions/${sessionId}/lab-entries/${entryId}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteLabEntry(sessionId, entryId) { return request(`/api/sessions/${sessionId}/lab-entries/${entryId}`, { method: 'DELETE' }) }

// Patient Lab Entries (all across sessions)
export function getPatientLabEntries(patientId) { return request(`/api/patients/${patientId}/lab-entries`) }

// Patient Ledger (financial history - immutable audit)
export function getPatientLedger(patientId, filters = {}) {
  const p = new URLSearchParams()
  if (filters.from) p.set('from', filters.from)
  if (filters.to) p.set('to', filters.to)
  const qs = p.toString() ? `?${p.toString()}` : ''
  return request(`/api/patients/${patientId}/ledger${qs}`)
}
export function createLedgerEntry(patientId, data) { return request(`/api/patients/${patientId}/ledger`, { method: 'POST', body: JSON.stringify(data) }) }
export function deleteLedgerEntry(patientId, entryId) { return request(`/api/patients/${patientId}/ledger/${entryId}`, { method: 'DELETE' }) }

// Session Surgery Forms (link)
export function getSessionSurgeryForms(sessionId) { return request(`/api/sessions/${sessionId}/surgery-forms`) }
export function linkSurgeryForm(sessionId, data) { return request(`/api/sessions/${sessionId}/surgery-forms`, { method: 'POST', body: JSON.stringify(data) }) }
export function unlinkSurgeryForm(sessionId, linkId) { return request(`/api/sessions/${sessionId}/surgery-forms/${linkId}`, { method: 'DELETE' }) }

// Payment Analytics
export function getPaymentAnalytics(filters = {}) {
  const p = new URLSearchParams()
  if (filters.from) p.set('from', filters.from)
  if (filters.to) p.set('to', filters.to)
  if (filters.location_id) p.set('location_id', filters.location_id)
  const qs = p.toString() ? `?${p.toString()}` : ''
  return request(`/api/payments/analytics${qs}`)
}
export function getPaymentSessions(filters = {}) {
  const p = new URLSearchParams()
  if (filters.from) p.set('from', filters.from)
  if (filters.to) p.set('to', filters.to)
  if (filters.location_id) p.set('location_id', filters.location_id)
  if (filters.status) p.set('status', filters.status)
  if (filters.search) p.set('search', filters.search)
  if (filters.limit) p.set('limit', String(filters.limit))
  if (filters.offset) p.set('offset', String(filters.offset))
  const qs = p.toString() ? `?${p.toString()}` : ''
  return request(`/api/payments/sessions${qs}`)
}

// Consent Forms
export function getConsentForms(isActive) {
  if (isActive === true) return request('/api/consent-forms?is_active=true')
  if (isActive === false) return request('/api/consent-forms?is_active=false')
  return request('/api/consent-forms')
}
export function getConsentForm(id) { return request(`/api/consent-forms/${id}`) }
export function createConsentForm(data) { return request('/api/consent-forms', { method: 'POST', body: JSON.stringify(data) }) }
export function updateConsentForm(id, data) { return request(`/api/consent-forms/${id}`, { method: 'PUT', body: JSON.stringify(data) }) }
export function deleteConsentForm(id) { return request(`/api/consent-forms/${id}`, { method: 'DELETE' }) }
export function getSessionConsentForms(sessionId) { return request(`/api/sessions/${sessionId}/consent-forms`) }
export function acknowledgeConsentForm(sessionId, data) { return request(`/api/sessions/${sessionId}/consent-forms`, { method: 'POST', body: JSON.stringify(data) }) }
export function deleteSessionConsentForm(sessionId, id) { return request(`/api/sessions/${sessionId}/consent-forms/${id}`, { method: 'DELETE' }) }

// Lab Management Portal
export function getLabSummary() { return request('/api/labs/summary') }
export function getLabOrders(filters={}){ const p=new URLSearchParams(); if(filters.lab_vendor_id) p.set('lab_vendor_id',filters.lab_vendor_id); if(filters.patient_search) p.set('patient_search',filters.patient_search); if(filters.status) p.set('status',filters.status); if(filters.from) p.set('from',filters.from); if(filters.to) p.set('to',filters.to); if(filters.limit) p.set('limit',String(filters.limit)); if(filters.offset) p.set('offset',String(filters.offset)); const qs=p.toString()?`?${p}`:''; return request(`/api/labs/orders${qs}`) }
export function markLabOrderPaid(id) { return request(`/api/labs/orders/${id}/pay`, { method: 'PUT' }) }
export function createLabOrder(data){ return request('/api/labs/orders',{method:'POST', body:JSON.stringify(data)}) }
export function getLabDetail(labId, filters = {}) {
  const p = new URLSearchParams()
  if (filters.from) p.set('from', filters.from)
  if (filters.to) p.set('to', filters.to)
  if (filters.status) p.set('status', filters.status)
  if (filters.patient_search) p.set('patient_search', filters.patient_search)
  if (filters.limit) p.set('limit', String(filters.limit))
  if (filters.offset) p.set('offset', String(filters.offset))
  const qs = p.toString() ? `?${p.toString()}` : ''
  return request(`/api/labs/${labId}${qs}`)
}

// Helpers kept for frontend compatibility
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}
export function validateSessionFile(file) {
  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']
  const MAX_SIZE_BYTES = 5242880
  if (!file) return { valid: false, message: 'No file selected.', error: 'No file selected.' }
  if (!ALLOWED_TYPES.includes(file.type)) {
    const msg = `Unsupported file type: ${file.type || 'unknown'}. Allowed: PDF, JPG, PNG, HEIC, HEIF.`
    return { valid: false, message: msg, error: msg }
  }
  if (file.size > MAX_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
    const msg = `File too large (${sizeMB} MB). Maximum file size is 5 MB.`
    return { valid: false, message: msg, error: msg }
  }
  return { valid: true, message: '', error: '' }
}
