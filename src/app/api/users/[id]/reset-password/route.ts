import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hash } from 'bcryptjs'

const TENANT_ID = 'tenant-isecurify'

// ── POST /api/users/[id]/reset-password ───────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { password } = body as { password?: string }

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 })
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (!/[A-Z]/.test(password)) {
      return NextResponse.json({ error: 'Password must contain at least 1 uppercase letter' }, { status: 400 })
    }
    if (!/\d/.test(password)) {
      return NextResponse.json({ error: 'Password must contain at least 1 digit' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing || existing.tenantId !== TENANT_ID) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const hashedPassword = await hash(password, 12)

    await db.user.update({
      where: { id },
      data: { hashedPassword },
    })

    return NextResponse.json({ data: { success: true, name: existing.name } })
  } catch (error) {
    console.error('[POST /api/users/[id]/reset-password]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}