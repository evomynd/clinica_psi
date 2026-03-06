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
  PacienteFirestoreEncrypted,
  ObservacaoPacienteFirestore,
  AgendamentoFirestore,
  AgendamentoFirestoreEncrypted,
  DisponibilidadeFirestore,
  AuditoriaAcessoFirestore,
  TarefaFirestore,
  Pagamento,
} from "@/types/firestore";
import {
  encryptPatientData,
  decryptPatientData,
  type DadosSensiveisPaciente,
  encryptAppointmentData,
  decryptAppointmentData,
  type DadosSensiveisAgendamento,
} from "@/lib/encryption";

// ─── Criptografia de pacientes ───────────────────────────────────────────────

function encryptPatient(
  paciente: Omit<PacienteFirestore, "id" | "createdAt" | "updatedAt">,
  userId: string
): Omit<PacienteFirestoreEncrypted, "id" | "createdAt" | "updatedAt"> {
  const dadosSensiveis: DadosSensiveisPaciente = {
    nomeCompleto: paciente.nomeCompleto,
    email: paciente.email,
    telefone: paciente.telefone,
    cpf: paciente.cpf,
    endereco: paciente.endereco,
    contatosEmergencia: paciente.contatosEmergencia,
    valorSessaoPadrao: paciente.valorSessaoPadrao,
    observacoesInternas: paciente.observacoesInternas,
  };

  const { dadosCriptografados, dadosIV } = encryptPatientData(dadosSensiveis, userId);

  return {
    userId: paciente.userId,
    clinicaId: paciente.clinicaId,
    dadosCriptografados,
    dadosIV,
    dataNascimento: paciente.dataNascimento,
    cpfHash: paciente.cpfHash,
    consentimentoTCLE: paciente.consentimentoTCLE,
    tcleUrl: paciente.tcleUrl,
    tcleToken: paciente.tcleToken,
    tcleTokenExpiraEm: paciente.tcleTokenExpiraEm,
    contratoAssinado: paciente.contratoAssinado,
    contratoUrl: paciente.contratoUrl,
    contratoToken: paciente.contratoToken,
    contratoTokenExpiraEm: paciente.contratoTokenExpiraEm,
    contratoDataAssinatura: paciente.contratoDataAssinatura,
    duracaoSessaoPadrao: paciente.duracaoSessaoPadrao,
    formaPagamentoPadrao: paciente.formaPagamentoPadrao,
    modalidadePadrao: paciente.modalidadePadrao,
    frequenciaPadrao: paciente.frequenciaPadrao,
    ativo: paciente.ativo,
  };
}

function decryptPatient(
  encrypted: PacienteFirestoreEncrypted & { id?: string },
  userId: string
): PacienteFirestore | null {
  const dadosSensiveis = decryptPatientData(
    encrypted.dadosCriptografados,
    encrypted.dadosIV,
    userId
  );

  if (!dadosSensiveis) {
    console.error("[Criptografia] Erro ao descriptografar paciente:", encrypted.id);
    return null;
  }

  return {
    id: encrypted.id,
    userId: encrypted.userId,
    clinicaId: encrypted.clinicaId,
    nomeCompleto: dadosSensiveis.nomeCompleto,
    email: dadosSensiveis.email,
    telefone: dadosSensiveis.telefone,
    cpf: dadosSensiveis.cpf,
    dataNascimento: encrypted.dataNascimento,
    cpfHash: encrypted.cpfHash,
    endereco: dadosSensiveis.endereco,
    contatosEmergencia: dadosSensiveis.contatosEmergencia,
    consentimentoTCLE: encrypted.consentimentoTCLE,
    tcleUrl: encrypted.tcleUrl,
    tcleToken: encrypted.tcleToken,
    tcleTokenExpiraEm: encrypted.tcleTokenExpiraEm,
    contratoAssinado: encrypted.contratoAssinado,
    contratoUrl: encrypted.contratoUrl,
    contratoToken: encrypted.contratoToken,
    contratoTokenExpiraEm: encrypted.contratoTokenExpiraEm,
    contratoDataAssinatura: encrypted.contratoDataAssinatura,
    duracaoSessaoPadrao: encrypted.duracaoSessaoPadrao,
    valorSessaoPadrao: dadosSensiveis.valorSessaoPadrao,
    formaPagamentoPadrao: encrypted.formaPagamentoPadrao,
    modalidadePadrao: encrypted.modalidadePadrao,
    frequenciaPadrao: encrypted.frequenciaPadrao,
    ativo: encrypted.ativo,
    observacoesInternas: dadosSensiveis.observacoesInternas,
    createdAt: encrypted.createdAt,
    updatedAt: encrypted.updatedAt,
  };
}

// ─── Criptografia de agendamentos (dados financeiros) ────────────────────────

