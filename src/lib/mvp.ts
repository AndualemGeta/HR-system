export function isMvpMode(): boolean {
  return process.env.MVP_MODE === 'true'
}

export const MVP_ADVANCED_ROUTES = [
  '/payroll-calculation',
  '/payroll-input-types',
  '/payroll-input-requirements',
  '/payroll-journals',
  '/payroll-output-packages',
  '/payroll-periods',
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
]

export const MVP_KEEP_ROUTES = [
  '/employees',
  '/status-history',
  '/org-chart',
  '/payroll',
  '/reports',
  '/audit-logs',
  '/dashboard',
  '/login',
  '/users',
]

export function isMvpAdvancedRoute(pathname: string): boolean {
  if (!isMvpMode()) return false
  return MVP_ADVANCED_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))
}
