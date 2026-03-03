# App Clínica Psi - Estrutura do Projeto

## 📋 Visão Geral

Plataforma de gestão e telepsicologia para psicólogos e clínicas. Segura, ética e em conformidade com a LGPD e Resolução CFP 09/2024.

**Stack Tecnológica:**
- **Framework:** Next.js 16 (App Router)
- **Linguagem:** TypeScript
- **Backend:** Firebase (Authentication + Firestore)
- **UI:** React 19, Tailwind CSS 4
- **PWA:** next-pwa (Service Worker)
- **Formulários:** React Hook Form + Zod
- **Calendário:** React Big Calendar
- **Criptografia:** crypto-js (simulação E2EE para prontuários)

---

## 🗂️ Estrutura de Pastas

```
app-clinica-psi/
├── public/
│   ├── manifest.json         # Configuração PWA
│   └── sw.js                 # Service Worker
│
├── src/
│   ├── app/                  # Rotas Next.js (App Router)
│   │   ├── (auth)/          # Rotas autenticadas
│   │   │   ├── agenda/      # Gestão de agendamentos
│   │   │   ├── configuracoes/ # Configurações do usuário
│   │   │   ├── dashboard/   # Painel principal
│   │   │   ├── financeiro/  # Gestão financeira
│   │   │   ├── pacientes/   # CRUD de pacientes
│   │   │   ├── sala/        # Sala virtual para atendimento
│   │   │   └── layout.tsx   # Layout com Sidebar/Navbar
│   │   │
│   │   ├── (public)/        # Rotas públicas
│   │   │   ├── page.tsx     # Landing page
│   │   │   ├── login/       # Autenticação
│   │   │   └── layout.tsx   # Layout público
│   │   │
│   │   ├── api/             # API Routes
│   │   │   └── agenda/notificar/route.ts
│   │   │
│   │   ├── layout.tsx       # Root layout (AuthProvider, Toaster)
│   │   ├── page.tsx         # Página inicial
│   │   └── globals.css      # Estilos globais
│   │
│   ├── components/
│   │   ├── agenda/
│   │   │   ├── AgendaCalendar.tsx           # Calendário de agendamentos
│   │   │   ├── DisponibilidadeModal.tsx     # Modal para configurar disponibilidade
│   │   │   └── NovoAgendamentoModal.tsx     # Modal para criar agendamento
│   │   ├── layout/
│   │   │   ├── Navbar.tsx   # Barra de navegação superior
│   │   │   └── Sidebar.tsx  # Menu lateral
│   │   └── shared/
│   │       └── ServiceWorkerRegistration.tsx
│   │
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── auth.ts        # Autenticação (login, registro, Google)
│   │   │   ├── collections.ts # Nomes das coleções Firestore
│   │   │   ├── config.ts      # Configuração Firebase
│   │   │   └── firestore.ts   # Funções CRUD Firestore
│   │   ├── hooks/
│   │   │   └── useAuth.tsx    # Context de autenticação
│   │   ├── encryption.ts      # Criptografia E2EE para prontuários
│   │   └── utils.ts           # Utilitários (formatação, etc.)
│   │
│   ├── types/
│   │   └── firestore.ts       # TypeScript interfaces para Firestore
│   │
│   └── proxy.ts               # (se necessário para dev)
│
├── firestore.rules              # Regras de segurança Firestore
├── firestore.indexes.json       # Índices do Firestore
├── next.config.ts               # Configuração Next.js + PWA
├── tailwind.config.ts           # Configuração Tailwind
├── tsconfig.json                # Configuração TypeScript
├── eslint.config.mjs            # Configuração ESLint
└── package.json                 # Dependências
```

---

## 🗄️ Estrutura do Firestore

### Coleções Principais

