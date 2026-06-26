/**
 * iSecurify — User Management View
 * Full CRUD with role-based scoping per v2 spec.
 */
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { TopBar } from './Shell'
import { useAuthStore } from '@/store'
import { formatDate } from '@/lib/currency'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'
import {
  Plus,
  Search,
  Key,
  Ban,
  ShieldCheck,
  Trash2,
  Loader2,
  UserPlus,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

// ── Types ──────────────────────────────────────────────────────
interface UserRow {
  id: string
  tenantId: string
  email: string
  name: string
  role: string
  isActive: boolean
  failedLoginAttempts: number
  lastLogin: string | null
  createdAt: string
  updatedAt: string
}

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-800 ring-1 ring-purple-300',
  sales_manager: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300',
  sales_executive: 'bg-teal-100 text-teal-800 ring-1 ring-teal-300',
  finance: 'bg-blue-100 text-blue-800 ring-1 ring-blue-300',
  tenant_admin: 'bg-slate-100 text-slate-800 ring-1 ring-slate-300',
  viewer: 'bg-slate-100 text-slate-800 ring-1 ring-slate-300',
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  tenant_admin: 'Tenant Admin',
  sales_manager: 'Sales Manager',
  sales_executive: 'Sales Executive',
  finance: 'Finance',
  viewer: 'Viewer',
}

const ALL_ROLES = ['super_admin', 'sales_manager', 'sales_executive', 'finance', 'viewer'] as const
const MANAGER_CREATABLE_ROLES = ['sales_executive', 'finance', 'viewer'] as const

function getPasswordStrength(pw: string): { label: string; color: string; pct: number } {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { label: 'Weak', color: 'bg-red-500', pct: 20 }
  if (score <= 3) return { label: 'Medium', color: 'bg-amber-500', pct: 60 }
  return { label: 'Strong', color: 'bg-emerald-500', pct: 100 }
}

