import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  QueryConstraint,
  DocumentData,
  WithFieldValue,
  writeBatch,
} from "firebase/firestore";
import { db } from "./config";
import { COLLECTIONS } from "./collections";
import type {
  UserFirestore,
  PacienteFirestore,
  ObservacaoPacienteFirestore,
  AgendamentoFirestore,
  DisponibilidadeFirestore,
  AuditoriaAcessoFirestore,
  TarefaFirestore,
} from "@/types/firestore";

// ─── Auditoria LGPD ──────────────────────────────────────────────────────────
export async function registrarAuditoria(
  data: Omit<AuditoriaAcessoFirestore, "id" | "timestamp">
): Promise<void> {
  try {
    await addDoc(collection(db, COLLECTIONS.AUDITORIA_ACESSOS), {
      ...data,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    // Auditoria nunca deve falhar silenciosamente — logamos mas não propagamos
    console.error("[Auditoria] Erro ao registrar:", err);
  }
}

// ─── Usuário (Perfil) ────────────────────────────────────────────────────────
export async function buscarUsuario(uid: string): Promise<UserFirestore | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as UserFirestore;
}

export async function atualizarPerfil(
  uid: string,
  data: Partial<Pick<
    UserFirestore,
    | "displayName"
    | "crp"
    | "crpUF"
    | "crpAtivo"
    | "miniCV"
    | "abordagem"
    | "especialidades"
    | "valorSessao"
    | "duracaoSessao"
    | "fusoHorario"
    | "notificacaoWhatsapp"
    | "notificacaoEmail"
    | "telefone"
  >>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function exportarDadosLGPD(uid: string): Promise<Record<string, unknown>> {
  // Coleta todos os dados do usuário para exportação LGPD
  const [usuario, pacientes, agendamentos, observacoes, auditorias] = await Promise.all([
    buscarUsuario(uid),
    getDocs(query(collection(db, COLLECTIONS.PACIENTES), where("userId", "==", uid))),
    getDocs(query(collection(db, COLLECTIONS.AGENDAMENTOS), where("userId", "==", uid))),
    getDocs(query(collection(db, COLLECTIONS.OBSERVACOES), where("userId", "==", uid))),
    getDocs(query(collection(db, COLLECTIONS.AUDITORIA_ACESSOS), where("userId", "==", uid))),
  ]);

  return {
    usuario: usuario ?? {},
    pacientes: pacientes.docs.map((d) => ({ id: d.id, ...d.data() })),
    agendamentos: agendamentos.docs.map((d) => ({ id: d.id, ...d.data() })),
    observacoes: observacoes.docs.map((d) => ({ id: d.id, ...d.data() })),
    auditorias: auditorias.docs.map((d) => ({ id: d.id, ...d.data() })),
    exportadoEm: new Date().toISOString(),
  };
}

// ─── Pacientes ───────────────────────────────────────────────────────────────
export async function criarPaciente(
  data: Omit<PacienteFirestore, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.PACIENTES), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function buscarPacientesPorPsicologo(
  userId: string,
  filters: { ativo?: boolean } = {}
): Promise<PacienteFirestore[]> {
  // orderBy removido para evitar índice composto — ordenação feita no cliente
  const constraints: QueryConstraint[] = [
    where("userId", "==", userId),
  ];
  if (filters.ativo !== undefined) {
    constraints.push(where("ativo", "==", filters.ativo));
  }
  const q = query(collection(db, COLLECTIONS.PACIENTES), ...constraints);
  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PacienteFirestore));
  return docs.sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, "pt-BR"));
}

export async function buscarPacientePorId(id: string): Promise<PacienteFirestore | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.PACIENTES, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as PacienteFirestore;
}

export async function atualizarPaciente(
  id: string,
  data: Partial<Omit<PacienteFirestore, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.PACIENTES, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function togglePacienteAtivo(id: string, ativo: boolean): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.PACIENTES, id), {
    ativo,
    updatedAt: serverTimestamp(),
  });
}

// ─── Agendamentos ─────────────────────────────────────────────────────────────
// Nota: Queries usam only where(userId) para evitar índice composto.
// Filtragem por dataHora e ordenação são feitas no cliente.
export async function buscarAgendamentosHoje(
  userId: string
): Promise<AgendamentoFirestore[]> {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);

  const snap = await getDocs(
    query(collection(db, COLLECTIONS.AGENDAMENTOS), where("userId", "==", userId))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as AgendamentoFirestore))
    .filter((a) => {
      const ms = a.dataHora?.toMillis?.() ?? 0;
      return ms >= inicio.getTime() && ms <= fim.getTime();
    })
    .sort((a, b) => (a.dataHora?.toMillis?.() ?? 0) - (b.dataHora?.toMillis?.() ?? 0));
}

