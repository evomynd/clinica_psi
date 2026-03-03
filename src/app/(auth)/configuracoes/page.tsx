"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Briefcase, Bell, Shield, Save, Download, Trash2, Loader2, Eye, EyeOff, X } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { buscarUsuario, atualizarPerfil, exportarDadosLGPD } from "@/lib/firebase/firestore";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { UserFirestore, AbordagemTerapeutica } from "@/types/firestore";

// ─── Schemas ──────────────────────────────────────────────────────────────────
const perfilSchema = z.object({
  displayName:     z.string().min(3, "Nome muito curto"),
  crp:             z.string().optional(),
  crpUF:           z.string().length(2, "UF inválida").optional(),
  cidade:          z.union([z.literal(""), z.string().min(2, "Cidade inválida")]).optional(),
  miniCV:          z.string().max(500, "Máximo 500 caracteres").optional(),
  abordagem:       z.array(z.enum(["TCC", "Psicanálise", "Humanista", "Gestalt", "DBT", "EMDR", "Sistêmica", "ACT", "Integrativa", "Outra"])),
  especialidades:  z.array(z.string()),
});

const atendimentoSchema = z.object({
  valorSessao:     z.number().min(0, "Valor inválido").nullable(),
  duracaoSessao:   z.number().min(15).max(180),
  politicaCancelamento: z.enum(["24h", "48h"]),
  telefone:        z.string().optional(),
});

const notificacoesSchema = z.object({
  notificacaoEmail:     z.boolean(),
  notificacaoWhatsapp:  z.boolean(),
});

const senhaSchema = z.object({
  senhaAtual:  z.string().min(1, "Informe a senha atual"),
  novaSenha:   z.string().min(6, "Mínimo 6 caracteres"),
  confirmacao: z.string().min(6, "Confirme a nova senha"),
}).refine((data) => data.novaSenha === data.confirmacao, {
  message: "Senhas não coincidem",
  path: ["confirmacao"],
});

type PerfilData = z.infer<typeof perfilSchema>;
type AtendimentoData = z.infer<typeof atendimentoSchema>;
type NotificacoesData = z.infer<typeof notificacoesSchema>;
type SenhaData = z.infer<typeof senhaSchema>;

// ─── Constantes ───────────────────────────────────────────────────────────────
const ABORDAGENS: AbordagemTerapeutica[] = [
  "TCC", "Psicanálise", "Humanista", "Gestalt", "DBT", "EMDR", "Sistêmica", "ACT", "Integrativa", "Outra"
];

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const ESPECIALIDADES_SUGERIDAS = [
  "Clínica",
  "Organizacional",
  "Escolar",
  "Social",
  "Neuropsicologia",
  "Hospitalar",
  "Esportiva",
  "Jurídica",
  "Trânsito",
];

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const [aba, setAba] = useState<"perfil" | "atendimento" | "notificacoes" | "seguranca">("perfil");
  const [perfil, setPerfil] = useState<UserFirestore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    buscarUsuario(user.uid).then((u) => {
      setPerfil(u);
      setLoading(false);
    });
  }, [user]);

  if (loading || !perfil || !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-800">Configurações</h1>
        <p className="text-slate-500 text-sm mt-1">Perfil, atendimento, notificações e segurança</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: "perfil", label: "Perfil Profissional", icon: User },
          { id: "atendimento", label: "Atendimento", icon: Briefcase },
          { id: "notificacoes", label: "Notificações", icon: Bell },
          { id: "seguranca", label: "Segurança", icon: Shield },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setAba(tab.id as typeof aba)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              aba === tab.id
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        {aba === "perfil" && <AbaPerfil perfil={perfil} userId={user.uid} onUpdate={(u) => setPerfil(u)} />}
        {aba === "atendimento" && <AbaAtendimento perfil={perfil} userId={user.uid} onUpdate={(u) => setPerfil(u)} />}
        {aba === "notificacoes" && <AbaNotificacoes perfil={perfil} userId={user.uid} onUpdate={(u) => setPerfil(u)} />}
        {aba === "seguranca" && <AbaSeguranca userId={user.uid} />}
      </div>
    </div>
  );
}

