import { doc, getDoc } from 'firebase/firestore'
import { db, allowedDomain, allowedEmailSubstring } from '../firebase'

export function isDomainAllowed(email) {
  if (!email) return false
  const lower = String(email).toLowerCase()
  const at = lower.lastIndexOf('@')
  if (at < 0) return false
  const domain = lower.slice(at + 1)
  const dom = allowedDomain ? String(allowedDomain).toLowerCase() : ''
  const sub = allowedEmailSubstring ? String(allowedEmailSubstring).toLowerCase() : ''
  if (dom && domain === dom) return true
  if (sub && domain.includes(sub)) return true
  if (dom || sub) return false
  return true
}

export async function isDocenteAllowed(email) {
  if (!db || !email) return false
  const key = String(email).toLowerCase()
  const ref = doc(db, 'docentes_allowlist', key)
  const snap = await getDoc(ref)
  return snap.exists()
}

export async function isOficinaAllowed(email) {
  if (!db || !email) return false
  const key = String(email).toLowerCase()
  const ref = doc(db, 'oficina_allowlist', key)
  const snap = await getDoc(ref)
  return snap.exists()
}
