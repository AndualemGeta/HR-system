import { roundMoney, sumMoney } from './money'

export function round2(value: number): number {
  return roundMoney(value)
}

export function round4(value: number): number {
  return Number(value.toFixed(4))
}

export function sum(...values: number[]): number {
  return sumMoney(...values)
}

export function max0(value: number): number {
  return Math.max(0, value)
}
