# Status dos Módulos - App Clínica Psi

**Data:** Março 2026  
**Última atualização:** Após análise completa do código

---

## 📊 Visão Geral

| Módulo | Status | Progresso | Prioridade |
|--------|--------|-----------|------------|
| 🔐 Autenticação | ✅ **PRONTO** | 100% | ✅ Concluído |
| 📅 Dashboard | ✅ **PRONTO** | 95% | ✅ Concluído |
| 📆 Agenda | ✅ **PRONTO** | 90% | ✅ Concluído |
| 👥 Pacientes | ⚠️ **PENDENTE** | 5% | 🔴 **URGENTE** |
| 💬 Observações de Pacientes | ❌ **NÃO INICIADO** | 0% | 🔴 **URGENTE** |
| 🎥 Sala Virtual | ⚠️ **PENDENTE** | 10% | 🟡 Média |
| 💰 Financeiro | ⚠️ **PENDENTE** | 5% | 🟢 Baixa |
| ⚙️ Configurações | ⚠️ **PENDENTE** | 5% | 🟡 Média |
| 🌐 Landing Page (Público) | ❌ **NÃO INICIADO** | 0% | 🟢 Baixa |

---

## ✅ Módulos PRONTOS (Funcionais)

### 1. 🔐 **Autenticação** (100%)

**Arquivo:** `src/app/(public)/login/page.tsx` + `src/lib/firebase/auth.ts`

**Funcionalidades implementadas:**
- ✅ Login com email/senha
- ✅ Registro de novo usuário
- ✅ Login com Google
- ✅ Recuperação de senha (reset password)
- ✅ Validação de formulários (Zod + React Hook Form)
- ✅ Criação automática de documento no Firestore
- ✅ Context de autenticação (`useAuth`)
- ✅ Proteção de rotas (middleware)

**Status:** Totalmente funcional e pronto para produção

---

### 2. 📅 **Dashboard** (95%)

**Arquivo:** `src/app/(auth)/dashboard/page.tsx`

**Funcionalidades implementadas:**
- ✅ Saudação personalizada (bom dia, boa tarde, boa noite)
- ✅ Cards de métricas:
  - Sessões hoje (real-time)
  - Pacientes ativos (mockado - aguarda módulo Pacientes)
  - Receita do mês (mockado - aguarda módulo Financeiro)
  - Pendências (mockado)
- ✅ Lista de agendamentos do dia (real-time via Firestore)
- ✅ Alertas de pendências (mockado)
- ✅ Diagnóstico de conexão (simulado para telepsicologia)
- ✅ Design responsivo e polido

**Pendências menores:**
- Integrar contagem real de pacientes ativos (após módulo Pacientes)
- Integrar receita real (após módulo Financeiro)
- Substituir pendências mockadas por dados reais

**Status:** Funcional, aguarda integração com outros módulos

---

### 3. 📆 **Agenda** (90%)

**Arquivo:** `src/app/(auth)/agenda/page.tsx`

**Funcionalidades implementadas:**

#### Visualização:
- ✅ Calendário com 3 modos de visualização (mês, semana, dia)
- ✅ Componente `AgendaCalendar` (251 linhas)
- ✅ Navegação entre períodos (próximo/anterior)
- ✅ Marcação visual de agendamentos
- ✅ Cores por status (agendado, confirmado, realizado, cancelado, remarcado)

#### CRUD de Agendamentos:
- ✅ **Criar:** Modal `NovoAgendamentoModal` (302 linhas)
  - Seleção de paciente
  - Data/hora
  - Duração (15-120 min)
  - Tipo de atendimento (1ª consulta, retorno, introdução 15min, avaliação)
  - Valor da sessão
  - Observações
- ✅ **Ler:** Real-time via `subscribeAgendamentosPeriodo`
- ✅ **Atualizar:** Confirmar, cancelar, marcar como realizado
- ✅ **Deletar:** Cancelamento (soft delete via status)

#### Disponibilidade:
- ✅ Modal `DisponibilidadeModal` (260 linhas)
- ✅ Configuração de horários por dia da semana
- ✅ Definir intervalo entre consultas (10, 15, 20, 30, 60 min)
- ✅ Salva no Firestore

#### Painel de Detalhes:
- ✅ Exibe informações completas do agendamento selecionado
- ✅ Ações rápidas (confirmar, cancelar, marcar como realizado)
- ✅ Informações de pagamento

**Pendências menores:**
- Notificações automáticas (email/WhatsApp)
- Verificação de conflitos de horário
- Recorrência de agendamentos

**Status:** Altamente funcional, pronto para uso

---

## ⚠️ Módulos PENDENTES (Estrutura criada, implementação faltando)

### 4. 👥 **Pacientes** (5%)

**Arquivo:** `src/app/(auth)/pacientes/page.tsx` (apenas placeholder)

**O que existe:**
- ✅ Estrutura de dados no Firestore (`PacienteFirestore`)
- ✅ Funções básicas:
  - `criarPaciente()`
  - `buscarPacientesPorPsicologo()`
