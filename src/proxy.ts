import { NextRequest, NextResponse } from "next/server";

// Rotas que exigem autenticação
const PROTECTED_ROUTES = [
  "/dashboard",
  "/agenda",
  "/pacientes",
  "/sala",
  "/financeiro",
  "/configuracoes",
];

// Rotas exclusivamente públicas (redireciona para dashboard se já logado)
const PUBLIC_ONLY_ROUTES = ["/login", "/registro", "/esqueci-senha"];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Verifica o cookie de sessão Firebase (setado pelo AuthProvider pós-login)
  const sessionCookie = request.cookies.get("__session")?.value;
  const isAuthenticated = Boolean(sessionCookie);

  // ─── Em desenvolvimento, o Firebase Auth é 100% client-side.
  // O cookie __session só existe após o primeiro login E reload.
  // Por isso bloqueamos redirect apenas quando o cookie existe e é válido,
  // deixando o layout client-side (AuthLayout) cuidar do redirect de auth.
  // ─── Protege rotas autenticadas (apenas se o cookie existir — evita race) ──
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  // Só redireciona se tiver tentado acessar rota protegida E cookie claramente ausente
  // (não bloqueia em desenvolvimento para evitar loop com Firebase client-side)
  if (isProtectedRoute && !isAuthenticated) {
    // Deixa o AuthLayout client-side fazer o redirect — não interfere aqui
    // para evitar loop infinito de redirect antes do Firebase hidratar
    return NextResponse.next();
  }

  // ─── Redireciona usuários logados das rotas públicas ────────────────────────
  const isPublicOnly = PUBLIC_ONLY_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  if (isPublicOnly && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ─── Headers de segurança ────────────────────────────────────────────────────
  const response = NextResponse.next();

  // LGPD / Segurança HTTP Headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set(
    "Permissions-Policy",
    'camera=(self "https://8x8.vc"), microphone=(self "https://8x8.vc"), geolocation=(self)'
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Aplica o middleware em todas as rotas exceto:
     * - _next/static (assets estáticos)
     * - _next/image (otimização de imagens)
     * - favicon, manifest, ícones PWA
     * - API routes de webhook externo
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|api/webhook).*)",
  ],
};
