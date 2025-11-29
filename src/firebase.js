import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { createClient } from '@supabase/supabase-js'

let bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || ''
if (bucket && bucket.endsWith('.firebasestorage.app')) {
  bucket = bucket.replace('.firebasestorage.app', '.appspot.com')
}
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: bucket || `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
]

const ready = required.every((k) => Boolean(import.meta.env[k]))

let app
let auth
let db
let storage
let supabase
const storageProvider = (import.meta.env.VITE_STORAGE_PROVIDER || '').toLowerCase()

if (ready) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
  storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`)
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
}

export { auth, db, storage, supabase, storageProvider, ready as firebaseReady }
export const allowedDomain = import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN
export const allowedEmailSubstring = import.meta.env.VITE_ALLOWED_EMAIL_SUBSTRING
