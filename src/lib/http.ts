import { NextResponse } from "next/server";

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 1_000_000) return null;

  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function badRequest(message = "Requête invalide") {
  return NextResponse.json({ error: message }, { status: 400 });
}
