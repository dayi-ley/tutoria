import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'

export default function useAuth() {
  const hasAuth = Boolean(auth)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(hasAuth)

  useEffect(() => {
    if (!hasAuth) return
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return () => unsub()
  }, [hasAuth])

  return { user, loading }
}
