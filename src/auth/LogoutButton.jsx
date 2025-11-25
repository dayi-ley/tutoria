import { signOut } from 'firebase/auth'
import { auth } from '../firebase'

export default function LogoutButton() {
  const click = () => {
    if (!auth) return
    signOut(auth)
  }
  return <button onClick={click} aria-label="Cerrar sesión">⎋ Salir</button>
}
