import { Timestamp } from "firebase/firestore";

// ============================================================
// Roles e Enums
// ============================================================
export type UserRole = "admin" | "psicologo" | "secretaria";

export type SessionStatus =
  | "agendado"
  | "confirmado"
  | "realizado"
  | "cancelado"
  | "remarcado";

export type PagamentoStatus = "pendente" | "pago" | "reembolsado" | "cancelado";

export type AbordagemTerapeutica =
  | "TCC"
  | "Psicanálise"
  | "Humanista"
  | "Gestalt"
  | "DBT"
  | "EMDR"
  | "Sistêmica"
  | "ACT"
  | "Integrativa"
  | "Outra";

export type MotivoBusca =
  | "ansiedade"
  | "depressao"
  | "relacionamentos"
  | "autoconhecimento"
  | "luto"
  | "trauma"
  | "fobia"
  | "tdah"
  | "outro";

// ============================================================
// Coleção: users
// ============================================================
export interface UserFirestore {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  clinicaId: string;          // Para autônomos: igual ao uid

  // Dados profissionais
  crp: string | null;
  crpUF: string | null;
  cidade: string | null;
  crpAtivo: boolean;
  miniCV: string | null;
  abordagem: AbordagemTerapeutica[];
  especialidades: string[];
  valorSessao: number | null;
  duracaoSessao: number;       // em minutos, padrão 50
  politicaCancelamento: "24h" | "48h"; // Antecedência para cancelamento

  // Configurações
  fusoHorario: string;
  notificacaoWhatsapp: boolean;
  notificacaoEmail: boolean;
  telefone: string | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// Coleção: pacientes
// ============================================================
export interface ContatoEmergencia {
  nome: string;
  telefone: string;
  relacao: string;
}

export interface ConsentimentoTCLE {
  assinado: boolean;
  dataHora: Timestamp | null;
  ipAddress: string | null;
  versao: string;
}

export interface Endereco {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

// Tipo usado no Firestore (dados sensíveis criptografados)
export interface PacienteFirestoreEncrypted {
  id?: string;
  userId: string;
  clinicaId: string;

  // Dados criptografados (armazenados como string + IV)
  dadosCriptografados: string;
  dadosIV: string;

  // Dados públicos não-sensíveis
  dataNascimento: Timestamp;
  cpfHash: string | null;

  // Status legal/LGPD
  consentimentoTCLE: ConsentimentoTCLE;
  tcleUrl: string | null;
  tcleToken: string | null;
  tcleTokenExpiraEm: Timestamp | null;
  contratoAssinado: boolean;
  contratoUrl: string | null;
  contratoToken: string | null;
  contratoTokenExpiraEm: Timestamp | null;
  contratoDataAssinatura: Timestamp | null;

  // Configurações não-sensíveis
  duracaoSessaoPadrao: number;
  formaPagamentoPadrao: "pix" | "cartao" | "dinheiro" | "transferencia" | null;
  modalidadePadrao: "presencial" | "online" | null;
  frequenciaPadrao: "semanal" | "quinzenal" | null;

  // Metadados
  ativo: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Tipo usado no cliente (dados descriptografados para uso na aplicação)
export interface PacienteFirestore {
  id?: string;
  userId: string;
  clinicaId: string;

  // Dados pessoais (descriptografados)
  nomeCompleto: string;
  email: string;
  telefone: string;
  dataNascimento: Timestamp;
  cpfHash: string | null;
  cpf: string | null; // Mantido para compatibilidade

  // Localização e emergência (descriptografados)
  endereco: Endereco;
  contatosEmergencia: ContatoEmergencia[];

  // Status legal/LGPD
  consentimentoTCLE: ConsentimentoTCLE;
  tcleUrl: string | null;
  tcleToken: string | null;
  tcleTokenExpiraEm: Timestamp | null;
  contratoAssinado: boolean;
  contratoUrl: string | null;
  contratoToken: string | null;
  contratoTokenExpiraEm: Timestamp | null;
  contratoDataAssinatura: Timestamp | null;

  // Dados de atendimento
  duracaoSessaoPadrao: number;
  valorSessaoPadrao: number | null;
  formaPagamentoPadrao: "pix" | "cartao" | "dinheiro" | "transferencia" | null;
  modalidadePadrao: "presencial" | "online" | null;
  frequenciaPadrao: "semanal" | "quinzenal" | null;

