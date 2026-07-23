import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADVANCED_ROUTES = [
  '/payroll-calculation',
  '/payroll-input-types',
  '/payroll-input-requirements',
  '/payroll-journals',
  '/payroll-output-packages',
  '/payslips',
  '/payment-batches',
  '/statutory-reports',
  '/salary-structure',
  '/shop-manager-incentives',
  '/shops',
  '/assignments',
  '/onboarding',
  '/change-requests',
  '/data-quality',
  '/document-rules',
  '/phase-control',
  '/payroll-periods',
]

const ADVANCED_API_ROUTES = [
  '/api/payroll-calculation',
  '/api/payroll-input-types',
  '/api/payroll-input-requirements',
  '/api/payroll-journals',
  '/api/payroll-output-packages',
  '/api/payslips',
  '/api/payment-batches',
  '/api/statutory-reports',
  '/api/salary-structure',
  '/api/shop-manager-incentives',
  '/api/shops',
  '/api/assignments',
  '/api/onboarding',
  '/api/change-requests',
  '/api/data-quality',
  '/api/document-rules',
  '/api/phase-control',
  '/api/payroll-periods',
]

function isAdvancedRoute(pathname: string): boolean {
  return ADVANCED_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))
}

function isAdvancedApiRoute(pathname: string): boolean {
  return ADVANCED_API_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))
}

export function middleware(request: NextRequest) {
  const mvpMode = process.env.MVP_MODE === 'true'
  if (!mvpMode) return NextResponse.next()

  const { pathname } = request.nextUrl

  // Block advanced API routes
  if (pathname.startsWith('/api/') && isAdvancedApiRoute(pathname)) {
    return NextResponse.json({ error: 'This API is not available in MVP mode' }, { status: 404 })
  }

  // Allow other API routes and static assets
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname === '/') {
    return NextResponse.next()
  }

  if (isAdvancedRoute(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
