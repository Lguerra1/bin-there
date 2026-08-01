import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // Where the user was headed before they hit the login wall -- usually a
  // scanned sticker at /box/a1b2c3.
  const returnTo = location.state?.from ?? '/'

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const { error: signInError } = await signIn(email.trim(), password)

    if (signInError) {
      setError(signInError.message)
      setBusy(false)
      return
    }
    navigate(returnTo, { replace: true })
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
      >
        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-50">BinThere</h1>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Sign in to see what is in your bins.
        </p>

        <label className="mt-5 block text-xs font-medium text-gray-600 dark:text-gray-400">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-400">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        {error && (
          <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
