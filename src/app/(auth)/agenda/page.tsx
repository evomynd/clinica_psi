"use client";

import { useState, useEffect, useCallback } from "react";
import {
  format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, setHours, setMinutes,
  getDay, isWeekend,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, Settings2, ChevronLeft, ChevronRight, LayoutGrid, Columns, CalendarDays,
  Loader2, Pencil, Video, Copy, MessageCircle,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  subscribeAgendamentosPeriodo,
  subscribeTarefasPeriodo,
  buscarPacientesPorPsicologo,
  atualizarAgendamento,
  atualizarTarefa,
  cancelarAgendamento,
  cancelarAgendamentosFuturosDaRecorrencia,
  buscarAgendamentosDaRecorrenciaAPartirDe,
  criarTarefa,
} from "@/lib/firebase/firestore";
import { cn, formatBRL } from "@/lib/utils";
import { AgendaCalendar } from "@/components/agenda/AgendaCalendar";
import { NovoAgendamentoModal } from "@/components/agenda/NovoAgendamentoModal";
import { DisponibilidadeModal } from "@/components/agenda/DisponibilidadeModal";
import type { AgendamentoFirestore, PacienteFirestore, TarefaFirestore } from "@/types/firestore";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";

type ViewMode = "mes" | "semana" | "dia";

const STATUS_LABELS: Record<AgendamentoFirestore["status"], string> = {
  agendado:   "Agendado",
  confirmado: "Confirmado",
  realizado:  "Realizado",
  cancelado:  "Cancelado",
  remarcado:  "Remarcado",
};

const STATUS_COLORS: Record<AgendamentoFirestore["status"], string> = {
  agendado:   "bg-blue-100 text-blue-700",
  confirmado: "bg-primary-100 text-primary-700",
  realizado:  "bg-slate-100 text-slate-600",
  cancelado:  "bg-red-100 text-red-600",
  remarcado:  "bg-yellow-100 text-yellow-700",
};

// ─── Painel de detalhes ───────────────────────────────────────────────────────
interface EventDetailPanelProps {
  agendamento:      AgendamentoFirestore | null;
  pacienteNome:     string;
  pacienteTelefone: string;
  terapeutaNome:    string;
  onClose:          () => void;
  onEdit:           (agendamento: AgendamentoFirestore) => void;
  onConfirm:        (id: string) => void;
  onCancel:         (id: string) => void;
  onRealizado:      (id: string) => void;
}

