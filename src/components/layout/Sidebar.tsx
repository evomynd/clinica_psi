"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Video,
  DollarSign,
  Settings,
  Globe,
  ChevronLeft,
  ChevronRight,
  Brain,
  LogOut,
  Shield,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/useAuth";
import { logout } from "@/lib/firebase/auth";
import { subscribeTarefasPendentes } from "@/lib/firebase/firestore";
import { toast } from "sonner";

// ─── Rotas do menu ────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    label: "Dashboard",
    href:  "/dashboard",
    icon:  LayoutDashboard,
    roles: ["admin", "psicologo", "secretaria"],
  },
  {
    label: "Agenda",
    href:  "/agenda",
    icon:  Calendar,
    roles: ["admin", "psicologo", "secretaria"],
  },
  {
    label: "Pacientes",
    href:  "/pacientes",
    icon:  Users,
    roles: ["admin", "psicologo", "secretaria"],
  },
  {
    label: "Sala Virtual",
    href:  "/sala",
    icon:  Video,
    roles: ["admin", "psicologo"],
  },
  {
    label: "Financeiro",
    href:  "/financeiro",
    icon:  DollarSign,
    roles: ["admin", "psicologo"],
  },
  {
    label: "Tarefas",
    href:  "/tarefas",
    icon:  ListTodo,
    roles: ["admin", "psicologo", "secretaria"],
  },
  {
    label: "Vitrine Pública",
    href:  "/profissionais",
    icon:  Globe,
    roles: ["admin"],
    external: false,
    dividerBefore: true,
  },
  {
    label: "Configurações",
    href:  "/configuracoes",
    icon:  Settings,
    roles: ["admin", "psicologo", "secretaria"],
  },
] as const;

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname     = usePathname();
  const { userProfile } = useAuth();
  const role         = userProfile?.role ?? "psicologo";
  const userId       = userProfile?.uid ?? null;
  const [tarefasPendentes, setTarefasPendentes] = useState(0);

  const visibleItems = NAV_ITEMS.filter((item) =>
    (item.roles as readonly string[]).includes(role)
  );

  useEffect(() => {
    if (!userId) {
      setTarefasPendentes(0);
      return;
    }
    
    const unsubscribe = subscribeTarefasPendentes(userId, (count) => {
      setTarefasPendentes(count);
    });

    return () => unsubscribe();
  }, [userId]);

  async function handleLogout() {
    try {
      await logout();
      toast.success("Sessão encerrada com segurança.");
    } catch {
      toast.error("Erro ao sair. Tente novamente.");
    }
  }

  return (
    <>
      {/* ── Overlay mobile ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onMobileClose}
          aria-hidden
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-full flex flex-col",
          "bg-white border-r border-primary-100",
          "transition-all duration-250 ease-in-out",
          // Desktop
          collapsed ? "w-[72px]" : "w-[260px]",
          // Mobile
          "md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* ─ Logo ─ */}
        <div className={cn(
          "h-16 flex items-center border-b border-primary-100",
          "px-4 flex-shrink-0",
          collapsed ? "justify-center" : "justify-between"
        )}>
          <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0">
              <Brain className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <span className="font-heading font-bold text-primary-700 text-lg truncate">
                Clínica Psi
              </span>
            )}
          </Link>
          {/* Botão colapsar — desktop apenas */}
          <button
            onClick={onToggle}
            className={cn(
              "hidden md:flex items-center justify-center",
              "w-7 h-7 rounded-full bg-primary-50 hover:bg-primary-100",
              "text-primary-600 transition-colors flex-shrink-0",
              collapsed && "ml-0"
            )}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed
              ? <ChevronRight className="w-3.5 h-3.5" />
              : <ChevronLeft  className="w-3.5 h-3.5" />
            }
          </button>
        </div>

        {/* ─ Navegação ─ */}
        <nav className="flex-1 overflow-y-auto py-4 px-2" aria-label="Navegação principal">
          <ul className="space-y-0.5">
            {visibleItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon     = item.icon;

              return (
                <li key={item.href}>
                  {"dividerBefore" in item && item.dividerBefore && (
                    <div className="my-2 mx-2 border-t border-primary-100" />
                  )}
                  <Link
                    href={item.href}
                    onClick={onMobileClose}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl",
                      "text-sm font-medium transition-all duration-150",
                      "relative group",
                      isActive
                        ? "bg-primary-50 text-primary-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      collapsed && "justify-center px-2"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {/* Indicador ativo */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary-500 rounded-r-full" />
                    )}
                    <Icon
                      className={cn(
                        "w-5 h-5 flex-shrink-0",
                        isActive ? "text-primary-600" : "text-slate-400 group-hover:text-slate-600"
                      )}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    
                    {/* Badge de tarefas pendentes */}
                    {item.href === "/tarefas" && tarefasPendentes > 0 && (
                      <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold">
                        {tarefasPendentes}
                      </span>
                    )}

                    {/* Tooltip ao colapsar */}
                    {collapsed && (
                      <div className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-white text-xs rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                        {item.label}
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ─ Rodapé: Perfil + Logout ─ */}
        <div className="border-t border-primary-100 p-2 flex-shrink-0 space-y-1">
          {/* LGPD Badge */}
          {!collapsed && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs">
              <Shield className="w-3 h-3" />
              <span>LGPD Compliant</span>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl",
              "text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600",
              "transition-colors",
              collapsed && "justify-center"
            )}
            aria-label="Sair da conta"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
