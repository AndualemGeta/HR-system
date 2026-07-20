import Decimal from 'decimal.js'

Decimal.set({ defaults: true, precision: 20, rounding: Decimal.ROUND_HALF_UP })

export function money(value: number | string | Decimal): Decimal {
  if (value instanceof Decimal) return value
  return new Decimal(value)
}

export function roundMoney(value: Decimal | number | string): number {
  return Number(money(value).toFixed(2))
}

export function roundRate(value: Decimal | number | string): number {
  return Number(money(value).toFixed(6))
}

export function calcPercent(base: Decimal | number | string, pct: Decimal | number | string): Decimal {
  return money(base).mul(money(pct)).div(100)
}

export function sumMoney(...values: (Decimal | number | string)[]): number {
  let acc = money(0)
  for (const v of values) {
    acc = acc.plus(money(v))
  }
  return Number(acc.toFixed(2))
}

export function validateReconciliation(label: string, computed: number, expected: number, tolerance = 0.01): string | null {
  const diff = Math.abs(computed - expected)
  if (diff > tolerance) {
    return `${label}: expected ${expected.toFixed(2)}, got ${computed.toFixed(2)}, diff ${diff.toFixed(2)}`
  }
  return null
}
