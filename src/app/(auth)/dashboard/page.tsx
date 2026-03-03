"use client";

import { useEffect, useState } from "react";
import { startOfMonth, endOfMonth } from "date-fns";
import {
  Calendar,
  Users,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  Activity,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { 
  subscribeAgendamentosHoje, 
  buscarPacientesPorPsicologo,
  calcularResumoFinanceiro 
} from "@/lib/firebase/firestore";
import { formatDateTime, formatBRL } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { AgendamentoFirestore, PacienteFirestore } from "@/types/firestore";

// ─── Dados mockados para MVP ─────────────────────────────────────────────────
const MOCK_PENDENCIAS = [
  { tipo: "contrato",   label: "Contrato pendente",   paciente: "Maria Silva",   urgencia: "warning" },
  { tipo: "pagamento",  label: "Pagamento em atraso",  paciente: "João Pereira",  urgencia: "danger" },
  { tipo: "tcle",       label: "TCLE não assinado",    paciente: "Ana Souza",     urgencia: "warning" },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  agendado:   { label: "Agendado",   color: "bg-blue-100 text-blue-700" },
  confirmado: { label: "Confirmado", color: "bg-green-100 text-green-700" },
  realizado:  { label: "Realizado",  color: "bg-slate-100 text-slate-600" },
  cancelado:  { label: "Cancelado",  color: "bg-red-100 text-red-600" },
  remarcado:  { label: "Remarcado",  color: "bg-yellow-100 text-yellow-700" },
};

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, userProfile } = useAuth();
  const [agendamentosHoje, setAgendamentosHoje] = useState<AgendamentoFirestore[]>([]);
  const [pacientes,        setPacientes]        = useState<PacienteFirestore[]>([]);
  const [loadingAgenda,    setLoadingAgenda]    = useState(true);
  const [loadingPacientes, setLoadingPacientes] = useState(true);
  const [totalPendente,    setTotalPendente]    = useState<number>(0);
  const [totalRecebido,    setTotalRecebido]    = useState<number>(0);
  const [loadingFinanceiro, setLoadingFinanceiro] = useState(true);
  const [conexao,          setConexao]          = useState<{
    status: "idle" | "testando" | "ok" | "lento" | "erro";
    velocidade: number | null;
  }>({ status: "idle", velocidade: null });

  const displayName = user?.displayName ?? "Psicólogo(a)";
  const hora = new Date().getHours();
  const saudacao =
    hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  const pacientesAtivos = pacientes.filter((p) => p.ativo).length;
  const pacientesInativos = pacientes.length - pacientesAtivos;

  // ─── Pacientes map ────────────────────────────────────────────────────────────
  const pacientesMap: Record<string, string> = {};
  pacientes.forEach((p) => { if (p.id) pacientesMap[p.id] = p.nomeCompleto; });

  // ─── Real-time agendamentos de hoje ──────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setLoadingAgenda(true);
    const unsub = subscribeAgendamentosHoje(user.uid, (dados) => {
      setAgendamentosHoje(dados);
      setLoadingAgenda(false);
    });
    return unsub;
  }, [user]);

  // ─── Busca pacientes ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setLoadingPacientes(true);
    buscarPacientesPorPsicologo(user.uid)
      .then(setPacientes)
      .catch(console.error)
      .finally(() => setLoadingPacientes(false));
  }, [user]);
  // ─── Busca resumo financeiro do mês atual ───────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setLoadingFinanceiro(true);
    const inicio = startOfMonth(new Date());
    const fim = endOfMonth(new Date());
    calcularResumoFinanceiro(user.uid, inicio, fim)
      .then((resumo) => {
        setTotalPendente(resumo.totalPendente);
        setTotalRecebido(resumo.totalFaturado);
      })
      .catch(console.error)
      .finally(() => setLoadingFinanceiro(false));
  }, [user]);
  // ─── Diagnóstico de Conexão (simulado para MVP) ────────────────────────────
  async function testarConexao() {
    setConexao({ status: "testando", velocidade: null });
    await new Promise((r) => setTimeout(r, 1800));
    // Simula resultado: velocidade entre 10-100 Mbps
    const mbps = Math.round(10 + Math.random() * 90);
    const status = mbps >= 25 ? "ok" : mbps >= 10 ? "lento" : "erro";
    setConexao({ status, velocidade: mbps });
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-800">
            {saudacao}, {displayName.split(" ")[0]}! 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        {!userProfile?.crpAtivo && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Complete seu perfil com CRP para aparecer na vitrine pública.</span>
          </div>
        )}
      </div>

      {/* ── Cards de métricas ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          icon={<Calendar className="w-5 h-5 text-primary-600" />}
          label="Sessões hoje"
          value={loadingAgenda ? "—" : String(agendamentosHoje.length)}
          bg="bg-primary-50"
        />
        <MetricCard
          icon={<Users className="w-5 h-5 text-secondary-600" />}
          label="Pacientes ativos"
          value={loadingPacientes ? "—" : String(pacientesAtivos)}
          sublabel={loadingPacientes ? "carregando..." : `${pacientesInativos} inativo(s)`}
          bg="bg-blue-50"
        />
        <MetricCard
          icon={<DollarSign className="w-5 h-5 text-green-600" />}
          label="A receber (mês)"
          value={loadingFinanceiro ? "—" : formatBRL(totalPendente)}
          sublabel={loadingFinanceiro ? "carregando..." : totalPendente > 0 ? "pagamentos pendentes" : "tudo em dia"}
          bg="bg-green-50"
        />
        <MetricCard
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          label="Recebido (mês)"
          value={loadingFinanceiro ? "—" : formatBRL(totalRecebido)}
          sublabel={loadingFinanceiro ? "carregando..." : totalRecebido > 0 ? "pagamentos confirmados" : "sem recebimentos"}
          bg="bg-emerald-50"
        />
        <MetricCard
          icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
          label="Pendências"
          value={String(MOCK_PENDENCIAS.length)}
          sublabel="atenção necessária"
          bg="bg-amber-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Próximos atendimentos ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-card">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-500" />
              <h2 className="font-semibold text-slate-800">Próximos Atendimentos</h2>
            </div>
            <a href="/agenda" className="text-sm text-primary-600 hover:underline font-medium">
              Ver agenda →
            </a>
          </div>
          <div className="divide-y divide-slate-50">
            {loadingAgenda ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4">
                  <div className="skeleton w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3.5 w-40 rounded" />
                    <div className="skeleton h-3 w-24 rounded" />
                  </div>
                  <div className="skeleton h-6 w-20 rounded-full" />
                </div>
              ))
            ) : agendamentosHoje.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Sem agendamentos para hoje.</p>
                <p className="text-slate-400 text-sm mt-1">Aproveite para organizar sua semana!</p>
              </div>
            ) : (
              agendamentosHoje.map((item) => (
                <AgendamentoRow key={item.id ?? Math.random()} item={item} pacienteNome={pacientesMap[item.pacienteId] ?? item.pacienteId} />
              ))
            )}
          </div>
        </div>

        {/* ── Coluna direita ── */}
        <div className="space-y-4">
          {/* Alertas de Pendências */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="font-semibold text-slate-800 text-sm">Alertas de Pendências</h2>
            </div>
            <ul className="divide-y divide-slate-50">
              {MOCK_PENDENCIAS.map((p, i) => (
                <li key={i} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition-colors">
                  <span className={cn(
                    "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                    p.urgencia === "danger" ? "bg-red-500" : "bg-amber-500"
                  )} />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{p.label}</p>
                    <p className="text-xs text-slate-400">{p.paciente}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Diagnóstico de Conexão */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary-500" />
              <h2 className="font-semibold text-slate-800 text-sm">Diagnóstico de Conexão</h2>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-500">
                Teste a velocidade antes de iniciar um atendimento online.
              </p>

              {conexao.status === "idle" && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Wifi className="w-4 h-4" />
                  <span>Nenhum teste realizado</span>
                </div>
              )}

              {conexao.status === "testando" && (
                <div className="flex items-center gap-2 text-xs text-primary-600 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Testando conexão…</span>
                </div>
              )}

              {(conexao.status === "ok" || conexao.status === "lento" || conexao.status === "erro") && (
                <div className={cn(
                  "flex items-center gap-2 text-xs rounded-xl px-3 py-2",
                  conexao.status === "ok"    && "bg-green-50 text-green-700",
                  conexao.status === "lento" && "bg-yellow-50 text-yellow-700",
                  conexao.status === "erro"  && "bg-red-50 text-red-700",
                )}>
                  {conexao.status === "ok"
                    ? <Wifi className="w-4 h-4" />
                    : <WifiOff className="w-4 h-4" />}
                  <span>
                    {conexao.status === "ok"    && `Ótima! ${conexao.velocidade} Mbps — pronto.`}
                    {conexao.status === "lento" && `Instável (${conexao.velocidade} Mbps) — pode travar.`}
                    {conexao.status === "erro"  && "Conexão ruim — não recomendamos iniciar."}
                  </span>
                </div>
              )}

              <button
                onClick={testarConexao}
                disabled={conexao.status === "testando"}
                className={cn(
                  "w-full text-sm font-semibold py-2 rounded-xl transition-all",
                  "bg-primary-500 hover:bg-primary-600 text-white",
                  "disabled:opacity-60 disabled:cursor-wait"
                )}
              >
                {conexao.status === "testando" ? "Testando…" : "Testar Agora"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function MetricCard({
  icon, label, value, sublabel, bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 card-glow">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", bg)}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-800 font-heading">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
      {sublabel && <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>}
    </div>
  );
}

function AgendamentoRow({ item, pacienteNome }: { item: AgendamentoFirestore; pacienteNome: string }) {
  const st = STATUS_LABELS[item.status] ?? { label: item.status, color: "bg-slate-100 text-slate-600" };
  const dataHora = item.dataHora?.toDate?.() ?? new Date();

  return (
    <div className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
        <Clock className="w-5 h-5 text-primary-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {pacienteNome}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {formatDateTime(dataHora)} · {item.duracaoMinutos} min
        </p>
      </div>
      <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0", st.color)}>
        {st.label}
      </span>
    </div>
  );
}
