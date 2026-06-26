import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const TENANT_ID = 'tenant-isecurify'
// Demo placeholder — in production this comes from the session
const CURRENT_USER_ID = 'demo-super-admin'

type UserSafe = {
  id: string
  tenantId: string
  email: string
  name: string
  role: string
  isActive: boolean
  failedLoginAttempts: number
  lastLogin: Date | null
  createdAt: Date
  updatedAt: Date
}

function excludePassword(user: UserSafe & { hashedPassword?: string }) {
  const { hashedPassword, ...rest } = user
  return rest
}

// ── PATCH /api/users/[id] ─────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, email, role } = body as {
      name?: string
      email?: string
      role?: string
    }

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing || existing.tenantId !== TENANT_ID) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (email !== undefined) {
      const trimmed = email.trim().toLowerCase()
      if (trimmed !== existing.email) {
        const dup = await db.user.findUnique({
          where: { tenantId_email: { tenantId: TENANT_ID, email: trimmed } },
        })
        if (dup) {
          return NextResponse.json({ error: 'Another user with this email already exists' }, { status: 409 })
        }
        updateData.email = trimmed
      }
    }
    if (role !== undefined) {
      const validRoles = ['super_admin', 'tenant_admin', 'sales_manager', 'sales_executive', 'finance', 'viewer']
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      updateData.role = role
    }

    const updated = await db.user.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ data: excludePassword(updated as unknown as UserSafe & { hashedPassword: string }) })
  } catch (error) {
    console.error('[PATCH /api/users/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE /api/users/[id] ────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Cannot delete self
    if (id === CURRENT_USER_ID) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing || existing.tenantId !== TENANT_ID) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Find a default admin to reassign quotes to
    const defaultAdmin = await db.user.findFirst({
      where: {
        tenantId: TENANT_ID,
        role: 'super_admin',
        isActive: true,
        id: { not: id },
      },
      orderBy: { createdAt: 'asc' },
    })

    const reassignToId = defaultAdmin?.id ?? CURRENT_USER_ID

    // Reassign all quotes created by this user
    await db.quote.updateMany({
      where: { createdById: id },
      data: { createdById: reassignToId },
    })

    // Hard delete the user
    await db.user.delete({ where: { id } })

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error('[DELETE /api/users/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}