"use client";

import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Filter,
  X,
  Loader2,
  CheckSquare,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { 
  buscarAgendamentosParaFinanceiro, 
  calcularResumoFinanceiro,
  atualizarPagamento,
  buscarPacientePorId,
  type ResumoFinanceiro 
} from "@/lib/firebase/firestore";
import type { AgendamentoFirestore, Pagamento } from "@/types/firestore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TIPO_LABELS: Record<string, string> = {
  sessao_semanal: "Sessão Semanal",
  sessao_emergencial: "Sessão Emergencial",
  avaliacao: "Avaliação",
  introducao_15min: "Introdução 15min",
};

const METODO_LABELS: Record<string, string> = {
  pix: "PIX",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  nao_informado: "Não Informado",
};

type SortField = "data" | "paciente" | "pagamento" | "status";
type SortDirection = "asc" | "desc";

export default function FinanceiroPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [agendamentos, setAgendamentos] = useState<AgendamentoFirestore[]>([]);
  const [pacientesNomes, setPacientesNomes] = useState<Record<string, string>>({});
  
  // Filtros
  const [mesAtual, setMesAtual] = useState(new Date());
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "pago" | "pendente" | "reembolsado">("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroPaciente, setFiltroPaciente] = useState<string>("todos");
  const [ordenacao, setOrdenacao] = useState<{ campo: SortField; direcao: SortDirection }>({
    campo: "data",
    direcao: "desc",
  });
  const [selecionados, setSelecionados] = useState<string[]>([]);
  
  // Modal de pagamento
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<AgendamentoFirestore | null>(null);
  const [modalPagamento, setModalPagamento] = useState(false);
  const [modalMassa, setModalMassa] = useState(false);

  useEffect(() => {
    if (user?.uid) carregarDados();
  }, [user, mesAtual]);

  const carregarDados = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const inicio = startOfMonth(mesAtual);
      const fim = endOfMonth(mesAtual);
      
      const [agends, resumoCalc] = await Promise.all([
        buscarAgendamentosParaFinanceiro(user.uid, inicio, fim),
        calcularResumoFinanceiro(user.uid, inicio, fim),
      ]);

      setAgendamentos(agends);
      setResumo(resumoCalc);

      // Buscar nomes dos pacientes
      const pacIds = [...new Set(agends.map((a) => a.pacienteId))];
      const nomes: Record<string, string> = {};
      await Promise.all(
        pacIds.map(async (id) => {
          const pac = await buscarPacientePorId(id);
          if (pac) nomes[id] = pac.nomeCompleto || "Paciente sem nome";
        })
      );
      setPacientesNomes(nomes);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  };

  const agendamentosFiltrados = agendamentos.filter((ag) => {
    if (filtroStatus === "pago" && ag.pagamento?.status !== "pago") return false;
    if (filtroStatus === "pendente" && ag.pagamento?.status !== "pendente") return false;
    if (filtroStatus === "reembolsado" && ag.pagamento?.status !== "reembolsado") return false;
    if (filtroTipo !== "todos" && ag.tipoAtendimento !== filtroTipo) return false;
    if (filtroPaciente !== "todos" && ag.pacienteId !== filtroPaciente) return false;
    return true;
  });

  const agendamentosOrdenados = [...agendamentosFiltrados].sort((a, b) => {
    const dir = ordenacao.direcao === "asc" ? 1 : -1;

    if (ordenacao.campo === "data") {
      const av = a.dataHora?.toMillis?.() ?? 0;
      const bv = b.dataHora?.toMillis?.() ?? 0;
      return (av - bv) * dir;
    }

    if (ordenacao.campo === "paciente") {
      const av = (pacientesNomes[a.pacienteId] ?? "").toLocaleLowerCase("pt-BR");
      const bv = (pacientesNomes[b.pacienteId] ?? "").toLocaleLowerCase("pt-BR");
      return av.localeCompare(bv, "pt-BR") * dir;
    }

    if (ordenacao.campo === "pagamento") {
      const av = METODO_LABELS[a.pagamento?.metodoPagamento ?? "nao_informado"] ?? "Não Informado";
      const bv = METODO_LABELS[b.pagamento?.metodoPagamento ?? "nao_informado"] ?? "Não Informado";
      return av.localeCompare(bv, "pt-BR") * dir;
    }

    const ordemStatus: Record<string, number> = { pendente: 1, pago: 2, reembolsado: 3, cancelado: 4 };
    const av = ordemStatus[a.pagamento?.status ?? "pendente"] ?? 99;
    const bv = ordemStatus[b.pagamento?.status ?? "pendente"] ?? 99;
    return (av - bv) * dir;
  });

  const alternarOrdenacao = (campo: SortField) => {
    setOrdenacao((prev) => {
      if (prev.campo !== campo) {
        return { campo, direcao: campo === "data" ? "desc" : "asc" };
      }
      return { campo, direcao: prev.direcao === "asc" ? "desc" : "asc" };
    });
  };

  const idsFiltrados = agendamentosOrdenados
    .map((a) => a.id)
    .filter((id): id is string => Boolean(id));

  const todosSelecionados = idsFiltrados.length > 0 && idsFiltrados.every((id) => selecionados.includes(id));

  const toggleSelecionado = (id: string) => {
    setSelecionados((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleSelecionarTodos = () => {
    if (todosSelecionados) {
      setSelecionados((prev) => prev.filter((id) => !idsFiltrados.includes(id)));
      return;
    }
    setSelecionados((prev) => [...new Set([...prev, ...idsFiltrados])]);
  };

  const handleAbrirModalPagamento = (ag: AgendamentoFirestore) => {
    setAgendamentoSelecionado(ag);
    setModalPagamento(true);
  };

  const handleSalvarPagamento = async (novoPagamento: Partial<Pagamento>) => {
    if (!agendamentoSelecionado?.id) return;
    try {
      await atualizarPagamento(agendamentoSelecionado.id, novoPagamento);
      toast.success("Pagamento atualizado!");
      setModalPagamento(false);
      setAgendamentoSelecionado(null);
      carregarDados();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar pagamento");
    }
  };

  const handleMarcarEmMassaComoPago = async (metodo: Pagamento["metodoPagamento"]) => {
    const alvos = agendamentos.filter((a) => a.id && selecionados.includes(a.id));
    if (!alvos.length) return;

    try {
      await Promise.all(
        alvos.map((a) =>
          atualizarPagamento(a.id!, {
            ...a.pagamento,
            status: "pago",
            metodoPagamento: metodo,
            dataPagamento: new Date() as never,
          })
        )
      );
      toast.success(`${alvos.length} sessão(ões) marcadas como pagas.`);
      setSelecionados([]);
      setModalMassa(false);
      await carregarDados();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar pagamentos em massa");
    }
  };

  const mudarMes = (delta: number) => {
    setMesAtual((prev) => subMonths(prev, -delta));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-800">Financeiro</h1>
          <p className="text-slate-500 text-sm mt-1">Controle de fluxo de caixa e recibos</p>
        </div>
        
        {/* Seletor de Mês */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => mudarMes(-1)}
            className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            ←
          </button>
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg font-medium text-slate-700">
            {format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}
          </div>
          <button
            onClick={() => mudarMes(1)}
            className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            →
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <CardResumo
          icon={DollarSign}
          label="Total Faturado"
          valor={`R$ ${resumo?.totalFaturado.toFixed(2) ?? "0,00"}`}
          cor="green"
        />
        <CardResumo
          icon={Clock}
          label="Pagamentos Pendentes"
          valor={`R$ ${resumo?.totalPendente.toFixed(2) ?? "0,00"}`}
          cor="amber"
        />
        <CardResumo
          icon={CheckCircle2}
          label="Sessões Realizadas"
          valor={`${resumo?.sessoesRealizadas ?? 0}`}
          cor="blue"
        />
        <CardResumo
          icon={TrendingUp}
          label="Sessões Pendentes"
          valor={`${resumo?.sessoesPendentes ?? 0}`}
          cor="slate"
        />
      </div>

      {/* Gráfico por Tipo */}
      {resumo && Object.keys(resumo.porTipo).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Receita por Tipo de Atendimento</h2>
          <div className="space-y-3">
            {Object.entries(resumo.porTipo).map(([tipo, dados]) => {
              const porcentagem = resumo.totalFaturado > 0 
                ? (dados.valor / resumo.totalFaturado) * 100 
                : 0;
              return (
                <div key={tipo}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{TIPO_LABELS[tipo] ?? tipo}</span>
                    <span className="text-slate-500">R$ {dados.valor.toFixed(2)} ({dados.quantidade}x)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500"
                      style={{ width: `${porcentagem}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtros e Tabela */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card">
        <div className="p-6 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Filtros:</span>
            </div>
            
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as any)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="todos">Todos os status</option>
              <option value="pago">Pagos</option>
              <option value="pendente">Pendentes</option>
              <option value="reembolsado">Reembolsados</option>
            </select>

            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="todos">Todos os tipos</option>
              {Object.entries(TIPO_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <select
              value={filtroPaciente}
              onChange={(e) => setFiltroPaciente(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="todos">Todos os pacientes</option>
              {Object.entries(pacientesNomes)
                .sort((a, b) => String(a[1] ?? "").localeCompare(String(b[1] ?? ""), "pt-BR"))
                .map(([id, nome]) => (
                  <option key={id} value={id}>{nome}</option>
                ))}
            </select>

            {selecionados.length > 0 && (
              <button
                onClick={() => setModalMassa(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700"
              >
                <CheckSquare className="w-4 h-4" />
                Marcar {selecionados.length} como pago
              </button>
            )}

            <div className="ml-auto">
              <span className="text-sm text-slate-500">
                {agendamentosOrdenados.length} registro(s)
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  <input
                    type="checkbox"
                    checked={todosSelecionados}
                    onChange={toggleSelecionarTodos}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600"
                    aria-label="Selecionar todos"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  <SortableHeader label="Data" campo="data" ordenacao={ordenacao} onSort={alternarOrdenacao} />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  <SortableHeader label="Paciente" campo="paciente" ordenacao={ordenacao} onSort={alternarOrdenacao} />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  <SortableHeader label="Pagamento" campo="pagamento" ordenacao={ordenacao} onSort={alternarOrdenacao} />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  <SortableHeader label="Status" campo="status" ordenacao={ordenacao} onSort={alternarOrdenacao} />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agendamentosOrdenados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    Nenhum agendamento encontrado para este período
                  </td>
                </tr>
              ) : (
                agendamentosOrdenados.map((ag) => (
                  <LinhaAgendamento
                    key={ag.id}
                    agendamento={ag}
                    nomePaciente={pacientesNomes[ag.pacienteId] ?? "Carregando..."}
                    selecionado={Boolean(ag.id && selecionados.includes(ag.id))}
                    onToggleSelecionado={() => ag.id && toggleSelecionado(ag.id)}
                    onEditarPagamento={() => handleAbrirModalPagamento(ag)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Pagamento */}
      {modalPagamento && agendamentoSelecionado && (
        <ModalPagamento
          agendamento={agendamentoSelecionado}
          nomePaciente={pacientesNomes[agendamentoSelecionado.pacienteId] ?? ""}
          onClose={() => {
            setModalPagamento(false);
            setAgendamentoSelecionado(null);
          }}
          onSalvar={handleSalvarPagamento}
        />
      )}

      {modalMassa && (
        <ModalPagamentoMassa
          quantidade={selecionados.length}
          onClose={() => setModalMassa(false)}
          onConfirm={handleMarcarEmMassaComoPago}
        />
      )}
    </div>
  );
}

// ─── Componentes Auxiliares ───────────────────────────────────────────────────

function CardResumo({ 
  icon: Icon, 
  label, 
  valor, 
  cor 
}: { 
  icon: React.ElementType; 
  label: string; 
  valor: string; 
  cor: "green" | "amber" | "blue" | "slate";
}) {
  const corClasses = {
    green: "bg-green-100 text-green-600",
    amber: "bg-amber-100 text-amber-600",
    blue: "bg-blue-100 text-blue-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
      <div className="flex items-center gap-3">
        <div className={cn("p-3 rounded-lg", corClasses[cor])}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-800">{valor}</p>
        </div>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  campo,
  ordenacao,
  onSort,
}: {
  label: string;
  campo: SortField;
  ordenacao: { campo: SortField; direcao: SortDirection };
  onSort: (campo: SortField) => void;
}) {
  const ativo = ordenacao.campo === campo;

  return (
    <button
      type="button"
      onClick={() => onSort(campo)}
      className="inline-flex items-center gap-1 hover:text-slate-700"
      title={`Ordenar por ${label}`}
    >
      <span>{label}</span>
      {!ativo && <ArrowUpDown className="w-3.5 h-3.5" />}
      {ativo && ordenacao.direcao === "asc" && <ArrowUp className="w-3.5 h-3.5" />}
      {ativo && ordenacao.direcao === "desc" && <ArrowDown className="w-3.5 h-3.5" />}
    </button>
  );
}

function LinhaAgendamento({ 
  agendamento, 
  nomePaciente, 
  selecionado,
  onToggleSelecionado,
  onEditarPagamento 
}: { 
  agendamento: AgendamentoFirestore; 
  nomePaciente: string; 
  selecionado: boolean;
  onToggleSelecionado: () => void;
  onEditarPagamento: () => void;
}) {
  const statusPagamento = agendamento.pagamento?.status ?? "pendente";
  const valor = agendamento.pagamento?.valor ?? 0;
  const metodo = agendamento.pagamento?.metodoPagamento;

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-4">
        <input
          type="checkbox"
          checked={selecionado}
          onChange={onToggleSelecionado}
          className="w-4 h-4 rounded border-slate-300 text-primary-600"
          aria-label="Selecionar sessão"
        />
      </td>
      <td className="px-6 py-4 text-sm text-slate-700">
        {format(agendamento.dataHora.toDate(), "dd/MM/yyyy HH:mm")}
      </td>
      <td className="px-6 py-4 text-sm font-medium text-slate-800">{nomePaciente}</td>
      <td className="px-6 py-4 text-sm text-slate-600">
        {TIPO_LABELS[agendamento.tipoAtendimento] ?? agendamento.tipoAtendimento}
      </td>
      <td className="px-6 py-4 text-sm font-semibold text-slate-800">
        R$ {valor.toFixed(2)}
      </td>
      <td className="px-6 py-4 text-sm text-slate-600">
        {metodo ? METODO_LABELS[metodo] : "—"}
      </td>
      <td className="px-6 py-4">
        <span
          className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
            statusPagamento === "pago"
              ? "bg-green-100 text-green-700"
              : statusPagamento === "pendente"
              ? "bg-amber-100 text-amber-700"
              : statusPagamento === "reembolsado"
              ? "bg-red-100 text-red-700"
              : "bg-slate-100 text-slate-700"
          )}
        >
          {statusPagamento === "pago" ? "Pago" : statusPagamento === "pendente" ? "Pendente" : statusPagamento === "reembolsado" ? "Reembolsado" : "Cancelado"}
        </span>
      </td>
      <td className="px-6 py-4">
        <button
          onClick={onEditarPagamento}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          Editar
        </button>
      </td>
    </tr>
  );
}

function ModalPagamentoMassa({
  quantidade,
  onClose,
  onConfirm,
}: {
  quantidade: number;
  onClose: () => void;
  onConfirm: (metodo: Pagamento["metodoPagamento"]) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [metodo, setMetodo] = useState<Pagamento["metodoPagamento"]>("pix");

  async function handleConfirmar() {
    setLoading(true);
    try {
      await onConfirm(metodo);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Pagamento em Massa</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Você selecionou <span className="font-semibold">{quantidade}</span> sessão(ões). Escolha a forma de pagamento para marcar todas como pagas.
        </p>

        <div className="space-y-1.5 mb-6">
          <label className="block text-sm font-medium text-slate-700">Forma de pagamento</label>
          <select
            value={metodo ?? "pix"}
            onChange={(e) => setMetodo(e.target.value as Pagamento["metodoPagamento"])}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="pix">PIX</option>
            <option value="cartao">Cartão</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="transferencia">Transferência</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalPagamento({ 
  agendamento, 
  nomePaciente, 
  onClose, 
  onSalvar 
}: { 
  agendamento: AgendamentoFirestore; 
  nomePaciente: string; 
  onClose: () => void; 
  onSalvar: (pagamento: Partial<Pagamento>) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(agendamento.pagamento?.status ?? "pendente");
  const [valor, setValor] = useState(agendamento.pagamento?.valor ?? 0);
  const [metodo, setMetodo] = useState(agendamento.pagamento?.metodoPagamento ?? "pix");
  const [observacoes, setObservacoes] = useState(agendamento.pagamento?.observacoes ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSalvar({
        status,
        valor,
        metodoPagamento: metodo as any,
        observacoes,
        dataPagamento: status === "pago" ? new Date() as any : null,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Editar Pagamento</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-600">
            <span className="font-medium">Paciente:</span> {nomePaciente}
          </p>
          <p className="text-sm text-slate-600 mt-1">
            <span className="font-medium">Data:</span> {format(agendamento.dataHora.toDate(), "dd/MM/yyyy HH:mm")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Método de Pagamento</label>
            <select
              value={metodo ?? "pix"}
              onChange={(e) => setMetodo(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="pix">PIX</option>
              <option value="cartao">Cartão</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="transferencia">Transferência</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Observações sobre o pagamento (opcional)"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
