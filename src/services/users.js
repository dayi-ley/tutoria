import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export async function ensureUserProfile(user) {
  if (!db || !user?.uid) return
  const ref = doc(db, 'usuarios', user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return
  await setDoc(ref, {
    email: user.email || null,
    displayName: user.displayName || null,
    photoURL: user.photoURL || null,
    createdAt: serverTimestamp(),
    rol: 'estudiante',
    estado: 'activo',
    providers: user.providerData?.map((p) => p.providerId) || [],
  })
}

export async function updateUserRole(uid, role) {
  if (!db || !uid) return
  const ref = doc(db, 'usuarios', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  await setDoc(ref, { ...snap.data(), rol: role }, { merge: true })
}
