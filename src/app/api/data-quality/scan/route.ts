import { withAuth, success } from '@/lib/api'
import { scanEmployeeDataQuality } from '@/lib/data-quality'

export const POST = withAuth(async () => {
  const result = await scanEmployeeDataQuality()
  return success(result)
}, 'dataQuality.manage')
