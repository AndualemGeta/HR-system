import { NextRequest } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, canViewEmployee } from '@/lib/rbac'
import { canViewDocument } from '@/lib/documents'
import { success, unauthorized, forbidden, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/documents'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'document.view'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const documents = await prisma.employeeDocument.findMany({
      where: { employeeId: id },
      include: { employee: { select: { id: true, employeeId: true, fullName: true } } },
      orderBy: { uploadedAt: 'desc' },
    })

    const filtered = []
    for (const doc of documents) {
      if (await canViewDocument(session.userId, doc.id)) {
        filtered.push(doc)
      }
    }

    return success(filtered)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'document.upload'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const formData = await req.formData().catch(() => null)
    if (!formData) return badRequest('Form data required')

    const file = formData.get('file') as File | null
    const documentType = formData.get('documentType') as string | null
    const visibilityLevel = formData.get('visibilityLevel') as string | null
    const notes = formData.get('notes') as string | null

    if (!file) return badRequest('File is required')
    if (!documentType) return badRequest('Document type is required')
    if (!visibilityLevel) return badRequest('Visibility level is required')

    const validDocTypes = ['ID', 'CONTRACT', 'CV', 'CERTIFICATE', 'EMERGENCY_CONTACT', 'BANK_OR_PAYMENT_INFORMATION', 'TAX_OR_PAYROLL_INFORMATION', 'COMMISSION_AGREEMENT', 'ASSIGNMENT_LETTER', 'RESPONSIBILITY_DOCUMENT', 'CONFIDENTIALITY_DOCUMENT', 'SALARY_DOCUMENT', 'OTHER']
    if (!validDocTypes.includes(documentType)) return badRequest('Invalid document type')

    const validVisLevels = ['PUBLIC_TO_HR', 'MANAGER_VISIBLE', 'EMPLOYEE_VISIBLE', 'SENSITIVE_HR_ONLY', 'SALARY_RESTRICTED']
    if (!validVisLevels.includes(visibilityLevel)) return badRequest('Invalid visibility level')

    if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.name.toLowerCase().match(/\.(pdf|jpg|jpeg|png|doc|docx)$/)) {
      return badRequest('Unsupported file type. Accepted: PDF, JPG, PNG, DOC, DOCX')
    }

    if (file.size > MAX_FILE_SIZE) return badRequest('File too large. Maximum size is 10 MB')

    const uploadDir = join(process.cwd(), 'uploads', 'employee-documents')
    await mkdir(uploadDir, { recursive: true })

    const ext = file.name.split('.').pop() || 'bin'
    const fileName = `${id}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`
    const filePath = join(uploadDir, fileName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId: id,
        documentType: documentType as never,
        filePath: `uploads/employee-documents/${fileName}`,
        originalFilename: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        uploadedById: session.userId,
        visibilityLevel: visibilityLevel as never,
        notes: notes || null,
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'DOCUMENT_UPLOAD',
      entityType: 'EmployeeDocument',
      entityId: doc.id,
      newValue: { documentType, originalFilename: file.name, visibilityLevel, employeeId: id },
    })

    return success(doc, 201)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
