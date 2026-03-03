// Nomes das coleções Firestore — centralizados para evitar typos
export const COLLECTIONS = {
  USERS:              "users",
  PACIENTES:          "pacientes",
  OBSERVACOES:        "observacoes",       // Substitui prontuários
  AGENDAMENTOS:       "agendamentos",
  DISPONIBILIDADES:   "disponibilidades",
  MATCH_RESULTS:      "matchQuizResults",
  AUDITORIA_ACESSOS:  "auditoriaAcessos",
  NOTIFICACOES:       "notificacoes",
  TAREFAS:            "tarefas",
  SALAS_MENSAGENS:    "mensagens",   // Sub-coleção de salas/{sessionId}/mensagens
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];
