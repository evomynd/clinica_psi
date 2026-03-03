"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, User, MapPin, Loader2, AlertCircle, Phone } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { criarPaciente, atualizarPaciente } from "@/lib/firebase/firestore";
import { hashCPF } from "@/lib/encryption";
import { useAuth } from "@/lib/hooks/useAuth";
import { maskCPF, maskPhone, maskCEP, isValidCPF, cn } from "@/lib/utils";
import type { PacienteFirestore } from "@/types/firestore";
import { toast } from "sonner";

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  nomeCompleto:  z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email:         z.string().optional().refine((v) => !v || z.string().email().safeParse(v).success, "E-mail inválido"),
  telefone:      z.string().min(10, "Telefone inválido"),
  dataNascimento:z.string().min(1, "Data de nascimento é obrigatória"),
  cpf:           z.string().optional(),
  // Endereço
  logradouro:    z.string().optional(),
  numero:        z.string().optional(),
  complemento:   z.string().optional(),
  bairro:        z.string().optional(),
  cidade:        z.string().optional(),
  estado:        z.string().optional(),
  cep:           z.string().optional(),
  // Contato de emergência
  emergenciaNome:     z.string().optional(),
  emergenciaTelefone: z.string().optional(),
  emergenciaRelacao:  z.string().optional(),
}).superRefine((data, ctx) => {
  const temAlgumCampoEmergencia =
    !!data.emergenciaNome?.trim() ||
    !!data.emergenciaTelefone?.trim() ||
    !!data.emergenciaRelacao?.trim();

  if (!temAlgumCampoEmergencia) return;

  if (!data.emergenciaNome?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["emergenciaNome"],
      message: "Informe o nome do contato de emergência",
    });
  }

  const tel = (data.emergenciaTelefone ?? "").replace(/\D/g, "");
  if (!tel || tel.length < 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["emergenciaTelefone"],
      message: "Telefone de emergência inválido",
    });
  }
});

type FormData = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────
interface PacienteModalProps {
  open:       boolean;
  paciente?:  PacienteFirestore | null;  // Se informado, modo edição
  onClose:    () => void;
  onSuccess?: (pacienteId: string, nomePaciente?: string) => void;
}

type Tab = "dados" | "endereco" | "emergencia";

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
  "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC",
  "SP","SE","TO",
];

