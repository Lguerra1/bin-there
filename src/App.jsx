import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { WorkspaceProvider, useWorkspace } from './lib/workspace'
import Login from './routes/Login'
import Dashboard from './routes/Dashboard'
import BoxView from './routes/BoxView'
import Trash from './routes/Trash'
import Members from './routes/Members'
import AcceptInvite from './routes/AcceptInvite'
import NoWorkspace from './routes/NoWorkspace'

function Splash({ children }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-gray-50 p-6 text-center dark:bg-gray-950">
      <div className="text-sm text-gray-500 dark:text-gray-400">{children}</div>
    </div>
  )
}

/**
 * Sends signed-out visitors to the login screen, remembering where they were
 * headed so a scanned sticker lands on the right bin afterwards.
 */
function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Splash>Loading…</Splash>
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

/**
 * A signed-in account with no membership can see nothing, so offer the two ways
 * out: start a household, or open an invite link.
 */
function RequireWorkspace({ children }) {
  const { loading, workspace } = useWorkspace()

  if (loading) return <Splash>Loading…</Splash>
  if (!workspace) return <NoWorkspace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <RequireWorkspace>
                    <Dashboard />
                  </RequireWorkspace>
                </RequireAuth>
              }
            />
            <Route
              path="/box/:shortId"
              element={
                <RequireAuth>
                  <RequireWorkspace>
                    <BoxView />
                  </RequireWorkspace>
                </RequireAuth>
              }
            />
            <Route
              path="/trash"
              element={
                <RequireAuth>
                  <RequireWorkspace>
                    <Trash />
                  </RequireWorkspace>
                </RequireAuth>
              }
            />
            <Route
              path="/members"
              element={
                <RequireAuth>
                  <RequireWorkspace>
                    <Members />
                  </RequireWorkspace>
                </RequireAuth>
              }
            />
            {/* Deliberately outside RequireWorkspace: the whole point is that
                this person has no membership yet. */}
            <Route path="/invite/:token" element={<AcceptInvite />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
