import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ mvpMode: process.env.MVP_MODE === 'true' })
}
