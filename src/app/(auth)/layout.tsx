"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar  } from "@/components/layout/Navbar";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn }      from "@/lib/utils";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router            = useRouter();
  const [collapsed,    setCollapsed]    = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);

  // Redireciona para login se não autenticado
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Sincroniza cookie de sessão para o proxy/middleware
  // Nota: flag Secure omitida para funcionar em http://localhost
  // Delay de 500ms antes de deletar cookie para evitar conflito entre abas
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (user) {
      user.getIdToken().then((token) => {
        const isSecure = window.location.protocol === "https:";
        document.cookie = `__session=${token}; path=/; SameSite=Strict${isSecure ? "; Secure" : ""}`;
      });
    } else if (!loading) {
      // Aguarda 500ms antes de deletar cookie (evita race condition entre abas)
      timeoutId = setTimeout(() => {
        document.cookie = "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }, 500);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, loading]);

  // Fecha sidebar mobile ao redimensionar para desktop
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) setMobileOpen(false);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-surface" suppressHydrationWarning>
        <div className="flex flex-col items-center gap-4 animate-fade-in" suppressHydrationWarning>
          <div className="w-12 h-12 rounded-2xl bg-primary-500 flex items-center justify-center animate-pulse_slow" suppressHydrationWarning>
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none">
              <path d="M12 3c-1.5 0-3 .5-4 1.5L4 8v8l4 3.5c1 1 2.5 1.5 4 1.5s3-.5 4-1.5L20 16V8l-4-3.5C15 3.5 13.5 3 12 3Z"
                stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-sm text-primary-600 font-medium">Carregando Clínica Psi…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="app-shell" suppressHydrationWarning>
      {/* ── Sidebar ── */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* ── Navbar fixa ── */}
      <Navbar
        collapsed={collapsed}
        onMobileToggle={() => setMobileOpen(true)}
      />

      {/* ── Conteúdo principal ── */}
      <main
        className={cn(
          "main-content",
          collapsed && "sidebar-collapsed"
        )}
        suppressHydrationWarning
      >
        <div className="p-4 md:p-6 lg:p-8 animate-fade-in" suppressHydrationWarning>
          {children}
        </div>
      </main>
    </div>
  );
}
