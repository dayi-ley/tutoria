import { doc, getDoc } from 'firebase/firestore'
import { db, allowedDomain, allowedEmailSubstring } from '../firebase'

export function isDomainAllowed(email) {
  if (!email) return false
  const lower = String(email).toLowerCase()
  const at = lower.lastIndexOf('@')
  if (at < 0) return false
  const domain = lower.slice(at + 1)
  if (allowedDomain) {
    return domain === String(allowedDomain).toLowerCase()
  }
  if (allowedEmailSubstring) {
    return domain.includes(String(allowedEmailSubstring).toLowerCase())
  }
  return true
}

export async function isDocenteAllowed(email) {
  if (!db || !email) return false
  const key = String(email).toLowerCase()
  const ref = doc(db, 'docentes_allowlist', key)
  const snap = await getDoc(ref)
  return snap.exists()
}
