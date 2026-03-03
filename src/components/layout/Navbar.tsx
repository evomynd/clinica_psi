"use client";

import { Menu, Bell, Search, Wifi } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useState } from "react";
import Link from "next/link";

interface NavbarProps {
  collapsed:      boolean;
  onMobileToggle: () => void;
}

export function Navbar({ collapsed, onMobileToggle }: NavbarProps) {
  const { user, userProfile }   = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);

  const displayName = user?.displayName ?? userProfile?.email?.split("@")[0] ?? "Usuário";
  const photoURL    = user?.photoURL;
  const crpText     = userProfile?.crp
    ? `CRP ${userProfile.crpUF}/${userProfile.crp}`
    : "Perfil incompleto";

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 h-16",
        "bg-white/80 backdrop-blur-sm border-b border-primary-100",
        "flex items-center justify-between gap-4 px-4",
        "transition-all duration-250",
        // Compensar largura da sidebar
        collapsed
          ? "left-[72px] md:left-[72px]"
          : "left-[260px] md:left-[260px]",
        "left-0 md:left-[inherit]"   // mobile: sem offset
      )}
    >
      {/* ─ Esquerda: hamburguer (mobile) + breadcrumb ─ */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileToggle}
          className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Barra de busca rápida (placeholder) */}
        <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-56 lg:w-72">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="search"
            placeholder="Buscar paciente, agenda..."
            className="bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none w-full"
            aria-label="Buscar"
          />
        </div>
      </div>

      {/* ─ Direita: ícones + avatar ─ */}
      <div className="flex items-center gap-2">
        {/* Status de Conexão (indicador simples) */}
        <div
          className="hidden sm:flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2.5 py-1 rounded-full"
          title="Conexão segura ativa"
        >
          <Wifi className="w-3 h-3" />
          <span className="font-medium">Segura</span>
        </div>

        {/* Notificações */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
            aria-label="Notificações"
          >
            <Bell className="w-5 h-5" />
            {/* Badge de pendências */}
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          {/* Dropdown de notificações */}
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-modal border border-slate-100 z-50 animate-slide-up">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800">Pendências</h3>
              </div>
              <ul className="divide-y divide-slate-50">
                <li className="px-4 py-3 hover:bg-slate-50 cursor-pointer">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium text-warning">2 contratos</span> aguardando assinatura
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Pacientes: Maria S., João P.</p>
                </li>
                <li className="px-4 py-3 hover:bg-slate-50 cursor-pointer">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium text-danger">1 pagamento</span> em atraso
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Sessão de 22/02/2026</p>
                </li>
              </ul>
              <div className="px-4 py-2 border-t border-slate-100">
                <Link
                  href="/dashboard"
                  onClick={() => setNotifOpen(false)}
                  className="text-xs text-primary-600 hover:underline font-medium"
                >
                  Ver todas →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Avatar do usuário */}
        <Link
          href="/configuracoes/perfil"
          className="flex items-center gap-2.5 pl-2 pr-3 py-1 rounded-xl hover:bg-slate-100 transition-colors"
          aria-label="Ir para o perfil"
        >
          {photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoURL}
              alt={displayName}
              className="w-8 h-8 rounded-full ring-2 ring-primary-200 object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-100 ring-2 ring-primary-200 flex items-center justify-center">
              <span className="text-xs font-bold text-primary-700">
                {getInitials(displayName)}
              </span>
            </div>
          )}
          <div className="hidden sm:block text-left">
            <p className="text-sm font-semibold text-slate-800 leading-none">{displayName}</p>
            <p className="text-xs text-slate-400 mt-0.5">{crpText}</p>
          </div>
        </Link>
      </div>
    </header>
  );
}