export async function buscarAgendamentosPeriodo(
  userId: string,
  inicio: Date,
  fim: Date
): Promise<AgendamentoFirestore[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.AGENDAMENTOS), where("userId", "==", userId))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as AgendamentoFirestore))
    .filter((a) => {
      const ms = a.dataHora?.toMillis?.() ?? 0;
      return ms >= inicio.getTime() && ms <= fim.getTime();
    })
    .sort((a, b) => (a.dataHora?.toMillis?.() ?? 0) - (b.dataHora?.toMillis?.() ?? 0));
}

// ─── Observações ──────────────────────────────────────────────────────────
export async function buscarObservacoesDoPaciente(
  pacienteId: string,
  userId: string
): Promise<ObservacaoPacienteFirestore[]> {
  // Filtra só por pacienteId para evitar índice composto — ordenação no cliente
  const q = query(
    collection(db, COLLECTIONS.OBSERVACOES),
    where("pacienteId", "==", pacienteId),
  );
  const snap = await getDocs(q);
  const docs = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as ObservacaoPacienteFirestore))
    .filter((d) => d.userId === userId);
  return docs.sort((a, b) => {
    const ta = a.dataObservacao?.toMillis?.() ?? 0;
    const tb = b.dataObservacao?.toMillis?.() ?? 0;
    return tb - ta;
  });
}

export async function criarObservacao(
  data: Omit<ObservacaoPacienteFirestore, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.OBSERVACOES), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function atualizarObservacao(
  id: string,
  data: Partial<Pick<ObservacaoPacienteFirestore, "conteudoCriptografado" | "conteudoIV" | "isEncrypted">>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.OBSERVACOES, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deletarObservacao(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.OBSERVACOES, id));
}

// ─── Disponibilidades ─────────────────────────────────────────────────────────
export async function buscarDisponibilidades(
  userId: string
): Promise<DisponibilidadeFirestore[]> {
  // Filtra ativo e ordena por diaSemana no cliente para evitar índice composto
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.DISPONIBILIDADES), where("userId", "==", userId))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as DisponibilidadeFirestore))
    .filter((d) => d.ativo)
    .sort((a, b) => (a.diaSemana ?? 0) - (b.diaSemana ?? 0));
}

// ─── Auditoria LGPD ──────────────────────────────────────────────────────────
export async function buscarLogsAuditoria(
  clinicaId: string,
  limitCount = 100
): Promise<AuditoriaAcessoFirestore[]> {
  // orderBy removido para evitar índice composto — ordenação no cliente
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.AUDITORIA_ACESSOS), where("clinicaId", "==", clinicaId))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as AuditoriaAcessoFirestore))
    .sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0))
    .slice(0, limitCount);
}

// ─── Helpers genéricos ────────────────────────────────────────────────────────
export function subscribeToCollection<T extends DocumentData>(
  collectionPath: string,
  constraints: QueryConstraint[],
  callback: (data: T[]) => void
): () => void {
  const q = query(collection(db, collectionPath), ...constraints);
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T));
    callback(data);
  });
}

// ─── Agendamentos — CRUD completo ─────────────────────────────────────────────
export async function criarAgendamento(
  data: Omit<AgendamentoFirestore, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.AGENDAMENTOS), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function atualizarAgendamento(
  id: string,
  data: Partial<Omit<AgendamentoFirestore, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.AGENDAMENTOS, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function cancelarAgendamento(id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.AGENDAMENTOS, id), {
    status: "cancelado",
    updatedAt: serverTimestamp(),
  });
}

export async function cancelarAgendamentosFuturosDaRecorrencia(
  userId: string,
  recorrenciaId: string,
  dataBase: Date,
  incluirAtual = true,
  preservarPagos = false
): Promise<number> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.AGENDAMENTOS), where("userId", "==", userId))
  );

  const baseMs = dataBase.getTime();
  const alvos = snap.docs.filter((d) => {
    const data = d.data() as AgendamentoFirestore;
    if ((data.recorrenciaId ?? null) !== recorrenciaId) return false;
    const ms = data.dataHora?.toMillis?.() ?? 0;
    const inRange = incluirAtual ? ms >= baseMs : ms > baseMs;
    if (!inRange) return false;
    if (!preservarPagos) return true;
    return data.pagamento?.status !== "pago";
  });

  if (!alvos.length) return 0;

  const batch = writeBatch(db);
  alvos.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return alvos.length;
}

