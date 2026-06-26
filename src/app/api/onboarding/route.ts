import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, success, notFound, badRequest } from '@/lib/api'

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId') || ''

  if (employeeId) {
    const checklist = await prisma.onboardingChecklist.findUnique({
      where: { employeeId },
      include: { items: true },
    })
    if (!checklist) return success({ exists: false })
    return success({ exists: true, checklist })
  }

  const checklists = await prisma.onboardingChecklist.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  })
  return success(checklists)
}, 'onboarding.view')

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}))
  const { employeeId } = body
  if (!employeeId) return badRequest('employeeId is required')

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) return notFound()

  const existing = await prisma.onboardingChecklist.findUnique({ where: { employeeId } })
  if (existing) return success(existing)

  const checklist = await prisma.onboardingChecklist.create({
    data: { employeeId },
    include: { items: true },
  })

  return success(checklist, 201)
}, 'onboarding.update')
