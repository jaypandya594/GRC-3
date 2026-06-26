import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const TENANT_ID = 'tenant-isecurify'

// ── PATCH /api/users/[id]/toggle-active ───────────────────────
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing || existing.tenantId !== TENANT_ID) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updated = await db.user.update({
      where: { id },
      data: { isActive: !existing.isActive },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        failedLoginAttempts: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[PATCH /api/users/[id]/toggle-active]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}