function EventDetailPanel({ agendamento, pacienteNome, pacienteTelefone, terapeutaNome, onClose, onEdit, onConfirm, onCancel, onRealizado }: EventDetailPanelProps) {
  if (!agendamento) return null;
  const dataHora = agendamento.dataHora.toDate();

  const copiarLink = () => {
    const link = `${window.location.origin}/sessao?sala=${agendamento.linkSala}`;
    navigator.clipboard.writeText(link).then(() => {
      toast.success("Link copiado!");
    }).catch(() => {
      toast.error("Erro ao copiar link");
    });
  };

  const enviarWhatsApp = () => {
    if (!pacienteTelefone) {
      toast.error("Telefone do paciente não cadastrado");
      return;
    }
    const link = `${window.location.origin}/sessao?sala=${agendamento.linkSala}`;
    const dataFormatada = format(dataHora, "dd/MM/yyyy", { locale: ptBR });
    const horaFormatada = format(dataHora, "HH:mm", { locale: ptBR });
    const mensagem = `Olá! Sou ${terapeutaNome}. Sua sessão está agendada para *${dataFormatada}* às *${horaFormatada}h*.\n\nLink da Sala Virtual: ${link}\n\nPor favor, confirme sua presença.`;
    const telefone = pacienteTelefone.replace(/\D/g, ""); // Remove caracteres não numéricos
    const whatsappUrl = `https://web.whatsapp.com/send?phone=55${telefone}&text=${encodeURIComponent(mensagem)}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <div className="w-72 flex-shrink-0 border-l border-slate-100 bg-white flex flex-col">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 text-sm">Detalhes da Sessão</h3>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">✕ fechar</button>
      </div>
      <div className="p-4 space-y-3 flex-1 overflow-y-auto">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Paciente</p>
          <p className="font-semibold text-slate-800 mt-0.5">{pacienteNome}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Data e Hora</p>
          <p className="font-medium text-slate-700 mt-0.5">{format(dataHora, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Duração</p>
            <p className="font-medium text-slate-700 mt-0.5">{agendamento.duracaoMinutos} min</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Tipo</p>
            <p className="font-medium text-slate-700 mt-0.5 capitalize">{agendamento.tipoAtendimento.replace("_", " ")}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Status</p>
          <span className={cn("inline-flex mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[agendamento.status])}>
            {STATUS_LABELS[agendamento.status]}
          </span>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Pagamento</p>
          <p className="font-medium text-slate-700 mt-0.5">
            {formatBRL(agendamento.pagamento.valor)} — <span className="capitalize">{agendamento.pagamento.status}</span>
          </p>
        </div>
        {agendamento.observacoes && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Observações</p>
            <p className="text-sm text-slate-600 mt-0.5">{agendamento.observacoes}</p>
          </div>
        )}
      </div>
      {agendamento.status !== "cancelado" && agendamento.status !== "realizado" && (
        <div className="p-4 border-t border-slate-100 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={copiarLink}
              className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Copiar Link
            </button>
            <button
              onClick={enviarWhatsApp}
              className="px-3 py-2 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </button>
          </div>
          <a
            href={`/sessao?sala=${agendamento.linkSala}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-3 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
          >
            <Video className="w-4 h-4" />
            Entrar na Sala Virtual
          </a>
          <button
            onClick={() => onEdit(agendamento)}
            className="w-full px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            Editar Agendamento
          </button>
          {agendamento.status === "agendado" && (
            <button
              onClick={() => onConfirm(agendamento.id!)}
              className="w-full px-3 py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Confirmar Sessão
            </button>
          )}
          {(agendamento.status === "agendado" || agendamento.status === "confirmado") && (
            <button
              onClick={() => onRealizado(agendamento.id!)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              Marcar como Realizado
            </button>
          )}
          <button
            onClick={() => onCancel(agendamento.id!)}
            className="w-full px-3 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors"
          >
            Cancelar Sessão
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Utilitário: próximo horário comercial ───────────────────────────────────
function obterProximoHorarioComercial(): Date {
  const agora = new Date();
  const hora = agora.getHours();
  const diaAtual = getDay(agora);
  
  // Se é fim de semana (sábado=6, domingo=0), vai para segunda às 9h
  if (isWeekend(agora)) {
    const diasAteSegunda = diaAtual === 0 ? 1 : (8 - diaAtual);
    const proximaSegunda = addDays(agora, diasAteSegunda);
    return setMinutes(setHours(proximaSegunda, 9), 0);
  }
  
  // Se é dia útil depois das 18h, vai para próximo dia útil às 9h
  if (hora >= 18) {
    const proximoDia = addDays(agora, 1);
    const proximoDiaNumero = getDay(proximoDia);
    
    // Se o próximo dia é sábado, pula para segunda
    if (proximoDiaNumero === 6) {
      return setMinutes(setHours(addDays(agora, 3), 9), 0);
    }
    // Se o próximo dia é domingo, pula para segunda
    if (proximoDiaNumero === 0) {
      return setMinutes(setHours(addDays(agora, 2), 9), 0);
    }
    
    return setMinutes(setHours(proximoDia, 9), 0);
  }
  
  // Se é dia útil antes das 18h, sugere hoje se já passou das 9h, ou 9h se ainda não
  if (hora < 9) {
    return setMinutes(setHours(agora, 9), 0);
  }
  
  return agora;
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AgendaPage() {
  const { user, userProfile } = useAuth();

  const [viewMode,     setViewMode]     = useState<ViewMode>("semana");
  const [currentDate,  setCurrentDate]  = useState(new Date());
  const [agendamentos, setAgendamentos] = useState<AgendamentoFirestore[]>([]);
  const [tarefas,      setTarefas]      = useState<TarefaFirestore[]>([]);
  const [pacientes,    setPacientes]    = useState<PacienteFirestore[]>([]);
  const [loading,      setLoading]      = useState(true);

  const [modalNovo,          setModalNovo]          = useState(false);
  const [modalDisp,          setModalDisp]          = useState(false);
  const [slotSelecionado,    setSlotSelecionado]    = useState<Date | undefined>();
  const [eventoSelecionado,  setEventoSelecionado]  = useState<AgendamentoFirestore | null>(null);
  const [agendamentoEditando, setAgendamentoEditando] = useState<AgendamentoFirestore | null>(null);
  const [modalCancelarRecorrencia, setModalCancelarRecorrencia] = useState(false);
  const [agendamentoParaCancelar, setAgendamentoParaCancelar] = useState<AgendamentoFirestore | null>(null);
  const [modalReembolso, setModalReembolso] = useState(false);
  const [agendamentosPagosParaCancelar, setAgendamentosPagosParaCancelar] = useState<AgendamentoFirestore[]>([]);
  const [agendamentosNaoPagosParaCancelar, setAgendamentosNaoPagosParaCancelar] = useState<AgendamentoFirestore[]>([]);
  const [tarefaSelecionada, setTarefaSelecionada] = useState<TarefaFirestore | null>(null);
  const [tarefaData, setTarefaData] = useState("");
  const [tarefaHora, setTarefaHora] = useState("");
  const [salvandoTarefa, setSalvandoTarefa] = useState(false);

  const pacientesMap: Record<string, string> = {};
  const pacientesTelefoneMap: Record<string, string> = {};
  pacientes.forEach((p) => {
    if (p.id) {
      pacientesMap[p.id] = p.nomeCompleto;
      pacientesTelefoneMap[p.id] = p.telefone;
    }
  });

  const periodoVisivel = useCallback(() => {
    if (viewMode === "mes") {
      return {
        inicio: startOfWeek(startOfMonth(currentDate), { locale: ptBR }),
        fim:    endOfWeek(endOfMonth(currentDate),     { locale: ptBR }),
      };
    }
    if (viewMode === "semana") {
      return {
        inicio: startOfWeek(currentDate, { locale: ptBR }),
        fim:    endOfWeek(currentDate,   { locale: ptBR }),
      };
    }
    const d = new Date(currentDate); d.setHours(0, 0, 0, 0);
    const f = new Date(currentDate); f.setHours(23, 59, 59, 999);
    return { inicio: d, fim: f };
  }, [viewMode, currentDate]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const { inicio, fim } = periodoVisivel();
    const unsub = subscribeAgendamentosPeriodo(user.uid, inicio, fim, (dados) => {
      setAgendamentos(dados);
      setLoading(false);
    });
    return unsub;
  }, [user, periodoVisivel]);

  useEffect(() => {
    if (!user) return;
    buscarPacientesPorPsicologo(user.uid).then(setPacientes).catch(console.error);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const { inicio, fim } = periodoVisivel();
    const unsub = subscribeTarefasPeriodo(user.uid, inicio, fim, setTarefas);
    return unsub;
  }, [user, periodoVisivel]);

  useEffect(() => {
    if (!tarefaSelecionada?.dataHora) {
      setTarefaData("");
      setTarefaHora("");
      return;
    }
    const dt = tarefaSelecionada.dataHora.toDate();
    setTarefaData(format(dt, "yyyy-MM-dd"));
    setTarefaHora(format(dt, "HH:mm"));
  }, [tarefaSelecionada]);

  function navAnterior() {
    if (viewMode === "mes")    setCurrentDate((d) => subMonths(d, 1));
    if (viewMode === "semana") setCurrentDate((d) => subWeeks(d, 1));
    if (viewMode === "dia")    setCurrentDate((d) => subDays(d, 1));
  }
  function navProximo() {
    if (viewMode === "mes")    setCurrentDate((d) => addMonths(d, 1));
    if (viewMode === "semana") setCurrentDate((d) => addWeeks(d, 1));
    if (viewMode === "dia")    setCurrentDate((d) => addDays(d, 1));
  }

  function labelPeriodo() {
    if (viewMode === "mes")    return format(currentDate, "MMMM yyyy", { locale: ptBR });
    if (viewMode === "semana") {
      const ini = startOfWeek(currentDate, { locale: ptBR });
      const fim = endOfWeek(currentDate,   { locale: ptBR });
      return `${format(ini, "d MMM", { locale: ptBR })} – ${format(fim, "d MMM yyyy", { locale: ptBR })}`;
    }
    return format(currentDate, "d 'de' MMMM, yyyy", { locale: ptBR });
  }

  async function handleConfirmar(id: string) {
    try { await atualizarAgendamento(id, { status: "confirmado" }); toast.success("Sessão confirmada!"); setEventoSelecionado((ev) => ev?.id === id ? { ...ev, status: "confirmado" } : ev); }
    catch { toast.error("Erro ao confirmar."); }
  }
  async function cancelarSomenteEsta(agendamento: AgendamentoFirestore) {
    if (!agendamento.id) return;
    await cancelarAgendamento(agendamento.id);
    toast.success("Sessão cancelada.");
    setEventoSelecionado(null);
  }

  async function prepararReembolso(
    pagos: AgendamentoFirestore[],
    naoPagos: AgendamentoFirestore[] = []
  ) {
    setAgendamentosPagosParaCancelar(pagos);
    setAgendamentosNaoPagosParaCancelar(naoPagos);
    setModalReembolso(true);
  }

  async function finalizarCancelamentoComReembolso(devolver: boolean) {
    try {
      await Promise.all(
        agendamentosPagosParaCancelar.map(async (ag) => {
          if (!ag.id) return;

          await atualizarAgendamento(ag.id, {
            status: "cancelado",
            pagamento: {
              ...ag.pagamento,
              status: devolver ? "reembolsado" : "pago",
            },
          });

          if (devolver && user?.uid && userProfile?.clinicaId) {
            const dataHoraSugerida = obterProximoHorarioComercial();
            await criarTarefa({
              userId: user.uid,
              clinicaId: userProfile.clinicaId,
              titulo: `Reembolsar paciente (${ag.pagamento.valor.toFixed(2)})`,
              descricao: `Paciente ${pacientesMap[ag.pacienteId] ?? ag.pacienteId} - sessão ${format(ag.dataHora.toDate(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
              status: "pendente",
              dataHora: Timestamp.fromDate(dataHoraSugerida),
              origem: "reembolso",
              concluidaEm: null,
            });
          }
        })
      );

      if (agendamentosNaoPagosParaCancelar.length && user?.uid) {
        const temRecorrencia = !!agendamentosNaoPagosParaCancelar[0].recorrenciaId;
        if (temRecorrencia) {
          const base = agendamentosNaoPagosParaCancelar[0];
          await cancelarAgendamentosFuturosDaRecorrencia(
            user.uid,
            base.recorrenciaId!,
            base.dataHora.toDate(),
            true,
            true
          );
        } else {
          await Promise.all(
            agendamentosNaoPagosParaCancelar.map((ag) => (ag.id ? cancelarAgendamento(ag.id) : Promise.resolve()))
          );
        }
      }

      toast.success(
        devolver
          ? "Cancelamento realizado. Reembolso registrado em Tarefas."
          : "Cancelamento realizado sem devolução."
      );
    } catch (err) {
      console.error(err);
      toast.error("Erro ao processar cancelamento.");
    } finally {
      setModalReembolso(false);
      setAgendamentosPagosParaCancelar([]);
      setAgendamentosNaoPagosParaCancelar([]);
      setEventoSelecionado(null);
    }
  }

  async function cancelarEstaEFuturas(agendamento: AgendamentoFirestore) {
    if (!agendamento.recorrenciaId) return;
    if (!user?.uid) {
      toast.error("Usuário não autenticado.");
      return;
    }

    const alvos = await buscarAgendamentosDaRecorrenciaAPartirDe(
      user.uid,
      agendamento.recorrenciaId,
      agendamento.dataHora.toDate(),
      true
    );

    const pagos = alvos.filter((a) => a.pagamento?.status === "pago");
    const naoPagos = alvos.filter((a) => a.pagamento?.status !== "pago");

    if (pagos.length > 0) {
      await prepararReembolso(pagos, naoPagos);
      return;
    }

    const qtd = await cancelarAgendamentosFuturosDaRecorrencia(
      user.uid,
      agendamento.recorrenciaId,
      agendamento.dataHora.toDate(),
      true,
      true
    );
    toast.success(`${qtd} sessão(ões) da recorrência removida(s) do calendário.`);
    setEventoSelecionado(null);
  }

  async function handleCancelar(id: string) {
    const agendamento = agendamentos.find((a) => a.id === id) ?? eventoSelecionado;
    if (!agendamento) {
      toast.error("Agendamento não encontrado.");
      return;
    }

    try {
      if (agendamento.recorrenciaId) {
        setAgendamentoParaCancelar(agendamento);
        setModalCancelarRecorrencia(true);
        return;
      }

      if (agendamento.pagamento?.status === "pago") {
        await prepararReembolso([agendamento], []);
        return;
      }

      await cancelarSomenteEsta(agendamento);
    }
    catch { toast.error("Erro ao cancelar."); }
  }
  async function handleRealizado(id: string) {
    try { await atualizarAgendamento(id, { status: "realizado" }); toast.success("Sessão realizada!"); setEventoSelecionado((ev) => ev?.id === id ? { ...ev, status: "realizado" } : ev); }
    catch { toast.error("Erro ao atualizar."); }
  }

  function handleSlotClick(date: Date) { setSlotSelecionado(date); setAgendamentoEditando(null); setModalNovo(true); setEventoSelecionado(null); }
  function handleEventClick(ag: AgendamentoFirestore) { setEventoSelecionado(ag); }
  function handleTaskClick(tarefa: TarefaFirestore) {
    setEventoSelecionado(null);
    setTarefaSelecionada(tarefa);
  }

  async function concluirOuReabrirTarefa() {
    if (!tarefaSelecionada?.id) return;
    try {
      setSalvandoTarefa(true);
      const novoStatus = tarefaSelecionada.status === "pendente" ? "concluida" : "pendente";
      await atualizarTarefa(tarefaSelecionada.id, {
        status: novoStatus,
        concluidaEm: novoStatus === "concluida" ? Timestamp.fromDate(new Date()) : null,
      });
      toast.success(novoStatus === "concluida" ? "Tarefa marcada como concluída." : "Tarefa reaberta.");
      setTarefaSelecionada((prev) => (prev ? { ...prev, status: novoStatus } : prev));
    } catch {
      toast.error("Erro ao atualizar tarefa.");
    } finally {
      setSalvandoTarefa(false);
    }
  }

  async function salvarNovaDataHoraTarefa() {
    if (!tarefaSelecionada?.id) return;
    if (!tarefaData || !tarefaHora) {
      toast.error("Informe data e hora para remarcar.");
      return;
    }

    const novaData = new Date(`${tarefaData}T${tarefaHora}:00`);
    if (Number.isNaN(novaData.getTime())) {
      toast.error("Data/hora inválida.");
      return;
    }

    try {
      setSalvandoTarefa(true);
      await atualizarTarefa(tarefaSelecionada.id, {
        dataHora: Timestamp.fromDate(novaData),
      });
      toast.success("Tarefa remarcada com sucesso.");
      setTarefaSelecionada(null);
    } catch {
      toast.error("Erro ao remarcar tarefa.");
    } finally {
      setSalvandoTarefa(false);
    }
  }

  function handleEditar(ag: AgendamentoFirestore) {
    setAgendamentoEditando(ag);
    setModalNovo(true);
    setEventoSelecionado(null);
  }

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-slate-100 bg-white">
        <div className="flex-1">
          <h1 className="text-xl font-heading font-bold text-slate-800">Agenda</h1>
          <p className="text-xs text-slate-400 mt-0.5">Sessões e disponibilidade</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalDisp(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">Disponibilidade</span>
          </button>
          <button
            onClick={() => { setSlotSelecionado(undefined); setAgendamentoEditando(null); setModalNovo(true); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Sessão</span>
          </button>
        </div>
      </div>

      {/* Controles navegação + view */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-100 bg-white">
        <button onClick={navAnterior} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">
          Hoje
        </button>
        <button onClick={navProximo} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
        <h2 className="flex-1 font-semibold text-slate-800 text-sm capitalize">{labelPeriodo()}</h2>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        <div className="flex items-center rounded-lg border border-slate-200 p-0.5">
          {([
            { key: "mes",    icon: LayoutGrid, label: "Mês" },
            { key: "semana", icon: Columns,    label: "Semana" },
            { key: "dia",    icon: CalendarDays, label: "Dia" },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setViewMode(key)} title={label}
              className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                viewMode === key ? "bg-primary-500 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50")}>
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Corpo */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden bg-white flex flex-col">
          <AgendaCalendar
            agendamentos={agendamentos}
            tarefas={tarefas}
            pacientesMap={pacientesMap}
            onSlotClick={handleSlotClick}
            onEventClick={handleEventClick}
            onTaskClick={handleTaskClick}
            viewMode={viewMode}
            currentDate={currentDate}
          />
        </div>
        {eventoSelecionado && (
          <EventDetailPanel
            agendamento={eventoSelecionado}
            pacienteNome={pacientesMap[eventoSelecionado.pacienteId] ?? "Paciente"}
            pacienteTelefone={pacientesTelefoneMap[eventoSelecionado.pacienteId] ?? ""}
            terapeutaNome={userProfile?.displayName ?? "Terapeuta"}
            onClose={() => setEventoSelecionado(null)}
            onEdit={handleEditar}
            onConfirm={handleConfirmar}
            onCancel={handleCancelar}
            onRealizado={handleRealizado}
          />
        )}
      </div>

      {/* Modais */}
      <NovoAgendamentoModal
        open={modalNovo}
        dataPreSelecionada={slotSelecionado}
        agendamentoEditavel={agendamentoEditando}
        onClose={() => { setModalNovo(false); setSlotSelecionado(undefined); setAgendamentoEditando(null); }}
        onSuccess={() => { setModalNovo(false); setAgendamentoEditando(null); }}
      />
      <DisponibilidadeModal
        open={modalDisp}
        onClose={() => setModalDisp(false)}
      />

      {modalCancelarRecorrencia && agendamentoParaCancelar && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setModalCancelarRecorrencia(false);
              setAgendamentoParaCancelar(null);
            }}
          />

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-slate-800">Cancelar sessão recorrente</h3>
            <p className="text-sm text-slate-500 mt-2">
              Este agendamento faz parte de uma recorrência. Escolha como deseja cancelar:
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (agendamentoParaCancelar.pagamento?.status === "pago") {
                      await prepararReembolso([agendamentoParaCancelar], []);
                    } else {
                      await cancelarSomenteEsta(agendamentoParaCancelar);
                    }
                  } catch {
                    toast.error("Erro ao cancelar sessão.");
                  } finally {
                    setModalCancelarRecorrencia(false);
                    setAgendamentoParaCancelar(null);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Somente esta
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await cancelarEstaEFuturas(agendamentoParaCancelar);
                  } catch {
                    toast.error("Erro ao cancelar recorrência.");
                  } finally {
                    setModalCancelarRecorrencia(false);
                    setAgendamentoParaCancelar(null);
                  }
                }}
                className="px-4 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
              >
                Esta e futuras
              </button>
            </div>
          </div>
        </div>
      )}

      {modalReembolso && agendamentosPagosParaCancelar.length > 0 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-slate-800">Paciente já efetuou o pagamento</h3>
            <p className="text-sm text-slate-500 mt-2">
              Deseja devolver o dinheiro das sessão(ões) paga(s) que serão canceladas?
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => finalizarCancelamentoComReembolso(true)}
                className="px-4 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
              >
                Devolver o dinheiro
              </button>
              <button
                type="button"
                onClick={() => finalizarCancelamentoComReembolso(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Não devolver
              </button>
            </div>
          </div>
        </div>
      )}

      {tarefaSelecionada && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setTarefaSelecionada(null)}
          />

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-slate-800">Detalhes da tarefa</h3>
            <p className="text-sm text-slate-500 mt-1">{tarefaSelecionada.titulo}</p>

            {tarefaSelecionada.descricao && (
              <p className="text-sm text-slate-600 mt-3 p-3 bg-slate-50 rounded-xl">{tarefaSelecionada.descricao}</p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Data</label>
                <input
                  type="date"
                  value={tarefaData}
                  onChange={(e) => setTarefaData(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hora</label>
                <input
                  type="time"
                  value={tarefaHora}
                  onChange={(e) => setTarefaHora(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={concluirOuReabrirTarefa}
                disabled={salvandoTarefa}
                className={cn(
                  "px-4 py-2 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60",
                  tarefaSelecionada.status === "pendente"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-yellow-500 hover:bg-yellow-600 text-white"
                )}
              >
                {tarefaSelecionada.status === "pendente" ? "Marcar como concluída" : "Reabrir tarefa"}
              </button>

              <button
                type="button"
                onClick={salvarNovaDataHoraTarefa}
                disabled={salvandoTarefa}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-60"
              >
                Salvar nova data/hora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
