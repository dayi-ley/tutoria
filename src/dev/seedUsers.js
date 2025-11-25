import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'

export async function seedUsers(list) {
  if (!auth || !db) return { ok: false, error: 'Firebase no está configurado' }
  const created = []
  for (const u of list) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, u.email, u.password)
      const ref = doc(db, 'usuarios', cred.user.uid)
      await setDoc(ref, {
        email: cred.user.email || null,
        displayName: cred.user.displayName || null,
        photoURL: cred.user.photoURL || null,
        createdAt: serverTimestamp(),
        rol: u.role,
        estado: 'activo',
        providers: cred.user.providerData?.map((p) => p.providerId) || ['password'],
      })
      created.push({ email: u.email, role: u.role })
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  }
  await signOut(auth)
  return { ok: true, created }
}
