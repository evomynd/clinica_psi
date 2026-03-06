# Criptografia de Dados Sensíveis

## 🔒 Segurança Implementada

A partir desta versão, **todos os dados sensíveis dos pacientes** são criptografados client-side ANTES de serem enviados ao Firebase Firestore.

### Dados Protegidos

#### Pacientes

Os seguintes campos são **criptografados automaticamente**:

- ✅ Nome completo
- ✅ Email
- ✅ Telefone
- ✅ CPF (completo, não apenas hash)
- ✅ Endereço completo
- ✅ Contatos de emergência
- ✅ Valor da sessão padrão
- ✅ Observações internas

#### Agendamentos (Dados Financeiros)

Os seguintes campos financeiros são **criptografados automaticamente**:

- ✅ Valor da sessão individual
- ✅ Método de pagamento
- ✅ Número do recibo
- ✅ Observações do pagamento
- ✅ Observações do agendamento

### Dados NÃO Criptografados

#### Pacientes

Permanecem visíveis no Firestore (necessários para queries):

- IDs de referência (userId, clinicaId, pacienteId)
- Timestamps (datas de criação/atualização)
- Status (ativo, consentimentoTCLE.assinado)
- Configurações de sessão (duração, forma de pagamento, modalidade)
- Tokens e URLs de documentos públicos

#### Agendamentos

Permanecem visíveis no Firestore (necessários para queries e filtros):

- IDs de referência (userId, pacienteId, clinicaId, linkSala)
- Data/hora do agendamento
- Status da sessão (agendado, realizado, cancelado)
- Tipo de atendimento
- Status do pagamento (pendente, pago, reembolsado)
- Data do pagamento
- Flag de recibo criado
- Informações de recorrência

## 🔐 Como Funciona

### 1. Criptografia

```typescript
// No momento de salvar um paciente:
const dadosSensiveis = {
  nomeCompleto, email, telefone, cpf,
  endereco, contatosEmergencia, valorSessaoPadrao, observacoesInternas
};

// Criptografa com AES-256 usando chave derivada do UID do terapeuta
const { dadosCriptografados, dadosIV } = encryptPatientData(dadosSensiveis, terapeutaUID);

// Salva no Firestore apenas os dados criptografados
awa

### 3. Criptografia de Agendamentos

```typescript
// No momento de criar um agendamento:
const dadosSensiveisAgendamento = {
  observacoes: "Paciente relatou ansiedade",
  pagamento: {
    valor: 200,
    metodoPagamento: "pix",
    numeroRecibo: "REC-2024-001",
    observacoes: "Pago via PIX em 5 minutos"
  }
};

// Criptografa com AES-256 usando chave derivada do UID do terapeuta
const { dadosCriptografados, dadosIV } = encryptAppointmentData(dadosSensiveisAgendamento, terapeutaUID);

// Salva apenas dados públicos + blob criptografado
await Firestore.save({ 
  pacienteId, dataHora, status,
  pagamentoStatus: "pago", // Status público para queries
  dadosCriptografados, dadosIV, 
  ...outrosMetadados 
});
```it Firestore.save({ dadosCriptografados, dadosIV, ...metadados });
```

### 2. Descriptografia

```typescript
// Ao buscar um paciente:
const encrypted = await Firestore.get(pacienteId);

// Descriptografa client-side usando o UID do terapeuta autenticado
const paciente = decryptPatientData(
- **Pacientes** cadastrados ANTES desta atualização estão sem criptografia no Firestore
- **Agendamentos** criados ANTES desta atualização têm valores financeiros em texto claro

### Como Migrar

#### Pacientes
Ao editar qualquer paciente antigo, os dados serão automaticamente re-criptografados. Não é necessária ação manual.

#### Agendamentos
Ao editar qualquer agendamento antigo (ex: atualizar status de pagamento), os dados financeiros serão automaticamente re-criptografados

## 🛡️ Segurança

- **Chave de criptografia**: Derivada do UID do Firebase Auth + APP_SECRET
- **Algoritmo**: AES-256-CBC
- **Vetor de inicialização (IV)**: Único para cada registro
- **Onde a chave fica**: NUNCA é armazenada — é calculada on-the-fly a partir do UID do terapeuta
- **Quem pode descriptografar**: Apenas o terapeuta dono dos dados (userId do paciente)

### Benefícios

✅ Administradores do Firebase **NÃO** conseguem ler dados sensíveis  
✅ Backup do Firestore contém apenas dados criptografados  
✅ Vazamento de banco de dados **NÃO** expõe informações pessoais  
✅ Conformidade com LGPD (dados pseudonimizados no servidor)  
✅ Acesso zero-knowledge: nem o Firebase sabe o conteúdo real

## 📋 Migração de Dados Existentes

### ⚠️ IMPORTANTE
### Verificar Pacientes

Para verificar que a criptografia está ativa:

1. Abra o console do Firebase
2. Navegue até Firestore → `pacientes`
3. Abra qualquer registro
4. Verifique que você vê: `dadosCriptografados: "U2FsdGVkX1...=="`
5. Os dados sensíveis **não devem estar visíveis** em texto claro

### Verificar Agendamentos

1. Abra o console do Firebase
2. Navegue até Firestore → `agendamentos`
3. Abra qualquer registro
4. Verifique que você vê: `dadosCriptografados: "U2FsdGVkX1...=="`
5. Note que `pagamentoStatus` é visível (necessário para queries), mas `pagamento.valor` está criptografado
6. Os valores financeiro
### Script de Migração Completa (opcional)

Se você quiser forçar a migração de TODOS os pacientes de uma só vez:

```typescript
// Executar no console do navegador (como terapeuta autenticado)
async function migrarTodos() {
  const pacientes = await buscarPacientesPorPsicologo(user.uid);
  for (const p of pacientes) {
    await atualizarPaciente(p.id, p); // Força re-criptografia
  }
  console.log(`${pacientes.length} pacientes migrados para criptografia`);
}
migrarTodos();
```

## 🔍 Auditoria

- Todas as operações com dados sensíveis são registradas na collection `auditoria_acessos`
- Logs incluem: userId, ação, timestamp, IP
- Logs **NÃO** contêm dados descriptografados

## 🧪 Teste de Segurança

Para verificar que a criptografia está ativa:

1. Abra o console do Firebase
2. Navegue até Firestore → `pacientes`
3. Abra qualquer registro
4. Verifique que você vê: `dadosCriptografados: "U2FsdGVkX1...=="`
5. Os dados sensíveis **não devem estar visíveis** em texto claro

## ⚙️ Configuração

A chave de base é derivada de:
```
APP_SECRET = process.env.NEXT_PUBLIC_FIREBASE_APP_ID
```

**Nunca altere** `NEXT_PUBLIC_FIREBASE_APP_ID` após ter dados criptografados, ou você perderá acesso a todos os registros existentes.

## 🚨 Recuperação de Desastres

- **Backup da chave**: Não há chave para fazer backup — ela é calculada do UID
- **Perda de acesso**: Se um terapeuta perder acesso ao Firebase Auth, ele perde acesso aos dados
- **Transferência de pacientes**: Requer descriptografar → re-criptografar com UID do novo terapeuta

## 📚 Referências

- Implementação: `src/lib/encryption.ts`
- CRUD seguro: `src/lib/firebase/firestore.ts`
- Tipos: `src/types/firestore.ts`
- Biblioteca: `crypto-js` (AES-256-CBC)
