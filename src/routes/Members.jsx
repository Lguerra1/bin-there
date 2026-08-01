import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Check, Copy, UserPlus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useWorkspace } from '../lib/workspace'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorBanner,
  IconButton,
  Page,
  PageHeader,
  Select,
  TextField,
} from '../components/ui'

export default function Members() {
  const { user } = useAuth()
  const { workspace, isOwner, loading: workspaceLoading } = useWorkspace()
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [pendingRemove, setPendingRemove] = useState(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ email: '', role: 'read', canDeleteBins: false })

  const load = useCallback(async () => {
    // Every query is scoped to the current workspace. Row level security would
    // happily return rows from any workspace this user belongs to, which is
    // wrong here -- this screen is about one workspace at a time.
    const [memberResult, inviteResult, emailResult] = await Promise.all([
      supabase
        .from('memberships')
        .select('user_id, role, can_delete_bins')
        .eq('workspace_id', workspace.id),
      supabase
        .from('invites')
        .select('id, email, role, can_delete_bins, token, status, expires_at')
        .eq('workspace_id', workspace.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase.from('member_emails').select('user_id, email').eq('workspace_id', workspace.id),
    ])

    if (memberResult.error) setError(memberResult.error.message)

    const emails = new Map((emailResult.data ?? []).map((row) => [row.user_id, row.email]))
    setMembers(
      (memberResult.data ?? []).map((m) => ({ ...m, email: emails.get(m.user_id) ?? m.user_id })),
    )
    setInvites((inviteResult.data ?? []).filter((i) => new Date(i.expires_at) > new Date()))
    setLoading(false)
  }, [workspace.id])

  useEffect(() => {
    load()
  }, [load])

  async function sendInvite(event) {
    event.preventDefault()
    const email = form.email.trim().toLowerCase()
    if (!email) return
    setError(null)

    const { error: insertError } = await supabase.from('invites').insert({
      workspace_id: workspace.id,
      email,
      role: form.role,
      can_delete_bins: form.role === 'write' ? form.canDeleteBins : false,
    })

    if (insertError) return setError(insertError.message)
    setForm({ email: '', role: 'read', canDeleteBins: false })
    load()
  }

  async function copyLink(invite) {
    await navigator.clipboard.writeText(`${window.location.origin}/invite/${invite.token}`)
    setCopiedId(invite.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function revokeInvite(id) {
    setError(null)
    const { error: updateError } = await supabase
      .from('invites')
      .update({ status: 'revoked' })
      .eq('id', id)
    if (updateError) return setError(updateError.message)
    load()
  }

  async function updateMember(userId, patch) {
    setError(null)
    const { error: updateError } = await supabase
      .from('memberships')
      .update(patch)
      .eq('user_id', userId)
      .eq('workspace_id', workspace.id)
    if (updateError) return setError(updateError.message)
    load()
  }

  async function removeMember() {
    setBusy(true)
    const { error: deleteError } = await supabase
      .from('memberships')
      .delete()
      .eq('user_id', pendingRemove.user_id)
      .eq('workspace_id', workspace.id)
    setBusy(false)
    setPendingRemove(null)
    if (deleteError) return setError(deleteError.message)
    load()
  }

  if (workspaceLoading) return null
  if (!isOwner) return <Navigate to="/" replace />

  return (
    <Page>
      <PageHeader
        title="Members"
        subtitle="Who can see and change your bins"
        back={
          <Link
            to="/"
            className="-ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            aria-label="Back to all bins"
            title="Back to all bins"
          >
            <ArrowLeft size={22} />
          </Link>
        }
      />

      <ErrorBanner>{error}</ErrorBanner>

      {loading ? (
        <p className="py-12 text-center text-base text-gray-400">Loading…</p>
      ) : (
        <ul className="space-y-3">
          {members.map((member) => (
            <li key={member.user_id}>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold text-gray-900 dark:text-gray-50">
                      {member.email}
                    </p>
                    {member.user_id === user.id && (
                      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">You</p>
                    )}
                  </div>
                  {member.role === 'owner' ? (
                    <Badge tone="accent">owner</Badge>
                  ) : (
                    <IconButton
                      variant="dangerGhost"
                      onClick={() => setPendingRemove(member)}
                      aria-label={`Remove ${member.email}`}
                    >
                      <X size={20} />
                    </IconButton>
                  )}
                </div>

                {member.role !== 'owner' && (
                  <div className="mt-4">
                    <Select
                      label="Permission"
                      value={member.role}
                      onChange={(e) => updateMember(member.user_id, { role: e.target.value })}
                    >
                      <option value="read">Read — can view bins only</option>
                      <option value="write">Write — can add and edit items</option>
                    </Select>

                    {member.role === 'write' && (
                      <Checkbox
                        label="Can delete whole bins"
                        description="Deleting items is always allowed for write."
                        checked={member.can_delete_bins}
                        onChange={(e) =>
                          updateMember(member.user_id, { can_delete_bins: e.target.checked })
                        }
                      />
                    )}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {invites.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-lg font-semibold text-gray-900 dark:text-gray-50">
            Pending invites
          </h2>
          <ul className="space-y-3">
            {invites.map((invite) => (
              <li key={invite.id}>
                <Card className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-medium text-gray-900 dark:text-gray-50">
                        {invite.email}
                      </p>
                      <p className="mt-1 text-base text-gray-500 dark:text-gray-400">
                        {invite.role}
                        {invite.can_delete_bins && ' · can delete bins'}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-400">
                        Expires {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <IconButton
                      variant="dangerGhost"
                      onClick={() => revokeInvite(invite.id)}
                      aria-label="Revoke invite"
                    >
                      <X size={20} />
                    </IconButton>
                  </div>
                  <Button
                    variant="secondary"
                    fullWidth
                    className="mt-4"
                    onClick={() => copyLink(invite)}
                  >
                    {copiedId === invite.id ? <Check size={20} /> : <Copy size={20} />}
                    {copiedId === invite.id ? 'Link copied' : 'Copy invite link'}
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-8 mb-3 text-lg font-semibold text-gray-900 dark:text-gray-50">
        Invite someone
      </h2>
      <Card className="p-5">
        <form onSubmit={sendInvite} className="space-y-4">
          <TextField
            label="Their email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="them@example.com"
          />
          <Select
            label="Permission"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="read">Read — can view bins only</option>
            <option value="write">Write — can add and edit items</option>
          </Select>

          {form.role === 'write' && (
            <Checkbox
              label="Can delete whole bins"
              description="Deleting items is always allowed for write."
              checked={form.canDeleteBins}
              onChange={(e) => setForm({ ...form, canDeleteBins: e.target.checked })}
            />
          )}

          <Button type="submit" size="lg" fullWidth>
            <UserPlus size={20} /> Create invite link
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        You will get a link to send them. It only works for the email address you entered, and
        expires in 7 days.
      </p>

      <ConfirmDialog
        open={Boolean(pendingRemove)}
        title="Remove this member?"
        message={`${pendingRemove?.email} will immediately lose access to every bin in ${workspace?.name}.`}
        detail="Nothing they added is deleted. You can invite them again later."
        confirmLabel="Remove"
        busy={busy}
        onConfirm={removeMember}
        onCancel={() => setPendingRemove(null)}
      />
    </Page>
  )
}
