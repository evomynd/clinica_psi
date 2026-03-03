"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Calendar, Clock, User, FileText, DollarSign, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { criarAgendamento, buscarPacientesPorPsicologo, Timestamp, atualizarAgendamento } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { generateUUID, formatBRL } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { PacienteFirestore, AgendamentoFirestore } from "@/types/firestore";
import { toast } from "sonner";

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  pacienteId:      z.string().min(1, "Selecione um paciente"),
  data:            z.string().min(1, "Informe a data"),
  hora:            z.string().min(1, "Informe o horário"),
  duracaoMinutos:  z.number().min(15).max(120),
  tipoAtendimento: z.enum(["sessao_semanal", "sessao_emergencial", "avaliacao", "introducao_15min"]),
  valor:           z.number().min(0),
  observacoes:     z.string().optional(),
  recorrenciaSemanal: z.boolean(),
  dataFimRecorrencia: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.recorrenciaSemanal) return;
  if (!data.dataFimRecorrencia) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dataFimRecorrencia"],
      message: "Informe a data de fim da recorrência",
    });
    return;
  }
  if (data.dataFimRecorrencia < data.data) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dataFimRecorrencia"],
      message: "A data de fim deve ser igual ou maior que a data da sessão",
    });
  }
});

type FormData = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────
interface NovoAgendamentoModalProps {
  open:            boolean;
  dataPreSelecionada?: Date;
  pacientePreSelecionadoId?: string;
  agendamentoEditavel?: AgendamentoFirestore | null;
  onClose:         () => void;
  onSuccess?:      (agendamentoId: string) => void;
}

const TIPOS_ATENDIMENTO = [
  { value: "sessao_semanal",      label: "Sessão Semanal" },
  { value: "sessao_emergencial",  label: "Sessão Emergencial" },
  { value: "avaliacao",           label: "Avaliação" },
  { value: "introducao_15min",    label: "Introdução (15min)" },
] as const;

const DURACOES = [15, 30, 45, 50, 60, 90, 120];