export async function buscarAgendamentosDaRecorrenciaAPartirDe(
  userId: string,
  recorrenciaId: string,
  dataBase: Date,
  incluirAtual = true
): Promise<AgendamentoFirestore[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.AGENDAMENTOS), where("userId", "==", userId))
  );

  const baseMs = dataBase.getTime();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as AgendamentoFirestore))
    .filter((a) => {
      if ((a.recorrenciaId ?? null) !== recorrenciaId) return false;
      const ms = a.dataHora?.toMillis?.() ?? 0;
      return incluirAtual ? ms >= baseMs : ms > baseMs;
    })
    .sort((a, b) => (a.dataHora?.toMillis?.() ?? 0) - (b.dataHora?.toMillis?.() ?? 0));
}

export function subscribeAgendamentosPeriodo(
  userId: string,
  inicio: Date,
  fim: Date,
  callback: (agendamentos: AgendamentoFirestore[]) => void
): () => void {
  // Usa só where(userId) para evitar índice composto — filtra período no cliente
  const q = query(
    collection(db, COLLECTIONS.AGENDAMENTOS),
    where("userId", "==", userId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as unknown as AgendamentoFirestore))
        .filter((a) => {
          const ms = a.dataHora?.toMillis?.() ?? 0;
          return ms >= inicio.getTime() && ms <= fim.getTime();
        })
        .sort((a, b) => (a.dataHora?.toMillis?.() ?? 0) - (b.dataHora?.toMillis?.() ?? 0));
      callback(data);
    },
    (error) => {
      console.error("[Firestore] subscribeAgendamentosPeriodo error:", error);
    }
  );
}

export function subscribeAgendamentosHoje(
  userId: string,
  callback: (agendamentos: AgendamentoFirestore[]) => void
): () => void {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  return subscribeAgendamentosPeriodo(userId, inicio, fim, callback);
}

// ─── Disponibilidades — CRUD completo ────────────────────────────────────────
export async function salvarDisponibilidades(
  userId: string,
  clinicaId: string,
  slots: Array<{ diaSemana: DisponibilidadeFirestore["diaSemana"]; horaInicio: string; horaFim: string; intervaloCom: number }>
): Promise<void> {
  const batch = writeBatch(db);

  // Remove disponibilidades antigas do usuário
  const existentes = await getDocs(
    query(collection(db, COLLECTIONS.DISPONIBILIDADES), where("userId", "==", userId))
  );
  existentes.docs.forEach((d) => batch.delete(d.ref));

  // Insere as novas
  slots.forEach((slot) => {
    const ref = doc(collection(db, COLLECTIONS.DISPONIBILIDADES));
    batch.set(ref, {
      ...slot,
      userId,
      clinicaId,
      ativo: true,
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

export function subscribeDisponibilidades(
  userId: string,
  callback: (slots: DisponibilidadeFirestore[]) => void
): () => void {
  const q = query(
    collection(db, COLLECTIONS.DISPONIBILIDADES),
    where("userId", "==", userId),
    where("ativo", "==", true)
  );
  return onSnapshot(q, (snap) => {
    const data = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as unknown as DisponibilidadeFirestore))
      .sort((a, b) => (a.diaSemana ?? 0) - (b.diaSemana ?? 0));
    callback(data);
  });
}

// ─── Tarefas ───────────────────────────────────────────────────────────
export async function criarTarefa(
  data: Omit<TarefaFirestore, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.TAREFAS), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function atualizarTarefa(
  id: string,
  data: Partial<Omit<TarefaFirestore, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.TAREFAS, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function buscarTarefasPorUsuario(userId: string): Promise<TarefaFirestore[]> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.TAREFAS), where("userId", "==", userId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as TarefaFirestore))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

export function subscribeTarefasPeriodo(
  userId: string,
  inicio: Date,
  fim: Date,
  callback: (tarefas: TarefaFirestore[]) => void
): () => void {
  const q = query(collection(db, COLLECTIONS.TAREFAS), where("userId", "==", userId));
  return onSnapshot(q, (snap) => {
    const data = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as TarefaFirestore))
      .filter((t) => {
        const ms = t.dataHora?.toMillis?.() ?? 0;
        if (!ms) return false;
        return ms >= inicio.getTime() && ms <= fim.getTime();
      })
      .sort((a, b) => (a.dataHora?.toMillis?.() ?? 0) - (b.dataHora?.toMillis?.() ?? 0));
    callback(data);
  });
}