#### 1. **users**
```typescript
{
  uid: string;
  email: string;
  displayName: string | null;
  role: "admin" | "psicologo" | "secretaria";
  clinicaId: string;           // Para autônomos: igual ao uid
  
  // Dados profissionais
  crp: string | null;
  crpUF: string | null;
  crpAtivo: boolean;
  miniCV: string | null;
  abordagem: AbordagemTerapeutica[];
  especialidades: string[];
  valorSessao: number | null;
  duracaoSessao: number;       // padrão: 50 minutos
  
  // Configurações
  fusoHorario: string;
  notificacaoWhatsapp: boolean;
  notificacaoEmail: boolean;
  telefone: string | null;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### 2. **pacientes**
```typescript
{
  id: string;
  userId: string;              // Psicólogo responsável
  clinicaId: string;
  
  // Dados pessoais
  nomeCompleto: string;
  email: string;
  telefone: string;
  dataNascimento: Timestamp;
  cpfHash: string | null;      // CPF encriptado
  
  // Endereço
  endereco: {
    logradouro, numero, complemento, bairro, cidade, estado, cep
  };
  
  // Contatos de emergência
  contatosEmergencia: Array<{nome, telefone, relacao}>;
  
  // LGPD/Compliance
  consentimentoTCLE: {
    assinado: boolean;
    dataHora: Timestamp | null;
    ipAddress: string | null;
    versao: string;
  };
  contratoAssinado: boolean;
  contratoUrl: string | null;
  contratoDataAssinatura: Timestamp | null;
  
  ativo: boolean;
  observacoesInternas: string | null;
  createdAt/updatedAt: Timestamp;
}
```

#### 3. **prontuarios** (E2EE)
```typescript
{
  id: string;
  pacienteId: string;
  userId: string;                    // Psicólogo autor
  clinicaId: string;
  tipo: "anamnese" | "evolucao";
  
  // CRIPTOGRAFADO no cliente (AES-256)
  conteudoCriptografado: string;
  conteudoIV: string;                // Vetor de inicialização
  isEncrypted: boolean;
  
  dataAtendimento: Timestamp;
  duracaoMinutos: number;
  
  // Auditoria LGPD
  acessosPor: Array<{userId, userName, dataHora, acao}>;
  
  createdAt/updatedAt: Timestamp;
}
```

#### 4. **agendamentos**
```typescript
{
  id: string;
  userId: string;                    // Psicólogo
  pacienteId: string;
  clinicaId: string;
  
  dataHora: Timestamp;
  duracaoMinutos: number;
  status: "agendado" | "confirmado" | "realizado" | "cancelado" | "remarcado";
  tipoAtendimento: "primeira" | "retorno" | "introducao_15min" | "avaliacao";
  
  linkSala: string;                  // UUID para sala virtual
  notificacaoEnviada: boolean;
  observacoes: string | null;
  
  pagamento: {
    status: "pendente" | "pago" | "reembolsado" | "cancelado";
    valor: number;
    dataPagamento: Timestamp | null;
    metodoPagamento: "pix" | "cartao" | "dinheiro" | "transferencia" | null;
    reciboCriado: boolean;
  };
  
  createdAt/updatedAt: Timestamp;
}
```

#### 5. **disponibilidades**
```typescript
{
  id: string;
  userId: string;
  clinicaId: string;
  diaSemana: 0-6;                    // 0=Domingo, 6=Sábado
  horaInicio: string;                // "08:00"
  horaFim: string;                   // "17:00"
  ativo: boolean;
  createdAt/updatedAt: Timestamp;
}
```

#### 6. Outras coleções
- **matchQuizResults**: Resultados de quiz de matching psicólogo-paciente
- **auditoriaAcessos**: Log de acessos (LGPD)
- **notificacoes**: Notificações do sistema
- **mensagens**: Sub-coleção de `salas/{sessionId}/mensagens`

---

## 🔐 Segurança e Compliance

### LGPD
- ✅ Consentimento TCLE explícito
- ✅ CPF armazenado com hash/criptografia
- ✅ Auditoria de acessos aos prontuários
- ✅ Direito ao esquecimento (soft delete com `ativo: false`)

### Firestore Rules
- Usuários só acessam seus próprios dados
- Psicólogos só acessam pacientes vinculados ao seu `userId`
- Prontuários: **acesso exclusivo** ao autor
- Admins podem auditar (somente leitura)

### E2EE (End-to-End Encryption)
- Prontuários são criptografados no cliente com AES-256 (crypto-js)
- Chave armazenada localmente (não enviada ao servidor)
- Firebase armazena apenas o conteúdo criptografado

### CFP 09/2024
- Atendimento online através de sala virtual
- Registro de agendamentos e controle de presença
- Consentimento informado digital

---

## 🎨 Páginas e Funcionalidades

### Rotas Públicas (public)/
- **/** - Landing page (apresentação da plataforma)
- **/login** - Login com email/senha ou Google

### Rotas Autenticadas (auth)/
- **/dashboard** - Painel com resumo de agendamentos, pacientes, pendências
- **/agenda** - Calendário de agendamentos + configuração de disponibilidade
- **/pacientes** - Lista e CRUD de pacientes
- **/sala** - Sala virtual de telepsicologia
- **/financeiro** - Gestão financeira (pagamentos, recibos)
- **/configuracoes** - Configurações do perfil, CRP, especialidades

---

## 🚀 Funcionalidades Principais

### Dashboard
- **Cards de resumo:**
  - Agendamentos hoje
  - Total de pacientes ativos
  - Receita do mês
  - Pendências (contratos, TCLE, pagamentos)
- **Lista de agendamentos do dia** com status em tempo real
- **Teste de conexão** para telepsicologia

### Agenda
- Calendário visual (react-big-calendar)
- Criação de agendamentos
- Configuração de disponibilidade semanal
- Notificações via email/WhatsApp

### Pacientes
- CRUD completo
- Upload de documentos (contrato, TCLE)
- Histórico de atendimentos
- Dados pessoais + endereço + emergência

### Prontuários
- Criação de anamnese e evoluções
- **Criptografia E2EE** para privacidade total
- Auditoria de acessos (LGPD)

### Sala Virtual
- Link único por agendamento
- Chat em tempo real (Firebase Realtime Database ou subcoleção)
- Vídeo (sugestão: integração futura com WebRTC ou Jitsi)

### Financeiro
- Registro de pagamentos
- Emissão de recibos
- Relatórios de receita

---

## ⚙️ Configuração e Deploy

### Variáveis de Ambiente (.env.local)
```bash
NEXT_PUBLIC_APP_NAME=Clínica Psi

# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### Scripts
```bash
npm run dev      # Desenvolvimento (localhost:3000)
npm run build    # Build de produção
npm run start    # Servidor de produção
npm run lint     # ESLint
```

### Deploy Sugerido
- **Vercel** (recomendado para Next.js)
- Firebase Hosting (alternativa)

---

## 📦 Dependências Principais

### Produção
- `next` 16.1.6
- `react` 19.2.3
- `firebase` 12.9.0 (Auth + Firestore)
- `react-hook-form` + `zod` (validação de formulários)
- `react-big-calendar` (agenda)
- `crypto-js` (criptografia)
- `date-fns` (manipulação de datas)
- `lucide-react` (ícones)
- `sonner` (toast notifications)
- `next-pwa` (Progressive Web App)

### Desenvolvimento
- `typescript` 5
- `eslint` 9 + `eslint-config-next`
- `tailwindcss` 4

---

## 🎯 Próximos Passos (Roadmap)

1. **Integração de vídeo WebRTC** na sala virtual
2. **Sistema de assinaturas** (planos)
3. **Relatórios avançados** (gráficos de atendimentos, receita)
4. **App mobile** (React Native ou Capacitor)
5. **Integrações:**
   - WhatsApp Business API (notificações)
   - Gateway de pagamento (Stripe, MercadoPago)
   - E-mail marketing (SendGrid, Mailgun)
6. **Multi-idioma** (i18n)

---

## 📄 Licença e Compliance

Este projeto deve estar em conformidade com:
- **LGPD** (Lei Geral de Proteção de Dados)
- **Resolução CFP 09/2024** (Psicologia online)
- **Código de Ética do Psicólogo**

> ⚠️ **IMPORTANTE:** Consulte um advogado especializado em LGPD e um profissional do CFP antes de colocar em produção.

---

## 📞 Suporte

Para dúvidas sobre a estrutura do projeto, consulte:
- `src/types/firestore.ts` - Estrutura de dados
- `firestore.rules` - Regras de segurança
- `src/lib/firebase/` - Funções Firebase

---

**Última atualização:** Março 2026