- ✅ Validações em Firestore Rules

**O que FALTA implementar:**

#### Interface (UI):
- ❌ Lista de pacientes (tabela/cards)
- ❌ Busca e filtros (ativo/inativo, ordem alfabética)
- ❌ Modal de cadastro/edição
- ❌ Formulário completo com validação:
  - Dados pessoais (nome, email, telefone, data nascimento)
  - CPF (com hash/criptografia)
  - Endereço completo
  - Contatos de emergência
  - TCLE (termo de consentimento)
  - Contrato (upload ou assinatura digital)

#### Funcionalidades:
- ❌ Visualizar histórico de atendimentos do paciente
- ❌ Link para agendamentos do paciente
- ❌ Link para observações/anotações do paciente
- ❌ Soft delete (marcar como inativo)
- ❌ Exportar dados do paciente (LGPD)
- ❌ Registro de auditoria ao acessar dados sensíveis

**Estimativa:** 2-3 dias de desenvolvimento

---

### 5. 💬 **Observações de Pacientes** (0%)

**Substitui:** Prontuários complexos (E2EE)

**Proposta:** Campo de texto simples para anotações do psicólogo sobre cada paciente

**O que precisa ser criado:**

#### Estrutura de dados:
```typescript
interface ObservacaoPaciente {
  id: string;
  pacienteId: string;
  userId: string;              // Psicólogo autor
  clinicaId: string;
  
  // Conteúdo criptografado (mantém criptografia atual simples)
  conteudoCriptografado: string;
  conteudoIV: string;
  isEncrypted: boolean;
  
  dataObservacao: Timestamp;
  
  // Auditoria LGPD (mantém)
  acessosPor: Array<{userId, userName, dataHora, acao}>;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Interface (UI):
- ❌ Seção dentro da página do paciente
- ❌ Lista de observações ordenadas por data (mais recente primeiro)
- ❌ Formulário de nova observação (editor de texto simples ou textarea)
- ❌ Editar observação existente
- ❌ Deletar observação (com confirmação)
- ❌ Mostrar data e autor de cada observação

#### Funcionalidades:
- ❌ CRUD completo (Create, Read, Update, Delete)
- ❌ Criptografia usando `encryptText()` e `decryptText()` existentes
- ❌ Registro automático de auditoria ao acessar/editar
- ❌ Ordenação por data
- ❌ Contador de observações no card do paciente

**Estimativa:** 1 dia de desenvolvimento

---

### 6. 🎥 **Sala Virtual** (10%)

**Arquivo:** `src/app/(auth)/sala/page.tsx` (apenas placeholder)

**O que existe:**
- ✅ Rota criada
- ✅ Campo `linkSala` nos agendamentos (UUID)

**O que FALTA implementar:**

#### Funcionalidades prioritárias:
- ❌ Validação de acesso à sala (apenas psicólogo com agendamento ativo)
- ❌ Interface de espera (antes do horário)
- ❌ Timer de sessão
- ❌ Botão "Finalizar sessão" (marca agendamento como "realizado")

#### Funcionalidades futuras (integração de vídeo):
- ❌ Integração com WebRTC (Twilio, Daily.co, Jitsi)
- ❌ Chat de texto (subcoleção Firestore)
- ❌ Compartilhamento de tela (se aplicável)
- ❌ Gravação de sessão (?) - verificar ética CFP

**Estimativa:** 
- Versão básica (sem vídeo): 1 dia
- Versão completa (com vídeo): 3-5 dias

---

### 7. 💰 **Financeiro** (5%)

**Arquivo:** `src/app/(auth)/financeiro/page.tsx` (apenas placeholder)

**O que existe:**
- ✅ Estrutura de pagamento dentro de `AgendamentoFirestore`
- ✅ Campos: `status`, `valor`, `dataPagamento`, `metodoPagamento`, `reciboCriado`

**O que FALTA implementar:**

#### Dashboard financeiro:
- ❌ Card: Receita do mês (soma de pagamentos "pago")
- ❌ Card: A receber (soma de "pendente")
- ❌ Card: Total do ano
- ❌ Gráfico de receita mensal (últimos 12 meses)

#### Lista de transações:
- ❌ Tabela com todos os agendamentos (apenas com pagamento)
- ❌ Filtros: mês, status de pagamento, paciente
- ❌ Botão "Marcar como pago"
- ❌ Botão "Gerar recibo"

#### Recibos:
- ❌ Template de recibo (PDF ou HTML)
- ❌ Geração automática ao marcar como pago
- ❌ Download/envio por email
- ❌ Numeração sequencial

#### Relatórios:
- ❌ Exportar para CSV/Excel
- ❌ Relatório anual (declaração de IR)

**Estimativa:** 3-4 dias de desenvolvimento

---

### 8. ⚙️ **Configurações** (5%)

**Arquivo:** `src/app/(auth)/configuracoes/page.tsx` (apenas placeholder)

**O que existe:**
- ✅ Estrutura de dados `UserFirestore`

**O que FALTA implementar:**

#### Perfil profissional:
- ❌ Formulário de edição:
  - Nome, email, foto
  - CRP, UF, status (ativo/inativo)
  - Mini CV
  - Abordagens terapêuticas (multi-select)
  - Especialidades
  - Valor da sessão (padrão)
  - Duração da sessão (padrão)
  - Fuso horário
  - Telefone

#### Notificações:
- ❌ Toggle: Notificações por WhatsApp
- ❌ Toggle: Notificações por email

#### Segurança:
- ❌ Alterar senha
- ❌ Autenticação de dois fatores (?)
- ❌ Histórico de logins

#### Auditoria LGPD:
- ❌ Visualizar logs de acesso aos próprios dados
- ❌ Exportar dados (direito de portabilidade)
- ❌ Solicitar exclusão de conta (direito ao esquecimento)

#### Clínica (futuro):
- ❌ Adicionar outros psicólogos (role: secretaria/admin)
- ❌ Gerenciar permissões

**Estimativa:** 2-3 dias de desenvolvimento

---

## ❌ Módulos NÃO INICIADOS

### 9. 🌐 **Landing Page Pública** (0%)

**Arquivo:** `src/app/(public)/page.tsx` (redirect simples)

**O que precisa ser criado:**

#### Seções:
- ❌ Hero (título, subtítulo, CTA "Começar agora")
- ❌ Funcionalidades (cards com ícones)
- ❌ Preços/Planos (se aplicável)
- ❌ Vitrine de psicólogos (lista pública com CRP ativo)
- ❌ FAQ
- ❌ Footer com links

#### Funcionalidades:
- ❌ Busca de psicólogos por especialidade/abordagem
- ❌ Quiz de matching (opcional)
- ❌ Blog/Recursos (?)

**Estimativa:** 2 dias de desenvolvimento

---

## 🎯 Priorização para Desenvolvimento

### **FASE 1 - URGENTE** (MVP funcional)
Desenvolver primeiro para ter um sistema utilizável:

1. **👥 Pacientes** (2-3 dias)
   - CRUD completo
   - Formulário de cadastro
   - Listagem e busca
   
2. **💬 Observações** (1 dia)
   - Campo de anotações por paciente
   - Lista e edição
   - Criptografia básica

**Resultado:** Sistema funcional para uso clínico básico (agenda + pacientes + anotações)

---

### **FASE 2 - IMPORTANTE** (Melhorias de usabilidade)

3. **⚙️ Configurações** (2-3 dias)
   - Edição de perfil
   - CRP e dados profissionais
   - Valor/duração padrão

4. **🎥 Sala Virtual Básica** (1 dia)
   - Interface sem vídeo
   - Validação de acesso
   - Timer e finalização

**Resultado:** Sistema completo para uso profissional

---

### **FASE 3 - COMPLEMENTAR** (Expansão)

5. **💰 Financeiro** (3-4 dias)
   - Dashboard de receitas
   - Controle de pagamentos
   - Recibos

6. **🎥 Sala Virtual + Vídeo** (3-5 dias)
   - Integração WebRTC
   - Chat em tempo real

7. **🌐 Landing Page** (2 dias)
   - Marketing e captação

**Resultado:** Sistema profissional completo

---

## 📋 Checklist Rápido

### ✅ O que já funciona:
- [x] Login e autenticação
- [x] Dashboard com métricas
- [x] Calendário de agendamentos
- [x] Criar/editar/cancelar agendamentos
- [x] Configurar disponibilidade
- [x] Firebase integrado
- [x] Firestore Rules implementadas
- [x] Criptografia básica (encryption.ts)
- [x] Auditoria LGPD (estrutura)

### ⏳ O que falta para MVP:
- [ ] Módulo Pacientes (CRUD)
- [ ] Módulo Observações/Anotações
- [ ] Configurações de perfil

### 🚀 O que falta para versão completa:
- [ ] Sala virtual com vídeo
- [ ] Módulo financeiro completo
- [ ] Landing page
- [ ] Notificações automáticas
- [ ] Sistema de recibos
- [ ] Exportação de dados (LGPD)

---

## 🎯 Sugestão: Próximo Módulo a Desenvolver

Baseado na análise, recomendo começar por:

### **👥 MÓDULO PACIENTES** 

**Por quê?**
1. É o core do sistema (sem pacientes, não há agendamentos úteis)
2. A agenda já está pronta e precisa dos dados de pacientes
3. Outros módulos dependem dele (observações, financeiro)
4. Tem impacto direto na usabilidade imediata

**Escopo sugerido:**
- Lista de pacientes com cards ou tabela
- Formulário de cadastro (dados essenciais primeiro)
- Edição e visualização
- Busca por nome
- Toggle ativo/inativo
- Link para criar agendamento do paciente

**Tempo estimado:** 2-3 dias

---

**Deseja que eu desenvolva o módulo de Pacientes agora?** 🚀
