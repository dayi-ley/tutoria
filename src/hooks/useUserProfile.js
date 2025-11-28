import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export default function useUserProfile(uid) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(Boolean(uid))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!db || !uid) return
    const ref = doc(db, 'usuarios', uid)
    const unsub = onSnapshot(ref, (snap) => {
      setProfile(snap.exists() ? snap.data() : null)
      setLoading(false)
      setError('')
    }, (err) => {
      setError(err?.message || String(err))
      setProfile(null)
      setLoading(false)
    })
    return () => unsub()
  }, [uid])

  return { profile, loading, error }
}
