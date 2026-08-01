import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

const WorkspaceContext = createContext(null)
const ACTIVE_KEY = 'binthere.activeWorkspace'

/**
 * A user can belong to several households: their own, plus any they were
 * invited to. This holds every membership and tracks which one is active, so
 * the rest of the app can stay single-workspace in its thinking.
 *
 * A user with no membership at all -- a fresh account that has not redeemed an
 * invite -- gets workspace: null, which renders as the "no access" screen.
 */
export function WorkspaceProvider({ children }) {
  const { user, loading: authLoading } = useAuth()
  const [memberships, setMemberships] = useState([])
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY))
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    // Stay in the loading state until auth has resolved. Otherwise a page
    // refresh briefly reports "no memberships" -- true only because the session
    // has not been restored yet -- and the app flashes the no-household screen.
    if (authLoading) return

    if (!user) {
      setMemberships([])
      setLoading(false)
      return
    }

    setLoading(true)

    const { data, error } = await supabase
      .from('memberships')
      .select('role, can_delete_bins, workspaces (id, name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    setMemberships(error ? [] : (data ?? []).filter((m) => m.workspaces))
    setLoading(false)
  }, [user, authLoading])

  useEffect(() => {
    load()
  }, [load])

  // Fall back to the first membership if the stored one is gone -- removed from
  // that household, or signed in as someone else on a shared device.
  const active =
    memberships.find((m) => m.workspaces.id === activeId) ?? memberships[0] ?? null

  const switchWorkspace = useCallback((id) => {
    localStorage.setItem(ACTIVE_KEY, id)
    setActiveId(id)
  }, [])

  const createWorkspace = useCallback(
    async (name) => {
      const { data, error } = await supabase.rpc('create_workspace', {
        workspace_name: name,
      })
      if (error) return { error }

      await load()
      switchWorkspace(data)
      return { data }
    },
    [load, switchWorkspace],
  )

  const value = {
    loading,
    workspace: active?.workspaces ?? null,
    role: active?.role ?? null,
    canDeleteBins: active?.can_delete_bins ?? false,
    canWrite: active?.role === 'owner' || active?.role === 'write',
    isOwner: active?.role === 'owner',
    workspaces: memberships.map((m) => ({ ...m.workspaces, role: m.role })),
    switchWorkspace,
    createWorkspace,
    refresh: load,
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return ctx
}
