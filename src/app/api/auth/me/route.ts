import { NextResponse } from "next/server";
import { getCurrentPrincipal } from "@/lib/security/session";

export const runtime = "nodejs";

export async function GET() {
  const principal = await getCurrentPrincipal();
  return NextResponse.json({ principal });
}

