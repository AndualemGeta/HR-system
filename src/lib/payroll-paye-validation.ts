import { prisma } from './prisma'

export interface ValidationError {
  message: string
  bracketName?: string
}

export interface ScheduleValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export async function validatePayeSchedule(scheduleCode: string): Promise<ScheduleValidationResult> {
  const errors: ValidationError[] = []

  const brackets = await prisma.payeTaxBracket.findMany({
    where: { scheduleCode },
    orderBy: { minIncome: 'asc' },
  })

  if (brackets.length === 0) {
    errors.push({ message: 'Schedule has no brackets' })
    return { valid: false, errors }
  }

  // Check each bracket
  for (const b of brackets) {
    const min = Number(b.minIncome)
    const max = b.maxIncome ? Number(b.maxIncome) : null

    if (min < 0) {
      errors.push({ message: `minIncome cannot be negative`, bracketName: b.name })
    }
    if (max !== null && max <= min) {
      errors.push({ message: `maxIncome (${max}) must be greater than minIncome (${min})`, bracketName: b.name })
    }
    if (Number(b.taxRate) < 0 || Number(b.taxRate) > 100) {
      errors.push({ message: `taxRate must be between 0 and 100`, bracketName: b.name })
    }
    if (Number(b.deductionAmount) < 0) {
      errors.push({ message: `deductionAmount cannot be negative`, bracketName: b.name })
    }
  }

  if (errors.length > 0) return { valid: false, errors }

  // Check exactly one open-ended bracket (maxIncome = null)
  const openEnded = brackets.filter(b => b.maxIncome === null)
  if (openEnded.length === 0) {
    errors.push({ message: 'Schedule must have exactly one open-ended bracket (maxIncome = null), found 0' })
  }
  if (openEnded.length > 1) {
    errors.push({ message: 'Schedule has multiple open-ended brackets, only the highest bracket should have maxIncome = null', bracketName: openEnded.slice(1).map(b => b.name).join(', ') })
  }

  if (errors.length > 0) return { valid: false, errors }

  // Check the highest bracket is open-ended
  const highest = brackets[brackets.length - 1]
  if (highest.maxIncome !== null) {
    errors.push({ message: `Highest bracket "${highest.name}" must be open-ended (maxIncome = null)` })
    return { valid: false, errors }
  }

  // Check for gaps and overlaps
  for (let i = 0; i < brackets.length - 1; i++) {
    const current = brackets[i]
    const next = brackets[i + 1]
    const currentMax = current.maxIncome ? Number(current.maxIncome) : null
    const nextMin = Number(next.minIncome)

    if (currentMax === null) {
      errors.push({ message: `Non-highest bracket "${current.name}" has maxIncome = null` })
      continue
    }

    // Gap: current max < next min
    if (currentMax < nextMin) {
      errors.push({
        message: `Gap between "${current.name}" (max=${currentMax}) and "${next.name}" (min=${nextMin})`,
      })
    }

    // Overlap: current max > next min
    if (currentMax > nextMin) {
      errors.push({
        message: `Overlap between "${current.name}" (max=${currentMax}) and "${next.name}" (min=${nextMin})`,
      })
    }

    // Boundary conflict: current max === next min
    if (currentMax === nextMin) {
      errors.push({
        message: `Boundary conflict: "${current.name}" max (${currentMax}) equals "${next.name}" min (${nextMin}). Use minIncome inclusive / maxIncome exclusive convention`,
      })
    }
  }

  return { valid: errors.length === 0, errors }
}