// ─── Aba Perfil Profissional ──────────────────────────────────────────────────
function AbaPerfil({ perfil, userId, onUpdate }: { perfil: UserFirestore; userId: string; onUpdate: (u: UserFirestore) => void }) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<PerfilData>({
    resolver: zodResolver(perfilSchema),
    defaultValues: {
      displayName:    perfil.displayName ?? "",
      crp:            perfil.crp ?? "",
      crpUF:          perfil.crpUF ?? "",
      cidade:         perfil.cidade ?? "",
      miniCV:         perfil.miniCV ?? "",
      abordagem:      perfil.abordagem ?? [],
      especialidades: perfil.especialidades ?? [],
    },
  });

  const miniCVValue = watch("miniCV") || "";
  const caracteresRestantes = 500 - miniCVValue.length;

  const onSubmit = async (data: PerfilData) => {
    setLoading(true);
    try {
      await atualizarPerfil(userId, {
        ...data,
        cidade: data.cidade?.trim() ? data.cidade.trim() : null,
      });
      const atualizado = await buscarUsuario(userId);
      if (atualizado) onUpdate(atualizado);
      toast.success("Perfil atualizado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar perfil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
          <input
            {...register("displayName")}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          {errors.displayName && <p className="text-xs text-red-600 mt-1">{errors.displayName.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cidade (Foro preferencial)</label>
          <input
            {...register("cidade")}
            placeholder="Ex: São Paulo"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
          {errors.cidade && <p className="text-xs text-red-600 mt-1">{errors.cidade.message}</p>}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">CRP</label>
            <input
              {...register("crp")}
              placeholder="Ex: 01/12345"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">UF</label>
            <select
              {...register("crpUF")}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">--</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Mini CV / Apresentação</label>
        <textarea
          {...register("miniCV")}
          rows={4}
          placeholder="Breve apresentação profissional (até 500 caracteres)"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
        />
        <div className="flex items-center justify-between mt-1">
          <div>
            {errors.miniCV && <p className="text-xs text-red-600">{errors.miniCV.message}</p>}
          </div>
          <p className={`text-xs font-medium ${
            caracteresRestantes < 50 ? "text-red-600" :
            caracteresRestantes < 100 ? "text-amber-600" :
            "text-slate-500"
          }`}>
            {caracteresRestantes} / 500 caracteres
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Abordagens Terapêuticas</label>
        <div className="flex flex-wrap gap-2">
          {ABORDAGENS.map((ab) => (
            <label key={ab} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input type="checkbox" value={ab} {...register("abordagem")} />
              <span className="text-sm">{ab}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Especialidades</label>
        <div className="flex flex-wrap gap-2">
          {ESPECIALIDADES_SUGERIDAS.map((esp) => (
            <label key={esp} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input type="checkbox" value={esp} {...register("especialidades")} />
              <span className="text-sm">{esp}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar Perfil
      </button>
    </form>
  );
}

// ─── Aba Atendimento ──────────────────────────────────────────────────────────
function AbaAtendimento({ perfil, userId, onUpdate }: { perfil: UserFirestore; userId: string; onUpdate: (u: UserFirestore) => void }) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<AtendimentoData>({
    resolver: zodResolver(atendimentoSchema),
    defaultValues: {
      valorSessao:   perfil.valorSessao,
      duracaoSessao: perfil.duracaoSessao,
      politicaCancelamento: perfil.politicaCancelamento ?? "24h",
      telefone:      perfil.telefone ?? "",
    },
  });

  const onSubmit = async (data: AtendimentoData) => {
    setLoading(true);
    try {
      await atualizarPerfil(userId, data);
      const atualizado = await buscarUsuario(userId);
      if (atualizado) onUpdate(atualizado);
      toast.success("Configurações de atendimento atualizadas!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Valor Padrão da Sessão (R$)</label>
          <input
            type="number"
            step="0.01"
            {...register("valorSessao", { valueAsNumber: true })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
          {errors.valorSessao && <p className="text-xs text-red-600 mt-1">{errors.valorSessao.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Duração Padrão (minutos)</label>
          <select
            {...register("duracaoSessao", { valueAsNumber: true })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            {[15, 30, 45, 50, 60, 90, 120].map((d) => <option key={d} value={d}>{d} min</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Política de Cancelamento</label>
          <select
            {...register("politicaCancelamento")}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="24h">24 horas antes</option>
            <option value="48h">48 horas antes</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">Antecedência mínima para remarcação/cancelamento sem cobrança</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Telefone (WhatsApp)</label>
          <input
            type="tel"
            {...register("telefone")}
            placeholder="(00) 00000-0000"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar Configurações
      </button>
    </form>
  );
}

// ─── Aba Notificações ─────────────────────────────────────────────────────────
function AbaNotificacoes({ perfil, userId, onUpdate }: { perfil: UserFirestore; userId: string; onUpdate: (u: UserFirestore) => void }) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit } = useForm<NotificacoesData>({
    resolver: zodResolver(notificacoesSchema),
    defaultValues: {
      notificacaoEmail:    perfil.notificacaoEmail,
      notificacaoWhatsapp: perfil.notificacaoWhatsapp,
    },
  });

  const onSubmit = async (data: NotificacoesData) => {
    setLoading(true);
    try {
      await atualizarPerfil(userId, data);
      const atualizado = await buscarUsuario(userId);
      if (atualizado) onUpdate(atualizado);
      toast.success("Preferências de notificação atualizadas!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
          <input type="checkbox" {...register("notificacaoEmail")} className="w-5 h-5 text-primary-500" />
          <div>
            <p className="font-medium text-slate-800">Notificações por Email</p>
            <p className="text-sm text-slate-500">Receba lembretes e confirmações de agendamento por email</p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
          <input type="checkbox" {...register("notificacaoWhatsapp")} className="w-5 h-5 text-primary-500" />
          <div>
            <p className="font-medium text-slate-800">Notificações por WhatsApp</p>
            <p className="text-sm text-slate-500">Receba lembretes e confirmações via WhatsApp (requer integração)</p>
          </div>
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar Preferências
      </button>
    </form>
  );
}

// ─── Aba Segurança ────────────────────────────────────────────────────────────
function AbaSeguranca({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showModalExclusao, setShowModalExclusao] = useState(false);
  const [textoConfirmacao, setTextoConfirmacao] = useState("");
  const { register, handleSubmit, formState: { errors }, reset } = useForm<SenhaData>({
    resolver: zodResolver(senhaSchema),
  });

  const onAlterarSenha = async (data: SenhaData) => {
    setLoading(true);
    try {
      if (!auth.currentUser?.email) throw new Error("Usuário não autenticado");
      
      // Reautenticar
      const credential = EmailAuthProvider.credential(auth.currentUser.email, data.senhaAtual);
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Atualizar senha
      await updatePassword(auth.currentUser, data.novaSenha);
      toast.success("Senha alterada com sucesso!");
      reset();
    } catch (err: unknown) {
      console.error(err);
      const error = err as { code?: string };
      if (error.code === "auth/wrong-password") {
        toast.error("Senha atual incorreta");
      } else {
        toast.error("Erro ao alterar senha");
      }
    } finally {
      setLoading(false);
    }
  };

  const onExportarDados = async () => {
    setLoading(true);
    try {
      const dados = await exportarDadosLGPD(userId);
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dados-lgpd-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Dados exportados com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao exportar dados");
    } finally {
      setLoading(false);
    }
  };

  const onExcluirConta = async () => {
    if (textoConfirmacao !== "EXCLUIR") {
      toast.error("Digite 'EXCLUIR' no campo de confirmação");
      return;
    }
    
    setLoading(true);
    try {
      toast.error("Funcionalidade em desenvolvimento. Entre em contato com o suporte para exclusão de conta.");
      setShowModalExclusao(false);
      setTextoConfirmacao("");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Alterar Senha */}
      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Alterar Senha</h3>
        <form onSubmit={handleSubmit(onAlterarSenha)} className="space-y-4 max-w-md">
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Senha Atual</label>
            <input
              type={showPassword ? "text" : "password"}
              {...register("senhaAtual")}
              className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-9 text-slate-400"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            {errors.senhaAtual && <p className="text-xs text-red-600 mt-1">{errors.senhaAtual.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha</label>
            <input
              type={showPassword ? "text" : "password"}
              {...register("novaSenha")}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            {errors.novaSenha && <p className="text-xs text-red-600 mt-1">{errors.novaSenha.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Nova Senha</label>
            <input
              type={showPassword ? "text" : "password"}
              {...register("confirmacao")}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            {errors.confirmacao && <p className="text-xs text-red-600 mt-1">{errors.confirmacao.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Alterar Senha
          </button>
        </form>
      </div>

      <hr className="border-slate-200" />

      {/* Exportar Dados LGPD */}
      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Exportar Dados (LGPD)</h3>
        <p className="text-sm text-slate-500 mb-4">
          Baixe uma cópia completa de todos os seus dados armazenados na plataforma.
        </p>
        <button
          onClick={onExportarDados}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Exportar Dados (JSON)
        </button>
      </div>

      <hr className="border-slate-200" />

      {/* Excluir Conta */}
      <div>
        <h3 className="text-lg font-semibold text-red-600 mb-2">Zona de Perigo</h3>
        <p className="text-sm text-slate-500 mb-4">
          A exclusão da conta é permanente e irreversível. Todos os dados serão deletados.
        </p>
        <button
          onClick={() => setShowModalExclusao(true)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          Excluir Conta Permanentemente
        </button>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {showModalExclusao && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Excluir Conta Permanentemente</h3>
              </div>
              <button
                onClick={() => {
                  setShowModalExclusao(false);
                  setTextoConfirmacao("");
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 font-medium mb-2">⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!</p>
                <p className="text-sm text-red-700">
                  Todos os seus dados serão permanentemente deletados, incluindo:
                </p>
                <ul className="text-sm text-red-700 list-disc list-inside mt-2 space-y-1">
                  <li>Informações do perfil profissional</li>
                  <li>Lista de pacientes e suas observações</li>
                  <li>Histórico de agendamentos</li>
                  <li>Logs de auditoria</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Para confirmar, digite <span className="font-bold text-red-600">EXCLUIR</span> no campo abaixo:
                </label>
                <input
                  type="text"
                  value={textoConfirmacao}
                  onChange={(e) => setTextoConfirmacao(e.target.value)}
                  placeholder="Digite EXCLUIR"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowModalExclusao(false);
                  setTextoConfirmacao("");
                }}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={onExcluirConta}
                disabled={loading || textoConfirmacao !== "EXCLUIR"}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Excluir Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
