import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useWorkspace } from '../lib/workspace'

/**
 * Sits outside the workspace guard on purpose: someone redeeming an invite has
 * no membership yet, so RequireWorkspace would bounce them to "no access".
 */
export default function AcceptInvite() {
  const { token } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { session, loading: authLoading } = useAuth()
  const { refresh, switchWorkspace } = useWorkspace()
  const [state, setState] = useState({ status: 'working', message: null })
  const attempted = useRef(false)

  useEffect(() => {
    if (authLoading || !session || attempted.current) return
    attempted.current = true

    supabase.rpc('redeem_invite', { invite_token: token }).then(({ data, error }) => {
      if (error) {
        setState({ status: 'error', message: error.message })
        return
      }
      // redeem_invite returns the workspace id, so land them in the household
      // they were invited to rather than whichever one happens to be first.
      refresh().then(() => {
        switchWorkspace(data)
        navigate('/', { replace: true })
      })
    })
  }, [authLoading, session, token, refresh, switchWorkspace, navigate])

  if (authLoading) return <Centered>Loading…</Centered>

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname, invite: true }} />
  }

  if (state.status === 'error') {
    return (
      <Centered>
        <p className="font-medium text-gray-900 dark:text-gray-100">Could not accept invite</p>
        <p className="mt-1">{state.message}</p>
        <p className="mt-3 text-xs text-gray-400">
          Signed in as {session.user.email}. An invite only works for the address it was sent to.
        </p>
      </Centered>
    )
  }

  return <Centered>Accepting invite…</Centered>
}

function Centered({ children }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-gray-50 p-6 text-center dark:bg-gray-950">
      <div className="max-w-xs text-sm text-gray-500 dark:text-gray-400">{children}</div>
    </div>
  )
}
