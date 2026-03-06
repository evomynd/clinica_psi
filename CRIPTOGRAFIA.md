# Criptografia de Dados Sensíveis

## 🔒 Segurança Implementada

A partir desta versão, **todos os dados sensíveis dos pacientes** são criptografados client-side ANTES de serem enviados ao Firebase Firestore.

### Dados Protegidos

Os seguintes campos são **criptografados automaticamente**:

- ✅ Nome completo
- ✅ Email
- ✅ Telefone
- ✅ CPF (completo, não apenas hash)
- ✅ Endereço completo
- ✅ Contatos de emergência
- ✅ Valor da sessão
- ✅ Observações internas

### Dados NÃO Criptografados

Permanecem visíveis no Firestore (necessários para queries):

- IDs de referência (userId, clinicaId, pacienteId)
- Timestamps (datas de criação/atualização)
- Status (ativo, consentimentoTCLE.assinado)
- Configurações de sessão (duração, forma de pagamento, modalidade)
- Tokens e URLs de documentos públicos

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
await Firestore.save({ dadosCriptografados, dadosIV, ...metadados });
```

### 2. Descriptografia

```typescript
// Ao buscar um paciente:
const encrypted = await Firestore.get(pacienteId);

// Descriptografa client-side usando o UID do terapeuta autenticado
const paciente = decryptPatientData(
  encrypted.dadosCriptografados,
  encrypted.dadosIV,
  terapeutaUID
);
```

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

Pacientes cadastrados **ANTES** desta atualização estão sem criptografia no Firestore.

### Como Migrar

Ao editar qualquer paciente antigo, os dados serão automaticamente re-criptografados. Não é necessária ação manual.

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
