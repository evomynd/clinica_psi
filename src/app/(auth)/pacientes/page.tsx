"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Users, Plus, Search, UserCheck, UserX,
  Phone, Mail, Calendar, ChevronRight, Loader2,
  MoreVertical, UserMinus, UserPlus, Edit2,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  buscarPacientesPorPsicologo,
  togglePacienteAtivo,
} from "@/lib/firebase/firestore";
import { formatDate, calcularIdade, maskPhone, cn, getInitials } from "@/lib/utils";
import { PacienteModal } from "@/components/pacientes/PacienteModal";
import { PacienteDetalhePanel } from "@/components/pacientes/PacienteDetalhePanel";
import { NovoAgendamentoModal } from "@/components/agenda/NovoAgendamentoModal";
import type { PacienteFirestore } from "@/types/firestore";
import { toast } from "sonner";

type Filtro = "todos" | "ativos" | "inativos";

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function PacientesPage() {
  const { user } = useAuth();
  const [pacientes,        setPacientes]        = useState<PacienteFirestore[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [busca,            setBusca]            = useState("");
  const [filtro,           setFiltro]           = useState<Filtro>("ativos");
  const [selecionado,      setSelecionado]      = useState<PacienteFirestore | null>(null);
  const [modalOpen,        setModalOpen]        = useState(false);
  const [editandoPaciente, setEditandoPaciente] = useState<PacienteFirestore | null>(null);
  const [menuAberto,       setMenuAberto]       = useState<string | null>(null);
  const [modalAtalhoAgendamento, setModalAtalhoAgendamento] = useState(false);
  const [modalAgendamentoOpen, setModalAgendamentoOpen] = useState(false);
  const [pacienteAgendamentoId, setPacienteAgendamentoId] = useState<string | undefined>(undefined);
  const [pacienteAgendamentoNome, setPacienteAgendamentoNome] = useState<string>("paciente");

  // ─── Carrega pacientes ──────────────────────────────────────────────────────
  async function carregar() {
    if (!user) return;
    setLoading(true);
    try {
      const todos = await buscarPacientesPorPsicologo(user.uid);
      setPacientes(todos);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar pacientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!selecionado?.id) return;
    const atualizado = pacientes.find((p) => p.id === selecionado.id);
    if (!atualizado) {
      setSelecionado(null);
      return;
    }
    setSelecionado(atualizado);
  }, [pacientes, selecionado?.id]);

  // ─── Filtragem ──────────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    let lista = pacientes;
    if (filtro === "ativos")   lista = lista.filter((p) => p.ativo);
    if (filtro === "inativos") lista = lista.filter((p) => !p.ativo);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter(
        (p) =>
          p.nomeCompleto.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.telefone.includes(q)
      );
    }
    return lista;
  }, [pacientes, filtro, busca]);

  const total    = pacientes.length;
  const ativos   = pacientes.filter((p) => p.ativo).length;
  const inativos = total - ativos;

  // ─── Ações ──────────────────────────────────────────────────────────────────
  async function handleToggleAtivo(p: PacienteFirestore) {
    if (!p.id) return;
    try {
      await togglePacienteAtivo(p.id, !p.ativo);
      toast.success(p.ativo ? "Paciente desativado" : "Paciente reativado");
      setPacientes((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, ativo: !p.ativo } : x))
      );
      if (selecionado?.id === p.id) {
        setSelecionado((prev) => prev ? { ...prev, ativo: !p.ativo } : null);
      }
    } catch {
      toast.error("Erro ao alterar status do paciente");
    }
    setMenuAberto(null);
  }

  function abrirEdicao(p: PacienteFirestore) {
    setEditandoPaciente(p);
    setModalOpen(true);
    setMenuAberto(null);
  }

  function abrirNovo() {
    setEditandoPaciente(null);
    setModalOpen(true);
  }

  function fecharModal() {
    setModalOpen(false);
    setEditandoPaciente(null);
  }

  async function handleModalSuccess(pacienteId: string, nomePaciente?: string) {
    await carregar();

    // Atalho apenas para NOVO cadastro (não edição)
    if (!editandoPaciente) {
      setPacienteAgendamentoId(pacienteId);
      setPacienteAgendamentoNome(nomePaciente?.trim() || "paciente");
      setModalAtalhoAgendamento(true);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 -m-6">
      {/* ── Coluna principal ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-white flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-heading font-bold text-slate-800">Pacientes</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Gerencie seus pacientes e anotações clínicas
              </p>
            </div>
            <button
              onClick={abrirNovo}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Novo Paciente
            </button>
          </div>

          {/* Stats */}
          <div className="flex gap-3 mb-4">
            <StatChip icon={<Users     className="w-3.5 h-3.5" />} label="Total"    value={total}    color="text-slate-600" onClick={() => setFiltro("todos")}    active={filtro === "todos"} />
            <StatChip icon={<UserCheck className="w-3.5 h-3.5" />} label="Ativos"   value={ativos}   color="text-green-600" onClick={() => setFiltro("ativos")}   active={filtro === "ativos"} />
            <StatChip icon={<UserX     className="w-3.5 h-3.5" />} label="Inativos" value={inativos} color="text-slate-400" onClick={() => setFiltro("inativos")} active={filtro === "inativos"} />
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome, e-mail ou telefone…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-slate-50"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
              <p className="text-slate-400 text-sm">Carregando pacientes…</p>
            </div>
          ) : filtrados.length === 0 ? (
            <EmptyState busca={busca} filtro={filtro} onNovo={abrirNovo} />
          ) : (
            <ul className="divide-y divide-slate-50">
              {filtrados.map((p) => (
                <PacienteRow
                  key={p.id}
                  paciente={p}
                  selecionado={selecionado?.id === p.id}
                  menuAberto={menuAberto === p.id}
                  onClick={() => setSelecionado(selecionado?.id === p.id ? null : p)}
                  onMenuToggle={() => setMenuAberto(menuAberto === p.id ? null : (p.id ?? null))}
                  onEdit={() => abrirEdicao(p)}
                  onToggleAtivo={() => handleToggleAtivo(p)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Painel lateral de detalhes ── */}
      {selecionado && (
        <PacienteDetalhePanel
          paciente={selecionado}
          onClose={() => setSelecionado(null)}
          onEditClick={() => abrirEdicao(selecionado)}
          onPacienteUpdated={carregar}
        />
      )}

      {/* ── Modal de cadastro/edição ── */}
      <PacienteModal
        open={modalOpen}
        paciente={editandoPaciente}
        onClose={fecharModal}
        onSuccess={handleModalSuccess}
      />

      <NovoAgendamentoModal
        open={modalAgendamentoOpen}
        pacientePreSelecionadoId={pacienteAgendamentoId}
        onClose={() => {
          setModalAgendamentoOpen(false);
          setPacienteAgendamentoId(undefined);
        }}
        onSuccess={() => setModalAgendamentoOpen(false)}
      />

      {modalAtalhoAgendamento && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-slate-800">Paciente cadastrado com sucesso 🎉</h3>
            <p className="text-sm text-slate-500 mt-2">
              Deseja já criar um agendamento para <span className="font-medium text-slate-700">{pacienteAgendamentoNome}</span>?
            </p>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setModalAtalhoAgendamento(false);
                  setPacienteAgendamentoId(undefined);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalAtalhoAgendamento(false);
                  setModalAgendamentoOpen(true);
                }}
                className="px-4 py-2 text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-colors"
              >
                Sim, agendar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fecha menu ao clicar fora */}
      {menuAberto && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(null)} />
      )}
    </div>
  );
}