// ─── Componente ───────────────────────────────────────────────────────────────
export function NovoAgendamentoModal({ open, dataPreSelecionada, pacientePreSelecionadoId, agendamentoEditavel, onClose, onSuccess }: NovoAgendamentoModalProps) {
  const { user, userProfile } = useAuth();
  const [pacientes, setPacientes]   = useState<PacienteFirestore[]>([]);
  const [loading,  setLoading]      = useState(false);
  const [buscandoPacientes, setBuscandoPacientes] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      data:            dataPreSelecionada ? format(dataPreSelecionada, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      hora:            dataPreSelecionada ? format(dataPreSelecionada, "HH:mm") : "09:00",
      duracaoMinutos:  userProfile?.duracaoSessao ?? 50,
      tipoAtendimento: "sessao_semanal",
      valor:           userProfile?.valorSessao ?? 0,
      recorrenciaSemanal: false,
      dataFimRecorrencia: "",
    },
  });

  const recorrenciaSemanal = watch("recorrenciaSemanal");
  const pacienteId = watch("pacienteId");

  // Atualiza data/hora quando a pré-seleção mudar
  useEffect(() => {
    if (!open) return;

    if (agendamentoEditavel) {
      const d = agendamentoEditavel.dataHora.toDate();
      setValue("pacienteId", agendamentoEditavel.pacienteId);
      setValue("data", format(d, "yyyy-MM-dd"));
      setValue("hora", format(d, "HH:mm"));
      setValue("duracaoMinutos", agendamentoEditavel.duracaoMinutos);
      setValue("tipoAtendimento", agendamentoEditavel.tipoAtendimento);
      setValue("valor", agendamentoEditavel.pagamento?.valor ?? 0);
      setValue("observacoes", agendamentoEditavel.observacoes ?? "");
      setValue("recorrenciaSemanal", false);
      setValue("dataFimRecorrencia", "");
      return;
    }

    if (dataPreSelecionada) {
      setValue("data", format(dataPreSelecionada, "yyyy-MM-dd"));
      setValue("hora", format(dataPreSelecionada, "HH:mm"));
    }
  }, [open, agendamentoEditavel, dataPreSelecionada, setValue]);

  // Busca pacientes quando abre
  useEffect(() => {
    if (!open || !user) return;
    setBuscandoPacientes(true);
    buscarPacientesPorPsicologo(user.uid, { ativo: true })
      .then(setPacientes)
      .catch(console.error)
      .finally(() => setBuscandoPacientes(false));
  }, [open, user]);

  // Pré-seleciona paciente quando o modal abre via atalho do cadastro
  useEffect(() => {
    if (!open || agendamentoEditavel) return;
    if (pacientePreSelecionadoId) {
      setValue("pacienteId", pacientePreSelecionadoId);
    }
  }, [open, agendamentoEditavel, pacientePreSelecionadoId, setValue]);

  // Carrega valores padrão do paciente selecionado
  useEffect(() => {
    if (!pacienteId || agendamentoEditavel) return;
    const pacienteSelecionado = pacientes.find(p => p.id === pacienteId);
    if (pacienteSelecionado) {
      // Atualiza campos com os valores padrão se estiverem definidos
      if (pacienteSelecionado.duracaoSessaoPadrao) {
        setValue("duracaoMinutos", pacienteSelecionado.duracaoSessaoPadrao);
      }
      if (pacienteSelecionado.valorSessaoPadrao !== null && pacienteSelecionado.valorSessaoPadrao !== undefined) {
        setValue("valor", pacienteSelecionado.valorSessaoPadrao);
      }
    }
  }, [pacienteId, pacientes, agendamentoEditavel, setValue]);

  // ─── Submit ────────────────────────────────────────────────────────────────
  async function onSubmit(data: FormData) {
    if (!user || !userProfile) return;
    setLoading(true);
    try {
      const [ano, mes, dia] = data.data.split("-").map(Number);
      const [hora, minuto]  = data.hora.split(":").map(Number);
      const dataHora = new Date(ano, mes - 1, dia, hora, minuto);

      if (agendamentoEditavel?.id) {
        await atualizarAgendamento(agendamentoEditavel.id, {
          pacienteId: data.pacienteId,
          dataHora: Timestamp.fromDate(dataHora),
          duracaoMinutos: data.duracaoMinutos,
          tipoAtendimento: data.tipoAtendimento,
          observacoes: data.observacoes ?? null,
          pagamento: {
            ...agendamentoEditavel.pagamento,
            valor: data.valor,
          },
        });
        toast.success("Agendamento atualizado com sucesso!");
        onSuccess?.(agendamentoEditavel.id);
        onClose();
        return;
      }

      const recorrenciaId = data.recorrenciaSemanal ? generateUUID() : null;
      const dataFimRecorrencia = data.dataFimRecorrencia
        ? new Date(`${data.dataFimRecorrencia}T23:59:59`)
        : null;

      const baseAgendamento: Omit<AgendamentoFirestore, "id" | "createdAt" | "updatedAt"> = {
        userId:              user.uid,
        pacienteId:          data.pacienteId,
        clinicaId:           userProfile.clinicaId,
        dataHora:            Timestamp.fromDate(dataHora),
        duracaoMinutos:      data.duracaoMinutos,
        status:              "agendado",
        tipoAtendimento:     data.tipoAtendimento,
        linkSala:            generateUUID(),
        notificacaoEnviada:  false,
        observacoes:         data.observacoes ?? null,
        recorrenciaId,
        recorrenciaAte:      dataFimRecorrencia ? Timestamp.fromDate(dataFimRecorrencia) : null,
        pagamento: {
          status:            "pendente",
          valor:             data.valor,
          dataPagamento:     null,
          metodoPagamento:   null,
          reciboCriado:      false,
        },
      };

      if (data.recorrenciaSemanal && dataFimRecorrencia) {
        let cursor = new Date(dataHora);
        let quantidade = 0;
        let primeiroId = "";

        while (cursor.getTime() <= dataFimRecorrencia.getTime() && quantidade < 104) {
          const id = await criarAgendamento({
            ...baseAgendamento,
            dataHora: Timestamp.fromDate(cursor),
          });
          if (!primeiroId) primeiroId = id;
          quantidade += 1;
          cursor = new Date(cursor);
          cursor.setDate(cursor.getDate() + 7);
        }

        toast.success(`Recorrência criada com ${quantidade} sessão(ões)!`);
        onSuccess?.(primeiroId);
      } else {
        const id = await criarAgendamento(baseAgendamento);
        toast.success("Agendamento criado com sucesso!");
        onSuccess?.(id);
      }

      reset();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar agendamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const pacienteSelecionado = pacientes.find((p) => p.id === watch("pacienteId"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-slate-800 text-lg">{agendamentoEditavel ? "Editar Agendamento" : "Novo Agendamento"}</h2>
              <p className="text-xs text-slate-500">{agendamentoEditavel ? "Atualize os dados da sessão" : "Preencha os dados da sessão"}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {/* Paciente */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <User className="w-4 h-4 text-slate-400" /> Paciente
            </label>
            {buscandoPacientes ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando pacientes...
              </div>
            ) : (
              <select
                {...register("pacienteId")}
                className={cn(
                  "w-full px-3 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400",
                  errors.pacienteId ? "border-red-300 bg-red-50" : "border-slate-200 hover:border-primary-300"
                )}
              >
                <option value="">Selecionar paciente...</option>
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>{p.nomeCompleto}</option>
                ))}
              </select>
            )}
            {errors.pacienteId && <p className="text-xs text-red-500">{errors.pacienteId.message}</p>}
            {pacienteSelecionado && (
              <p className="text-xs text-slate-500 pl-1">{pacienteSelecionado.email} · {pacienteSelecionado.telefone}</p>
            )}
          </div>

          {/* Recorrência semanal */}
          {!agendamentoEditavel && (
            <div className="space-y-3 rounded-xl border border-slate-200 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  {...register("recorrenciaSemanal")}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                Repetir semanalmente no mesmo horário
              </label>

              {recorrenciaSemanal && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Data de fim da recorrência</label>
                  <input
                    type="date"
                    {...register("dataFimRecorrencia")}
                    min={watch("data")}
                    className={cn(
                      "w-full px-3 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400",
                      errors.dataFimRecorrencia ? "border-red-300 bg-red-50" : "border-slate-200 hover:border-primary-300"
                    )}
                  />
                  {errors.dataFimRecorrencia && <p className="text-xs text-red-500">{errors.dataFimRecorrencia.message}</p>}
                </div>
              )}
            </div>
          )}

          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Calendar className="w-4 h-4 text-slate-400" /> Data
              </label>
              <input
                type="date"
                {...register("data")}
                className={cn(
                  "w-full px-3 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400",
                  errors.data ? "border-red-300 bg-red-50" : "border-slate-200 hover:border-primary-300"
                )}
              />
              {errors.data && <p className="text-xs text-red-500">{errors.data.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Clock className="w-4 h-4 text-slate-400" /> Horário
              </label>
              <input
                type="time"
                {...register("hora")}
                step="900"
                className={cn(
                  "w-full px-3 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400",
                  errors.hora ? "border-red-300 bg-red-50" : "border-slate-200 hover:border-primary-300"
                )}
              />
              {errors.hora && <p className="text-xs text-red-500">{errors.hora.message}</p>}
            </div>
          </div>

          {/* Tipo e Duração */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Tipo</label>
              <select
                {...register("tipoAtendimento")}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm hover:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                {TIPOS_ATENDIMENTO.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Duração</label>
              <select
                {...register("duracaoMinutos", { valueAsNumber: true })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm hover:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                {DURACOES.map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </div>
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <DollarSign className="w-4 h-4 text-slate-400" /> Valor (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              {...register("valor", { valueAsNumber: true })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm hover:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="0,00"
            />
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <FileText className="w-4 h-4 text-slate-400" /> Observações (opcional)
            </label>
            <textarea
              {...register("observacoes")}
              rows={3}
              placeholder="Notas internas, particularidades da sessão..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm hover:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : agendamentoEditavel ? "Salvar Alterações" : "Agendar Sessão"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