function encryptAppointment(
  agendamento: Omit<AgendamentoFirestore, "id" | "createdAt" | "updatedAt">,
  userId: string
): Omit<AgendamentoFirestoreEncrypted, "id" | "createdAt" | "updatedAt"> {
  const dadosSensiveis: DadosSensiveisAgendamento = {
    observacoes: agendamento.observacoes,
    pagamento: {
      valor: agendamento.pagamento.valor,
      metodoPagamento: agendamento.pagamento.metodoPagamento,
      numeroRecibo: agendamento.pagamento.numeroRecibo,
      observacoes: agendamento.pagamento.observacoes,
    },
  };

  const { dadosCriptografados, dadosIV } = encryptAppointmentData(dadosSensiveis, userId);

  return {
    userId: agendamento.userId,
    pacienteId: agendamento.pacienteId,
    clinicaId: agendamento.clinicaId,
    dataHora: agendamento.dataHora,
    duracaoMinutos: agendamento.duracaoMinutos,
    status: agendamento.status,
    tipoAtendimento: agendamento.tipoAtendimento,
    linkSala: agendamento.linkSala,
    notificacaoEnviada: agendamento.notificacaoEnviada,
    recorrenciaId: agendamento.recorrenciaId,
    recorrenciaAte: agendamento.recorrenciaAte,
    pagamentoStatus: agendamento.pagamento.status,
    pagamentoDataPagamento: agendamento.pagamento.dataPagamento,
    pagamentoReciboCriado: agendamento.pagamento.reciboCriado,
    dadosCriptografados,
    dadosIV,
  };
}

function decryptAppointment(
  encrypted: AgendamentoFirestoreEncrypted & { id?: string },
  userId: string
): AgendamentoFirestore | null {
  const dadosSensiveis = decryptAppointmentData(
    encrypted.dadosCriptografados,
    encrypted.dadosIV,
    userId
  );

  if (!dadosSensiveis) {
    console.error("[Criptografia] Erro ao descriptografar agendamento:", encrypted.id);
    return null;
  }

  return {
    id: encrypted.id,
    userId: encrypted.userId,
    pacienteId: encrypted.pacienteId,
    clinicaId: encrypted.clinicaId,
    dataHora: encrypted.dataHora,
    duracaoMinutos: encrypted.duracaoMinutos,
    status: encrypted.status,
    tipoAtendimento: encrypted.tipoAtendimento,
    linkSala: encrypted.linkSala,
    notificacaoEnviada: encrypted.notificacaoEnviada,
    observacoes: dadosSensiveis.observacoes,
    recorrenciaId: encrypted.recorrenciaId,
    recorrenciaAte: encrypted.recorrenciaAte,
    pagamento: {
      status: encrypted.pagamentoStatus,
      valor: dadosSensiveis.pagamento.valor,
      dataPagamento: encrypted.pagamentoDataPagamento,
      metodoPagamento: dadosSensiveis.pagamento.metodoPagamento,
      reciboCriado: encrypted.pagamentoReciboCriado,
      numeroRecibo: dadosSensiveis.pagamento.numeroRecibo,
      observacoes: dadosSensiveis.pagamento.observacoes,
    },
    createdAt: encrypted.createdAt,
    updatedAt: encrypted.updatedAt,
  };
}

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
    | "cidade"
    | "crpAtivo"
    | "miniCV"
    | "abordagem"
    | "especialidades"
    | "valorSessao"
    | "duracaoSessao"
    | "politicaCancelamento"
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
  // Criptografa dados sensíveis antes de salvar
  const encrypted = encryptPatient(data, data.userId);
  
  const ref = await addDoc(collection(db, COLLECTIONS.PACIENTES), {
    ...encrypted,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function buscarPacientesPorPsicologo(
  userId: string,
  filters: { ativo?: boolean } = {}
): Promise<PacienteFirestore[]> {
  const constraints: QueryConstraint[] = [
    where("userId", "==", userId),
  ];
  if (filters.ativo !== undefined) {
    constraints.push(where("ativo", "==", filters.ativo));
  }
  const q = query(collection(db, COLLECTIONS.PACIENTES), ...constraints);
  const snap = await getDocs(q);
  
  // Descriptografa cada paciente
  const pacientes: PacienteFirestore[] = [];
  for (const doc of snap.docs) {
    const encrypted = { id: doc.id, ...doc.data() } as PacienteFirestoreEncrypted;
    const decrypted = decryptPatient(encrypted, userId);
    if (decrypted) {
      pacientes.push(decrypted);
    }
  }
  
  return pacientes.sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, "pt-BR"));
}

export async function buscarPacientePorId(id: string): Promise<PacienteFirestore | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.PACIENTES, id));
  if (!snap.exists()) return null;
  
  const encrypted = { id: snap.id, ...snap.data() } as PacienteFirestoreEncrypted;
  return decryptPatient(encrypted, encrypted.userId);
}

export async function atualizarPaciente(
  id: string,
  data: Partial<Omit<PacienteFirestore, "id" | "createdAt">>
): Promise<void> {
  // Se houver dados sensíveis na atualização, precisa re-criptografar tudo
  // Busca o paciente atual para pegar o userId e juntar com as mudanças
  const pacienteAtual = await buscarPacientePorId(id);
  if (!pacienteAtual) throw new Error("Paciente não encontrado");
  
  // Mescla dados atuais com as mudanças
  const pacienteMerged = { ...pacienteAtual, ...data };
  
  // Re-criptografa tudo
  const encrypted = encryptPatient(
    pacienteMerged as Omit<PacienteFirestore, "id" | "createdAt" | "updatedAt">,
    pacienteMerged.userId
  );
  
  await updateDoc(doc(db, COLLECTIONS.PACIENTES, id), {
    ...encrypted,
    updatedAt: serverTimestamp(),
  });
}