// ── Component ──────────────────────────────────────────────────
export function UserManagementView() {
  const { user: currentUser } = useAuthStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [resetPwUser, setResetPwUser] = useState<UserRow | null>(null)
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null)

  // ── Create user form state ──
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState('')
  const [formPw, setFormPw] = useState('')
  const [formPwConfirm, setFormPwConfirm] = useState('')

  // ── Reset password form state ──
  const [resetPw, setResetPw] = useState('')
  const [resetPwConfirm, setResetPwConfirm] = useState('')

  const isAdmin = currentUser?.role === 'super_admin'
  const isManager = currentUser?.role === 'sales_manager'
  const canManage = isAdmin || isManager
  const creatableRoles = isAdmin ? ALL_ROLES : MANAGER_CREATABLE_ROLES

  // ── Fetch users ──
  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ['users', search],
    queryFn: () => api.get<UserRow[]>('/users' + (search ? `?search=${encodeURIComponent(search)}` : '')),
  })

  // ── Mutations ──
  const createUser = useMutation({
    mutationFn: (body: { name: string; email: string; role: string; password: string }) =>
      api.post<UserRow>('/users', body),
    onSuccess: (u) => {
      toast({ title: `User "${u.name}" created successfully` })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      closeCreateDialog()
    },
    onError: (e: Error) => toast({ title: 'Create failed', description: e.message, variant: 'destructive' }),
  })

  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.post(`/users/${id}/reset-password`, { password }),
    onSuccess: (_, vars) => {
      toast({ title: `Password reset for ${resetPwUser?.name}` })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setResetPwUser(null)
      setResetPw('')
      setResetPwConfirm('')
    },
    onError: (e: Error) => toast({ title: 'Reset failed', description: e.message, variant: 'destructive' }),
  })

  const toggleActive = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/toggle-active`),
    onSuccess: (_, id) => {
      const u = users.find((u) => u.id === id)
      toast({ title: u?.isActive ? `${u.name} blocked` : `${u.name} unblocked` })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (e: Error) => toast({ title: 'Action failed', description: e.message, variant: 'destructive' }),
  })

  const deleteUserMut = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast({ title: `${deleteUser?.name} deleted permanently` })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeleteUser(null)
    },
    onError: (e: Error) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  })

  function closeCreateDialog() {
    setCreateOpen(false)
    setFormName('')
    setFormEmail('')
    setFormRole('')
    setFormPw('')
    setFormPwConfirm('')
  }

  function handleCreate() {
    const errors: string[] = []
    if (!formName.trim()) errors.push('Name is required')
    if (!formEmail.trim()) errors.push('Email is required')
    if (!formRole) errors.push('Role is required')
    if (formPw.length < 8) errors.push('Password must be at least 8 characters')
    if (!/[A-Z]/.test(formPw)) errors.push('Password needs at least 1 uppercase letter')
    if (!/\d/.test(formPw)) errors.push('Password needs at least 1 digit')
    if (formPw !== formPwConfirm) errors.push('Passwords do not match')
    if (errors.length) {
      toast({ title: 'Validation error', description: errors.join('. '), variant: 'destructive' })
      return
    }
    createUser.mutate({ name: formName, email: formEmail, role: formRole, password: formPw })
  }

  function handleResetPw() {
    const errors: string[] = []
    if (resetPw.length < 8) errors.push('Password must be at least 8 characters')
    if (!/[A-Z]/.test(resetPw)) errors.push('Password needs at least 1 uppercase letter')
    if (!/\d/.test(resetPw)) errors.push('Password needs at least 1 digit')
    if (resetPw !== resetPwConfirm) errors.push('Passwords do not match')
    if (errors.length) {
      toast({ title: 'Validation error', description: errors.join('. '), variant: 'destructive' })
      return
    }
    if (resetPwUser) resetPassword.mutate({ id: resetPwUser.id, password: resetPw })
  }

  const pwStrength = getPasswordStrength(formPw)
  const resetPwStrength = getPasswordStrength(resetPw)

  return (
    <div>
      <TopBar
        title="User Management"
        subtitle="Manage team members and roles"
        action={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)} className="bg-brand-700 hover:bg-brand-800 text-white">
              <UserPlus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          ) : undefined
        }
      />

      <div className="p-4 md:p-8 space-y-4">
        {/* ── Search ── */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name or email..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* ── Table ── */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                  <TableHead className="font-semibold">Role</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">Created</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-slate-500">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => {
                    const isSelf = u.id === currentUser?.id
                    const isAboveManager = u.role === 'super_admin' || u.role === 'sales_manager'
                    const canAct = canManage && !isSelf && (isAdmin || !isAboveManager)
                    return (
                      <TableRow key={u.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-slate-600 text-sm">{u.email}</TableCell>
                        <TableCell>
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', ROLE_BADGE[u.role] ?? ROLE_BADGE.viewer)}>
                            {ROLE_LABEL[u.role] ?? u.role}
                          </span>
                        </TableCell>
                        <TableCell>
                          {u.isActive ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Blocked</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm hidden md:table-cell">
                          {formatDate(u.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canAct && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-brand-700"
                                  title="Reset Password"
                                  onClick={() => { setResetPwUser(u); setResetPw(''); setResetPwConfirm('') }}
                                >
                                  <Key className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn('h-8 w-8', u.isActive ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50')}
                                  title={u.isActive ? 'Block User' : 'Unblock User'}
                                  onClick={() => toggleActive.mutate(u.id)}
                                >
                                  {u.isActive ? <Ban className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  title="Delete User"
                                  onClick={() => setDeleteUser(u)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* ── Create User Dialog ── */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && closeCreateDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input placeholder="e.g. John Doe" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="e.g. john@isecurify.in" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {creatableRoles.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" placeholder="Min 8 chars, 1 uppercase, 1 digit" value={formPw} onChange={(e) => setFormPw(e.target.value)} />
              {formPw.length > 0 && (
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', pwStrength.color)} style={{ width: `${pwStrength.pct}%` }} />
                  </div>
                  <p className="text-xs text-slate-500">Strength: {pwStrength.label}</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input type="password" placeholder="Re-enter password" value={formPwConfirm} onChange={(e) => setFormPwConfirm(e.target.value)} />
              {formPwConfirm && formPw !== formPwConfirm && (
                <p className="text-xs text-red-600">Passwords do not match</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCreateDialog}>Cancel</Button>
            <Button
              className="bg-brand-700 hover:bg-brand-800 text-white"
              onClick={handleCreate}
              disabled={createUser.isPending}
            >
              {createUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Dialog ── */}
      <Dialog open={!!resetPwUser} onOpenChange={(o) => !o && setResetPwUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password — {resetPwUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" placeholder="Min 8 chars, 1 uppercase, 1 digit" value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
              {resetPw.length > 0 && (
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', resetPwStrength.color)} style={{ width: `${resetPwStrength.pct}%` }} />
                  </div>
                  <p className="text-xs text-slate-500">Strength: {resetPwStrength.label}</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input type="password" placeholder="Re-enter new password" value={resetPwConfirm} onChange={(e) => setResetPwConfirm(e.target.value)} />
              {resetPwConfirm && resetPw !== resetPwConfirm && (
                <p className="text-xs text-red-600">Passwords do not match</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwUser(null)}>Cancel</Button>
            <Button
              className="bg-brand-700 hover:bg-brand-800 text-white"
              onClick={handleResetPw}
              disabled={resetPassword.isPending}
            >
              {resetPassword.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{deleteUser?.name}</strong> ({deleteUser?.email})? This cannot be undone. Their quotes will be reassigned to an admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteUser.id && deleteUserMut.mutate(deleteUser.id)}
              disabled={deleteUserMut.isPending}
            >
              {deleteUserMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}