// ─── Componente ───────────────────────────────────────────────────────────────
export function PacienteModal({ open, paciente, onClose, onSuccess }: PacienteModalProps) {
  const { user, userProfile } = useAuth();
  const [tab,     setTab]     = useState<Tab>("dados");
  const [loading, setLoading] = useState(false);
  const [submitLiberado, setSubmitLiberado] = useState(true);
  const ordemTabs: Tab[] = ["dados", "endereco", "emergencia"];

  const isEdit = !!paciente?.id;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nomeCompleto:  "",
      email:         "",
      telefone:      "",
      dataNascimento:"",
      cpf:           "",
      logradouro:    "",
      numero:        "",
      complemento:   "",
      bairro:        "",
      cidade:        "",
      estado:        "",
      cep:           "",
      emergenciaNome:     "",
      emergenciaTelefone: "",
      emergenciaRelacao:  "",
    },
  });

  // Preenche formulário ao editar
  useEffect(() => {
    if (open && paciente) {
      const nasc = paciente.dataNascimento?.toDate?.() ?? new Date();
      const pad  = (n: number) => String(n).padStart(2, "0");
      const dateStr = `${nasc.getFullYear()}-${pad(nasc.getMonth() + 1)}-${pad(nasc.getDate())}`;
      const contatoEmergencia = paciente.contatosEmergencia?.[0];
      reset({
        nomeCompleto:   paciente.nomeCompleto,
        email:          paciente.email,
        telefone:       paciente.telefone,
        dataNascimento: dateStr,
        cpf:            "",   // CPF nunca exibido depois de salvo
        logradouro:     paciente.endereco?.logradouro  ?? "",
        numero:         paciente.endereco?.numero       ?? "",
        complemento:    paciente.endereco?.complemento ?? "",
        bairro:         paciente.endereco?.bairro       ?? "",
        cidade:         paciente.endereco?.cidade        ?? "",
        estado:         paciente.endereco?.estado        ?? "",
        cep:            paciente.endereco?.cep           ?? "",
        emergenciaNome:     contatoEmergencia?.nome     ?? "",
        emergenciaTelefone: contatoEmergencia?.telefone ?? "",
        emergenciaRelacao:  contatoEmergencia?.relacao  ?? "",
      });
    } else if (open) {
      reset();
    }
  }, [open, paciente, reset]);

  useEffect(() => {
    if (tab !== "emergencia") {
      setSubmitLiberado(true);
      return;
    }

    // Evita submit acidental por duplo clique no botão "Próximo"
    setSubmitLiberado(false);
    const timer = window.setTimeout(() => setSubmitLiberado(true), 350);
    return () => window.clearTimeout(timer);
  }, [tab]);

  async function onSubmit(data: FormData) {
    if (!user || !userProfile) return;
    setLoading(true);
    try {
      const [ano, mes, dia] = data.dataNascimento.split("-").map(Number);
      const dtNasc = Timestamp.fromDate(new Date(ano, mes - 1, dia));

      // Valida CPF se fornecido
      let cpfHash: string | null = null;
      if (data.cpf && data.cpf.replace(/\D/g, "").length > 0) {
        const cpfClean = data.cpf.replace(/\D/g, "");
        if (!isValidCPF(cpfClean)) {
          toast.error("CPF inválido");
          setLoading(false);
          return;
        }
        cpfHash = hashCPF(cpfClean);
      }

      const payload: Omit<PacienteFirestore, "id" | "createdAt" | "updatedAt"> = {
        userId:    user.uid,
        clinicaId: userProfile.clinicaId,
        nomeCompleto:  data.nomeCompleto.trim(),
        email:         (data.email ?? "").trim(),
        telefone:      data.telefone.replace(/\D/g, ""),
        dataNascimento: dtNasc,
        cpfHash:       isEdit && !data.cpf ? (paciente?.cpfHash ?? null) : cpfHash,
        endereco: {
          logradouro:  data.logradouro  ?? "",
          numero:      data.numero      ?? "",
          complemento: data.complemento ?? "",
          bairro:      data.bairro      ?? "",
          cidade:      data.cidade      ?? "",
          estado:      data.estado      ?? "",
          cep:         (data.cep ?? "").replace(/\D/g, ""),
        },
        contatosEmergencia:
          data.emergenciaNome?.trim() || data.emergenciaTelefone?.trim() || data.emergenciaRelacao?.trim()
            ? [{
                nome: data.emergenciaNome?.trim() ?? "",
                telefone: (data.emergenciaTelefone ?? "").replace(/\D/g, ""),
                relacao: data.emergenciaRelacao?.trim() ?? "",
              }]
            : [],
        consentimentoTCLE:  paciente?.consentimentoTCLE ?? {
          assinado: false, dataHora: null, ipAddress: null, versao: "1.0",
        },
        tcleUrl:                  paciente?.tcleUrl                  ?? null,
        tcleToken:                paciente?.tcleToken                ?? null,
        tcleTokenExpiraEm:        paciente?.tcleTokenExpiraEm        ?? null,
        contratoAssinado:         paciente?.contratoAssinado         ?? false,
        contratoUrl:              paciente?.contratoUrl              ?? null,
        contratoDataAssinatura:   paciente?.contratoDataAssinatura   ?? null,
        ativo:             paciente?.ativo ?? true,
        observacoesInternas: paciente?.observacoesInternas ?? null,
      };

      if (isEdit && paciente?.id) {
        await atualizarPaciente(paciente.id, payload);
        toast.success("Paciente atualizado com sucesso!");
        onSuccess?.(paciente.id, payload.nomeCompleto);
      } else {
        const id = await criarPaciente(payload);
        toast.success("Paciente cadastrado com sucesso!");
        onSuccess?.(id, payload.nomeCompleto);
      }
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar paciente. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary-500" />
            <h2 className="font-semibold text-slate-800">
              {isEdit ? "Editar Paciente" : "Novo Paciente"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6">
          {(["dados", "endereco", "emergencia"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex items-center gap-1.5 px-1 py-3 text-sm font-medium border-b-2 mr-6 transition-colors",
                tab === t
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              {t === "dados"    ? <><User    className="w-3.5 h-3.5" /> Dados Pessoais</> : null}
              {t === "endereco" ? <><MapPin  className="w-3.5 h-3.5" /> Endereço</>       : null}
              {t === "emergencia" ? <><Phone className="w-3.5 h-3.5" /> Contato de Emergência</> : null}
            </button>
          ))}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            {/* ─── Tab Dados Pessoais ─────────────────────────────────────── */}
            {tab === "dados" && (
              <>
                <Field label="Nome completo *" error={errors.nomeCompleto?.message}>
                  <input
                    {...register("nomeCompleto")}
                    className={input(!!errors.nomeCompleto)}
                    placeholder="Ex: Maria da Silva"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="E-mail" error={errors.email?.message}>
                    <input
                      {...register("email")}
                      type="email"
                      className={input(!!errors.email)}
                      placeholder="email@exemplo.com (opcional)"
                    />
                  </Field>
                  <Field label="Telefone *" error={errors.telefone?.message}>
                    <input
                      {...register("telefone")}
                      className={input(!!errors.telefone)}
                      placeholder="(11) 99999-9999"
                      maxLength={15}
                      onChange={(e) => setValue("telefone", maskPhone(e.target.value))}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Data de nascimento *" error={errors.dataNascimento?.message}>
                    <input
                      {...register("dataNascimento")}
                      type="date"
                      className={input(!!errors.dataNascimento)}
                    />
                  </Field>
                  <Field
                    label={isEdit ? "CPF (deixe vazio para manter)" : "CPF"}
                    error={undefined}
                  >
                    <input
                      {...register("cpf")}
                      className={input(false)}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      onChange={(e) => setValue("cpf", maskCPF(e.target.value))}
                    />
                  </Field>
                </div>

                {isEdit && paciente?.cpfHash && (
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    CPF já cadastrado (criptografado). Deixe vazio para manter.
                  </p>
                )}
              </>
            )}

            {/* ─── Tab Endereço ───────────────────────────────────────────── */}
            {tab === "endereco" && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <Field label="Logradouro" error={undefined}>
                      <input {...register("logradouro")} className={input(false)} placeholder="Rua, Av., etc." />
                    </Field>
                  </div>
                  <Field label="Número" error={undefined}>
                    <input {...register("numero")} className={input(false)} placeholder="123" />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Complemento" error={undefined}>
                    <input {...register("complemento")} className={input(false)} placeholder="Apto, Bloco..." />
                  </Field>
                  <Field label="Bairro" error={undefined}>
                    <input {...register("bairro")} className={input(false)} placeholder="Bairro" />
                  </Field>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <Field label="Cidade" error={undefined}>
                      <input {...register("cidade")} className={input(false)} placeholder="São Paulo" />
                    </Field>
                  </div>
                  <Field label="Estado" error={undefined}>
                    <select {...register("estado")} className={input(false)}>
                      <option value="">UF</option>
                      {ESTADOS_BR.map((uf) => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="CEP" error={undefined}>
                  <input
                    {...register("cep")}
                    className={cn(input(false), "max-w-[160px]")}
                    placeholder="00000-000"
                    maxLength={9}
                    onChange={(e) => setValue("cep", maskCEP(e.target.value))}
                  />
                </Field>
              </>
            )}

            {/* ─── Tab Contato de Emergência ───────────────────────────── */}
            {tab === "emergencia" && (
              <>
                <p className="text-xs text-slate-500 -mt-1">
                  Opcional. Se preencher um campo, nome e telefone passam a ser obrigatórios.
                </p>

                <Field label="Nome do contato" error={errors.emergenciaNome?.message}>
                  <input
                    {...register("emergenciaNome")}
                    className={input(!!errors.emergenciaNome)}
                    placeholder="Ex: Ana Souza"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Telefone" error={errors.emergenciaTelefone?.message}>
                    <input
                      {...register("emergenciaTelefone")}
                      className={input(!!errors.emergenciaTelefone)}
                      placeholder="(11) 99999-9999"
                      maxLength={15}
                      onChange={(e) => setValue("emergenciaTelefone", maskPhone(e.target.value))}
                    />
                  </Field>

                  <Field label="Relação" error={errors.emergenciaRelacao?.message}>
                    <input
                      {...register("emergenciaRelacao")}
                      className={input(!!errors.emergenciaRelacao)}
                      placeholder="Ex: Mãe, Pai, Cônjuge"
                    />
                  </Field>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 gap-3">
            <div className="flex gap-2">
              {tab !== "dados" && (
                <button type="button" onClick={() => setTab(ordemTabs[ordemTabs.indexOf(tab) - 1])}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                  ← Anterior
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                Cancelar
              </button>
              {tab !== "emergencia" ? (
                <button type="button" onClick={() => setTab(ordemTabs[ordemTabs.indexOf(tab) + 1])}
                  className="px-4 py-2 text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-colors">
                  Próximo →
                </button>
              ) : (
                <button type="submit" disabled={loading || !submitLiberado}
                  className="px-5 py-2 text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-colors disabled:opacity-60 disabled:cursor-wait flex items-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isEdit ? "Salvar alterações" : "Cadastrar paciente"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function input(hasError: boolean) {
  return cn(
    "w-full px-3 py-2 text-sm rounded-xl border bg-white transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-primary-300",
    hasError
      ? "border-red-300 focus:border-red-400"
      : "border-slate-200 focus:border-primary-400"
  );
}

function Field({
  label, error, children,
}: { label: string; error: string | undefined; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      {children}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}