// ─── Sub: Linha de paciente ───────────────────────────────────────────────────
interface PacienteRowProps {
  paciente:     PacienteFirestore;
  selecionado:  boolean;
  menuAberto:   boolean;
  onClick:      () => void;
  onMenuToggle: () => void;
  onEdit:       () => void;
  onToggleAtivo:() => void;
}

function PacienteRow({ paciente, selecionado, menuAberto, onClick, onMenuToggle, onEdit, onToggleAtivo }: PacienteRowProps) {
  const nascimento = paciente.dataNascimento?.toDate?.() ?? null;
  const idade      = nascimento ? calcularIdade(nascimento) : null;
  const pendencias = [
    !paciente.consentimentoTCLE?.assinado && "TCLE",
    !paciente.contratoAssinado            && "Contrato",
  ].filter(Boolean);

  return (
    <li
      className={cn(
        "flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors relative",
        selecionado && "bg-primary-50/60 border-r-2 border-primary-500"
      )}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold",
        paciente.ativo ? "bg-primary-100 text-primary-700" : "bg-slate-100 text-slate-400"
      )}>
        {getInitials(paciente.nomeCompleto)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn(
            "text-sm font-semibold truncate",
            paciente.ativo ? "text-slate-800" : "text-slate-400"
          )}>
            {paciente.nomeCompleto}
          </p>
          {!paciente.ativo && (
            <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
              inativo
            </span>
          )}
          {pendencias.length > 0 && (
            <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
              ⚠ {pendencias.join(", ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {paciente.email && (
            <span className="flex items-center gap-1 text-xs text-slate-400 truncate">
              <Mail className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[140px]">{paciente.email}</span>
            </span>
          )}
          {paciente.telefone && (
            <span className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
              <Phone className="w-3 h-3" />
              {maskPhone(paciente.telefone)}
            </span>
          )}
          {idade !== null && (
            <span className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
              <Calendar className="w-3 h-3" />
              {idade} anos
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <button
            onClick={onMenuToggle}
            className="p-2 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuAberto && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20 w-44">
              <button
                onClick={onEdit}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                <Edit2 className="w-4 h-4" /> Editar
              </button>
              <button
                onClick={onToggleAtivo}
                className={cn(
                  "flex items-center gap-2.5 w-full px-4 py-2.5 text-sm",
                  paciente.ativo
                    ? "text-amber-600 hover:bg-amber-50"
                    : "text-green-600 hover:bg-green-50"
                )}
              >
                {paciente.ativo
                  ? <><UserMinus className="w-4 h-4" /> Desativar</>
                  : <><UserPlus  className="w-4 h-4" /> Reativar</>
                }
              </button>
            </div>
          )}
        </div>
        <ChevronRight className={cn(
          "w-4 h-4 transition-colors",
          selecionado ? "text-primary-500" : "text-slate-200"
        )} />
      </div>
    </li>
  );
}

