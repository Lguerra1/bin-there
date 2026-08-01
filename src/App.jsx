import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { WorkspaceProvider, useWorkspace } from './lib/workspace'
import Login from './routes/Login'
import Dashboard from './routes/Dashboard'
import BoxView from './routes/BoxView'
import Trash from './routes/Trash'

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

/** A signed-in account with no membership can see nothing. Say so plainly. */
function RequireWorkspace({ children }) {
  const { loading, workspace } = useWorkspace()

  if (loading) return <Splash>Loading…</Splash>
  if (!workspace) {
    return (
      <Splash>
        <p className="font-medium text-gray-900 dark:text-gray-100">No access yet</p>
        <p className="mt-1">
          Your account is not part of a workspace. Ask the owner to send you an invite.
        </p>
      </Splash>
    )
  }
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
