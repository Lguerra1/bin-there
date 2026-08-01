import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

const WorkspaceContext = createContext(null)

/**
 * Loads the signed in user's membership. A user with no membership row -- a
 * fresh account that has not redeemed an invite -- gets workspace: null, which
 * the app renders as a "no access" screen.
 */
export function WorkspaceProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState({ loading: true, workspace: null, role: null })

  useEffect(() => {
    if (!user) {
      setState({ loading: false, workspace: null, role: null })
      return
    }

    let cancelled = false

    supabase
      .from('memberships')
      .select('role, can_delete_bins, workspaces (id, name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setState({ loading: false, workspace: null, role: null })
          return
        }
        setState({
          loading: false,
          workspace: data.workspaces,
          role: data.role,
          canDeleteBins: data.can_delete_bins,
        })
      })

    return () => {
      cancelled = true
    }
  }, [user])

  const value = {
    ...state,
    canWrite: state.role === 'owner' || state.role === 'write',
    isOwner: state.role === 'owner',
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return ctx
}