// ─── Sub: Estado vazio ────────────────────────────────────────────────────────
function EmptyState({ busca, filtro, onNovo }: { busca: string; filtro: Filtro; onNovo: () => void }) {
  if (busca) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <Search className="w-10 h-10 text-slate-200" />
        <p className="text-slate-500 font-medium">Nenhum resultado para &quot;{busca}&quot;</p>
        <p className="text-slate-400 text-sm">Tente buscar por outro nome, e-mail ou telefone</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Users className="w-12 h-12 text-slate-200" />
      <p className="text-slate-500 font-medium">
        {filtro === "inativos" ? "Nenhum paciente inativo" : "Nenhum paciente cadastrado"}
      </p>
      {filtro !== "inativos" && (
        <>
          <p className="text-slate-400 text-sm">Cadastre seu primeiro paciente para começar</p>
          <button
            onClick={onNovo}
            className="mt-2 flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo Paciente
          </button>
        </>
      )}
    </div>
  );
}

// ─── Sub: Chip de stat ────────────────────────────────────────────────────────
function StatChip({
  icon, label, value, color, onClick, active,
}: {
  icon: React.ReactNode; label: string; value: number;
  color: string; onClick: () => void; active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all",
        active
          ? "bg-white border-primary-300 shadow-sm"
          : "bg-slate-50 border-transparent hover:border-slate-200"
      )}
    >
      <span className={color}>{icon}</span>
      <span className="text-slate-500">{label}</span>
      <span className={cn("font-bold", color)}>{value}</span>
    </button>
  );
}