export function subscribeTarefasPendentes(
  userId: string,
  callback: (count: number) => void
): () => void {
  const q = query(collection(db, COLLECTIONS.TAREFAS), where("userId", "==", userId));
  return onSnapshot(q, (snap) => {
    const pendentes = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as TarefaFirestore))
      .filter((t) => t.status === "pendente")
      .length;
    callback(pendentes);
  });
}

// ─── Financeiro ────────────────────────────────────────────────────────
export async function buscarAgendamentosParaFinanceiro(
  userId: string,
  inicio: Date,
  fim: Date
): Promise<AgendamentoFirestore[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.AGENDAMENTOS), where("userId", "==", userId))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as AgendamentoFirestore))
    .filter((a) => {
      const ms = a.dataHora?.toMillis?.() ?? 0;
      const pagamentoStatus = a.pagamento?.status ?? "pendente";
      const manterCanceladaComFinanceiro =
        a.status === "cancelado" && (pagamentoStatus === "pago" || pagamentoStatus === "reembolsado");

      return (
        ms >= inicio.getTime() &&
        ms <= fim.getTime() &&
        (a.status !== "cancelado" || manterCanceladaComFinanceiro)
      );
    })
    .sort((a, b) => (b.dataHora?.toMillis?.() ?? 0) - (a.dataHora?.toMillis?.() ?? 0));
}

export async function atualizarPagamento(
  agendamentoId: string,
  pagamento: Partial<Pagamento>
): Promise<void> {
  const ref = doc(db, COLLECTIONS.AGENDAMENTOS, agendamentoId);
  const snap = await getDoc(ref);
  const atual = snap.exists() ? (snap.data() as AgendamentoFirestore) : null;

  const pagamentoMerged: Pagamento = {
    status: atual?.pagamento?.status ?? "pendente",
    valor: atual?.pagamento?.valor ?? 0,
    dataPagamento: atual?.pagamento?.dataPagamento ?? null,
    metodoPagamento: atual?.pagamento?.metodoPagamento ?? null,
    reciboCriado: atual?.pagamento?.reciboCriado ?? false,
    numeroRecibo: atual?.pagamento?.numeroRecibo ?? null,
    observacoes: atual?.pagamento?.observacoes ?? null,
    ...pagamento,
  } as Pagamento;

  await updateDoc(doc(db, COLLECTIONS.AGENDAMENTOS, agendamentoId), {
    pagamento: pagamentoMerged,
    updatedAt: serverTimestamp(),
  });
}

export interface ResumoFinanceiro {
  totalFaturado: number;
  totalPendente: number;
  sessoesRealizadas: number;
  sessoesPendentes: number;
  porTipo: Record<string, { quantidade: number; valor: number }>;
  porMetodo: Record<string, number>;
}

export async function calcularResumoFinanceiro(
  userId: string,
  inicio: Date,
  fim: Date
): Promise<ResumoFinanceiro> {
  const agendamentos = await buscarAgendamentosParaFinanceiro(userId, inicio, fim);
  
  const resumo: ResumoFinanceiro = {
    totalFaturado: 0,
    totalPendente: 0,
    sessoesRealizadas: 0,
    sessoesPendentes: 0,
    porTipo: {},
    porMetodo: {},
  };

  agendamentos.forEach((ag) => {
    const valor = ag.pagamento?.valor ?? 0;
    const status = ag.pagamento?.status ?? "pendente";
    const tipo = ag.tipoAtendimento;
    const metodo = ag.pagamento?.metodoPagamento ?? "nao_informado";

    if (status === "pago") {
      resumo.totalFaturado += valor;
      resumo.sessoesRealizadas++;
      resumo.porMetodo[metodo] = (resumo.porMetodo[metodo] ?? 0) + valor;
    } else if (status === "reembolsado") {
      resumo.totalFaturado -= valor;
      resumo.porMetodo[metodo] = (resumo.porMetodo[metodo] ?? 0) - valor;
    } else if (status === "pendente") {
      resumo.totalPendente += valor;
      resumo.sessoesPendentes++;
    }

    if (!resumo.porTipo[tipo]) {
      resumo.porTipo[tipo] = { quantidade: 0, valor: 0 };
    }
    resumo.porTipo[tipo].quantidade++;
    if (status === "pago") {
      resumo.porTipo[tipo].valor += valor;
    }
    if (status === "reembolsado") {
      resumo.porTipo[tipo].valor -= valor;
    }
  });

  return resumo;
}

export { serverTimestamp, Timestamp, doc, getDoc, getDocs, collection, query, where, updateDoc, deleteDoc, addDoc, setDoc, writeBatch };