  // Metadados
  ativo: boolean;
  observacoesInternas: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// Coleção: observacoes (substitui prontuários complexos)
// ============================================================
export interface AcessoAuditoria {
  userId: string;
  userName: string;
  dataHora: Timestamp;
  acao: string;
}

export interface ObservacaoPacienteFirestore {
  id?: string;
  pacienteId: string;
  userId: string;               // Psicólogo autor
  clinicaId: string;

  // Conteúdo encriptado no cliente (criptografia simples)
  conteudoCriptografado: string;
  conteudoIV: string;           // Vetor de inicialização AES
  isEncrypted: boolean;

  dataObservacao: Timestamp;

  // Auditoria LGPD
  acessosPor: AcessoAuditoria[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// Coleção: agendamentos
// ============================================================
export interface Pagamento {
  status: PagamentoStatus;
  valor: number;
  dataPagamento: Timestamp | null;
  metodoPagamento: "pix" | "cartao" | "dinheiro" | "transferencia" | null;
  reciboCriado: boolean;
  numeroRecibo?: string;
  observacoes?: string;
}

export interface AgendamentoFirestore {
  id?: string;
  userId: string;               // Psicólogo
  pacienteId: string;
  clinicaId: string;

  dataHora: Timestamp;
  duracaoMinutos: number;
  status: SessionStatus;
  tipoAtendimento: "sessao_semanal" | "sessao_emergencial" | "avaliacao" | "introducao_15min";

  linkSala: string;             // UUID para a sala virtual
  notificacaoEnviada: boolean;
  observacoes: string | null;
  recorrenciaId?: string | null;
  recorrenciaAte?: Timestamp | null;

  pagamento: Pagamento;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================
// Coleção: disponibilidades
// ============================================================
export interface DisponibilidadeFirestore {
  id?: string;
  userId: string;
  clinicaId: string;
  diaSemana: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Dom, 6=Sab
  horaInicio: string;   // "08:00"
  horaFim: string;      // "18:00"
  intervaloCom: number; // minutos entre sessões
  ativo: boolean;
  createdAt: Timestamp;
}

// ============================================================
// Coleção: tarefas
// ============================================================
export type TarefaStatus = "pendente" | "concluida";

export interface TarefaFirestore {
  id?: string;
  userId: string;
  clinicaId: string;
  titulo: string;
  descricao: string | null;
  status: TarefaStatus;
  dataHora: Timestamp | null;
  origem: "manual" | "reembolso";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  concluidaEm?: Timestamp | null;
}

// ============================================================
// Coleção: matchQuizResults
// ============================================================
export interface MatchRespostas {
  motivoBusca: MotivoBusca;
  horarioPreferido: "manha" | "tarde" | "noite" | "qualquer";
  estiloTerapeuta: "diretivo" | "acolhedor" | "equilibrado";
  abordagemPreferida: AbordagemTerapeutica | "sem_preferencia";
  generoPreferido: "masculino" | "feminino" | "nao_importa";
}

export interface ProfissionalMatch {
  userId: string;
  score: number;         // 0-100
  detalhes: string[];    // ["Match de abordagem", "Disponível à manhã"...]
}

export interface MatchQuizResultFirestore {
  id?: string;
  visitanteEmail: string | null;
  visitanteNome: string | null;
  respostas: MatchRespostas;
  profissionaisSugeridos: ProfissionalMatch[];
  clinicaId: string;
  createdAt: Timestamp;
}

// ============================================================
// Coleção: auditoriaAcessos
// ============================================================
export type AuditAction =
  | "login"
  | "logout"
  | "visualizou_prontuario"
  | "editou_prontuario"
  | "criou_paciente"
  | "editou_paciente"
  | "criou_agendamento"
  | "cancelou_agendamento"
  | "gerou_contrato"
  | "assinou_tcle"
  | "acionou_sos"
  | "exportou_dados";

export interface AuditoriaAcessoFirestore {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: AuditAction;
  resource: string;           // Ex: "prontuarios/abc123"
  pacienteId: string | null;
  pacienteNome: string | null;
  ipAddress: string;
  userAgent: string;
  clinicaId: string;
  timestamp: Timestamp;
}
