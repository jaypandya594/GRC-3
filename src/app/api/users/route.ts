import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hash } from 'bcryptjs'

/** In a real app the current user id comes from the session/JWT.
 *  For demo purposes we just fetch all users in the tenant. */
const CURRENT_USER_ID = 'demo-super-admin' // placeholder — not enforced
const TENANT_ID = 'tenant-isecurify'

// ── Password validation ───────────────────────────────────────
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least 1 uppercase letter'
  if (!/\d/.test(pw)) return 'Password must contain at least 1 digit'
  return null
}

// ── GET /api/users ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    // In production you'd verify the requester's role from the session
    // const session = await getServerSession(...)
    // if (session?.user?.role !== 'super_admin' && session?.user?.role !== 'tenant_admin') {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    // }

    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role') ?? undefined
    const search = searchParams.get('search') ?? undefined

    const where: Record<string, unknown> = { tenantId: TENANT_ID }

    if (role) where.role = role
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ]
    }

    const users = await db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
        // never expose hashedPassword
      },
    })

    return NextResponse.json({ data: users })
  } catch (error) {
    console.error('[GET /api/users]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST /api/users ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, role, password } = body as {
      name?: string
      email?: string
      role?: string
      password?: string
    }

    // Validation
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!email?.trim()) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    if (!role) return NextResponse.json({ error: 'Role is required' }, { status: 400 })
    if (!password) return NextResponse.json({ error: 'Password is required' }, { status: 400 })

    const validRoles = ['super_admin', 'tenant_admin', 'sales_manager', 'sales_executive', 'finance', 'viewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, { status: 400 })
    }

    const pwError = validatePassword(password)
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 })

    // Check uniqueness
    const existing = await db.user.findUnique({
      where: { tenantId_email: { tenantId: TENANT_ID, email: email.trim().toLowerCase() } },
    })
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }

    const hashedPassword = await hash(password, 12)

    const user = await db.user.create({
      data: {
        tenantId: TENANT_ID,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        hashedPassword,
        isActive: true,
      },
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

    return NextResponse.json({ data: user }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/users]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}