export async function togglePacienteAtivo(id: string, ativo: boolean): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.PACIENTES, id), {
    ativo,
    updatedAt: serverTimestamp(),
  });
}

export async function deletarPaciente(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.PACIENTES, id));
}

export const buscarPaciente = buscarPacientePorId;

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
  
  const decrypted = snap.docs
    .map((d) => {
      const encrypted = { id: d.id, ...d.data() } as AgendamentoFirestoreEncrypted;
      return decryptAppointment(encrypted, userId);
    })
    .filter((a): a is AgendamentoFirestore => a !== null);

  return decrypted
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
  
  const decrypted = snap.docs
    .map((d) => {
      const encrypted = { id: d.id, ...d.data() } as AgendamentoFirestoreEncrypted;
      return decryptAppointment(encrypted, userId);
    })
    .filter((a): a is AgendamentoFirestore => a !== null);

  return decrypted
    .filter((a) => {
      const ms = a.dataHora?.toMillis?.() ?? 0;
      return ms >= inicio.getTime() && ms <= fim.getTime();
    })
    .sort((a, b) => (a.dataHora?.toMillis?.() ?? 0) - (b.dataHora?.toMillis?.() ?? 0));
}

export async function buscarAgendamentoPorSala(
  linkSala: string
): Promise<AgendamentoFirestore | null> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.AGENDAMENTOS), where("linkSala", "==", linkSala))
  );
  
  if (snap.empty) return null;

  const encrypted = { id: snap.docs[0].id, ...snap.docs[0].data() } as AgendamentoFirestoreEncrypted;
  return decryptAppointment(encrypted, encrypted.userId);
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
  const encrypted = encryptAppointment(data, data.userId);
  const ref = await addDoc(collection(db, COLLECTIONS.AGENDAMENTOS), {
    ...encrypted,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function atualizarAgendamento(
  id: string,
  data: Partial<Omit<AgendamentoFirestore, "id" | "createdAt">>
): Promise<void> {
  const ref = doc(db, COLLECTIONS.AGENDAMENTOS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Agendamento não encontrado");

  const encrypted = snap.data() as AgendamentoFirestoreEncrypted;
  const current = decryptAppointment(encrypted, encrypted.userId);
  if (!current) throw new Error("Erro ao descriptografar agendamento");

  const merged = { ...current, ...data, id: snap.id };
  const reEncrypted = encryptAppointment(merged, merged.userId);

  await updateDoc(ref, {
    ...reEncrypted,
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
    const encrypted = d.data() as AgendamentoFirestoreEncrypted;
    if ((encrypted.recorrenciaId ?? null) !== recorrenciaId) return false;
    const ms = encrypted.dataHora?.toMillis?.() ?? 0;
    const inRange = incluirAtual ? ms >= baseMs : ms > baseMs;
    if (!inRange) return false;
    if (!preservarPagos) return true;
    return encrypted.pagamentoStatus !== "pago";
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
  const decrypted = snap.docs
    .map((d) => {
      const encrypted = { id: d.id, ...d.data() } as AgendamentoFirestoreEncrypted;
      return decryptAppointment(encrypted, userId);
    })
    .filter((a): a is AgendamentoFirestore => a !== null);

  return decrypted
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
      const decrypted = snap.docs
        .map((d) => {
          const encrypted = { id: d.id, ...d.data() } as AgendamentoFirestoreEncrypted;
          return decryptAppointment(encrypted, userId);
        })
        .filter((a): a is AgendamentoFirestore => a !== null);

      const data = decrypted
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
  
  const decrypted = snap.docs
    .map((d) => {
      const encrypted = { id: d.id, ...d.data() } as AgendamentoFirestoreEncrypted;
      return decryptAppointment(encrypted, userId);
    })
    .filter((a): a is AgendamentoFirestore => a !== null);

  return decrypted
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
  if (!snap.exists()) throw new Error("Agendamento não encontrado");

  const encrypted = snap.data() as AgendamentoFirestoreEncrypted;
  const atual = decryptAppointment({ id: snap.id, ...encrypted }, encrypted.userId);
  if (!atual) throw new Error("Erro ao descriptografar agendamento");

  const pagamentoMerged: Pagamento = {
    status: atual.pagamento.status,
    valor: atual.pagamento.valor,
    dataPagamento: atual.pagamento.dataPagamento,
    metodoPagamento: atual.pagamento.metodoPagamento,
    reciboCriado: atual.pagamento.reciboCriado,
    numeroRecibo: atual.pagamento.numeroRecibo,
    observacoes: atual.pagamento.observacoes,
    ...pagamento,
  };

  const updated = { ...atual, pagamento: pagamentoMerged };
  const reEncrypted = encryptAppointment(updated, encrypted.userId);

  await updateDoc(ref, {
    ...reEncrypted,
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
