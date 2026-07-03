import { prisma } from './prisma'
import { buildShopScopeWhere, shopInUserScope } from './shop-scope'

export { shopInUserScope }

export async function buildIncentiveScopeWhere(userId: string): Promise<Record<string, unknown>> {
  const shopScope = await buildShopScopeWhere(userId)
  if (Object.keys(shopScope).length === 0) return {}
  return {
    shopLocation: shopScope,
  }
}

export async function buildIncentiveCalculationScopeWhere(userId: string): Promise<Record<string, unknown>> {
  const shopScope = await buildShopScopeWhere(userId)
  if (Object.keys(shopScope).length === 0) return {}
  return {
    shopLocation: shopScope,
  }
}

export async function buildIncentiveInputScopeWhere(userId: string): Promise<Record<string, unknown>> {
  const shopScope = await buildShopScopeWhere(userId)
  if (Object.keys(shopScope).length === 0) return {}
  return { shopLocation: shopScope }
}
