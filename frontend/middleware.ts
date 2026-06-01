import { NextRequest, NextResponse } from 'next/server'

const PROTECTED = [
  '/dashboard',
  '/activity',
  '/settlements',
  '/friends',
  '/profile',
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isProtected = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!isProtected) return NextResponse.next()

  const loggedIn = req.cookies.get('ledgr_logged_in')?.value === '1'
  if (loggedIn) return NextResponse.next()

  const login = req.nextUrl.clone()
  login.pathname = '/login'
  login.search = `?next=${encodeURIComponent(pathname)}`
  return NextResponse.redirect(login)
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/activity',
    '/settlements',
    '/friends',
    '/profile',
  ],
}
