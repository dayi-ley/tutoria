import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export async function ensureUserProfile(user) {
  try {
    if (!db || !user?.uid) return
    const ref = doc(db, 'usuarios', user.uid)
    const snap = await getDoc(ref)
    if (snap.exists()) return
    await setDoc(
      ref,
      {
        email: user.email || null,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        createdAt: serverTimestamp(),
        rol: 'estudiante',
        estado: 'activo',
        providers: user.providerData?.map((p) => p.providerId) || [],
        docenteTutorId: '',
        estudianteId: '',
      },
      { merge: true }
    )
  } catch (e) {
    console.error('ensureUserProfile error:', e?.code || e?.name, e?.message || String(e))
  }
}

export async function updateUserRole(uid, role) {
  if (!db || !uid) return
  const ref = doc(db, 'usuarios', uid)
  await setDoc(
    ref,
    {
      rol: role,
      docenteTutorId: role === 'docente' ? uid : '',
      estudianteId: role === 'estudiante' ? uid : '',
    },
    { merge: true }
  )
}

export async function provisionDocente(uid, profile) {
  if (!db || !uid) return
  const ref = doc(db, 'docentes', uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return
  const base = {
    email: profile?.email || null,
    nombres: profile?.nombres || profile?.displayName || null,
    apellidos: profile?.apellidos || null,
    telefono: profile?.telefono || null,
    createdAt: serverTimestamp(),
  }
  const aula = profile?.aula && typeof profile.aula === 'object' ? profile.aula : null
  await setDoc(ref, aula ? { ...base, aula } : base)
}
