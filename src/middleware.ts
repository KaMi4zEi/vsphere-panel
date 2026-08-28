import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const protectedPages = ["/dashboard", "/admin", "/profile", "/setup-totp", "/change-password"];
const protectedApis = ["/api/users", "/api/vms", "/api/power", "/api/logs", "/api/profile", "/api/totp", "/api/stats", "/api/notifications", "/api/infrastructure", "/api/admin", "/api/identity"];

function startsWithOne(pathname: string, prefixes: string[]) {
  return prefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix + "/"));
}

function csp(nonce: string) {
  const scripts = process.env.NODE_ENV === "development"
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  return `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src ${scripts}; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;
}

export async function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp(nonce));
  const secure = (response: NextResponse) => { response.headers.set("Content-Security-Policy", csp(nonce)); return response; };
  const next = () => secure(NextResponse.next({ request: { headers: requestHeaders } }));
  const { pathname } = req.nextUrl;
  const isProtectedPage = startsWithOne(pathname, protectedPages);
  const isProtectedApi = startsWithOne(pathname, protectedApis);
  if (!isProtectedPage && !isProtectedApi) return next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return secure(isProtectedApi
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.url)));
  }
  const role = token.role;
  if (pathname.startsWith("/admin") && role !== "ADMIN" && role !== "MODERATOR") return secure(NextResponse.redirect(new URL("/dashboard", req.url)));
  if (["/admin/identity", "/admin/infrastructure"].some(path => pathname.startsWith(path)) && role !== "ADMIN") return secure(NextResponse.redirect(new URL("/admin", req.url)));

  if (isProtectedApi && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin"); const expectedHost = req.headers.get("host");
    if (origin) { try { if (!expectedHost || new URL(origin).host !== expectedHost) return secure(NextResponse.json({ error: "Origine de la requête refusée" }, { status: 403 })); } catch { return secure(NextResponse.json({ error: "Origine de la requête refusée" }, { status: 403 })); } }
  }

  const isPage = !pathname.startsWith("/api");
  if (token.mustChangePassword && pathname !== "/change-password") return secure(isPage ? NextResponse.redirect(new URL("/change-password", req.url)) : NextResponse.json({ error: "Le mot de passe doit être modifié avant de continuer" }, { status: 403 }));
  const needsTotp = !token.mustChangePassword && (role === "USER" || role === "MODERATOR") && token.totpForced && !token.totpEnabled && !token.totpDisabled;
  if (needsTotp && pathname !== "/setup-totp" && pathname !== "/api/totp") return secure(isPage ? NextResponse.redirect(new URL("/setup-totp", req.url)) : NextResponse.json({ error: "Le TOTP doit être configuré avant de continuer" }, { status: 403 }));
  return next();
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
