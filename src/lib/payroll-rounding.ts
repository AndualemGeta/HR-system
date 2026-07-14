export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

export function sum(...values: number[]): number {
  return values.reduce((acc, v) => acc + (v ?? 0), 0)
}

export function max0(value: number): number {
  return Math.max(0, value)
}
