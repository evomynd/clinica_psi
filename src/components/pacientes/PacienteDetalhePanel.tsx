"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, User, Phone, Mail, MapPin, Calendar, Edit2,
  FileText, Plus, Trash2, Loader2, Lock, ChevronDown, ChevronUp, Copy, ExternalLink, Download, AlertTriangle,
} from "lucide-react";
import {
  buscarObservacoesDoPaciente,
  criarObservacao,
  atualizarObservacao,
  deletarObservacao,
  deletarPaciente,
  Timestamp,
} from "@/lib/firebase/firestore";
import { encryptText, decryptText } from "@/lib/encryption";
import { useAuth } from "@/lib/hooks/useAuth";
import { formatDate, calcularIdade, maskPhone, cn } from "@/lib/utils";
import type { PacienteFirestore, ObservacaoPacienteFirestore } from "@/types/firestore";
import { toast } from "sonner";

interface PacienteDetalhePanelProps {
  paciente:   PacienteFirestore;
  onClose:    () => void;
  onEditClick:() => void;
  onPacienteUpdated?: () => Promise<void> | void;
}

// ─── Sub: Observações ─────────────────────────────────────────────────────────
function ObservacoesSection({ paciente }: { paciente: PacienteFirestore }) {
  const { user } = useAuth();
  const [observacoes,    setObservacoes]    = useState<ObservacaoPacienteFirestore[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [novoTexto,      setNovoTexto]      = useState("");
  const [salvando,       setSalvando]       = useState(false);
  const [editandoId,     setEditandoId]     = useState<string | null>(null);
  const [editTexto,      setEditTexto]      = useState("");
  const [expandidos,     setExpandidos]     = useState<Set<string>>(new Set());

  const decriptarObs = useCallback((obs: ObservacaoPacienteFirestore): string => {
    if (!user || !obs.isEncrypted) return obs.conteudoCriptografado;
    try {
      return decryptText(obs.conteudoCriptografado, obs.conteudoIV, user.uid);
    } catch {
      return "[Erro ao descriptografar]";
    }
  }, [user]);

  const carregar = useCallback(async () => {
    if (!user || !paciente.id) return;
    setLoading(true);
    try {
      const dados = await buscarObservacoesDoPaciente(paciente.id, user.uid);
      setObservacoes(dados);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user, paciente.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarNova() {
    if (!user || !novoTexto.trim() || !paciente.id) return;
    setSalvando(true);
    try {
      const { ciphertext, iv } = encryptText(novoTexto.trim(), user.uid);
      await criarObservacao({
        pacienteId:           paciente.id,
        userId:               user.uid,
        clinicaId:            paciente.clinicaId,
        conteudoCriptografado: ciphertext,
        conteudoIV:           iv,
        isEncrypted:          true,
        dataObservacao:       Timestamp.now(),
        acessosPor:           [],
      });
      setNovoTexto("");
      await carregar();
    } catch {
      // silent
    } finally {
      setSalvando(false);
    }
  }

  async function salvarEdicao(id: string) {
    if (!user || !editTexto.trim()) return;
    setSalvando(true);
    try {
      const { ciphertext, iv } = encryptText(editTexto.trim(), user.uid);
      await atualizarObservacao(id, {
        conteudoCriptografado: ciphertext,
        conteudoIV:           iv,
        isEncrypted:          true,
      });
      setEditandoId(null);
      await carregar();
    } catch {
      // silent
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta observação?")) return;
    await deletarObservacao(id);
    await carregar();
  }

  function iniciarEdicao(obs: ObservacaoPacienteFirestore) {
    if (!obs.id) return;
    setEditandoId(obs.id);
    setEditTexto(decriptarObs(obs));
  }

  function toggleExpandir(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {/* Nova observação */}
      <div className="space-y-2">
        <textarea
          value={novoTexto}
          onChange={(e) => setNovoTexto(e.target.value)}
          placeholder="Adicionar observação sobre o paciente..."
          rows={3}
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
        />
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Lock className="w-3 h-3" /> Criptografada
          </span>
          <button
            onClick={salvarNova}
            disabled={!novoTexto.trim() || salvando}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Salvar
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        </div>
      ) : observacoes.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">Nenhuma observação registrada</p>
      ) : (
        <div className="space-y-2">
          {observacoes.map((obs) => {
            if (!obs.id) return null;
            const texto     = decriptarObs(obs);
            const expandido = expandidos.has(obs.id);
            const longo     = texto.length > 120;
            const dataObs   = obs.dataObservacao?.toDate?.() ?? new Date();

            return (
              <div key={obs.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                {editandoId === obs.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editTexto}
                      onChange={(e) => setEditTexto(e.target.value)}
                      rows={3}
                      autoFocus
                      className="w-full text-sm px-2 py-1.5 border border-primary-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditandoId(null)}
                        className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => salvarEdicao(obs.id!)}
                        disabled={salvando}
                        className="px-3 py-1 text-xs font-semibold bg-primary-500 text-white rounded-lg disabled:opacity-50"
                      >
                        {salvando ? "Salvando..." : "Salvar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className={cn("text-sm text-slate-700 whitespace-pre-wrap", !expandido && longo && "line-clamp-3")}>
                      {texto}
                    </p>
                    {longo && (
                      <button
                        onClick={() => toggleExpandir(obs.id!)}
                        className="flex items-center gap-0.5 text-xs text-primary-500 mt-1"
                      >
                        {expandido ? <><ChevronUp className="w-3 h-3" /> Menos</> : <><ChevronDown className="w-3 h-3" /> Mais</>}
                      </button>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-400">
                        {dataObs.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => iniciarEdicao(obs)}
                          className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-primary-500 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => excluir(obs.id!)}
                          className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Painel Principal ─────────────────────────────────────────────────────────
export function PacienteDetalhePanel({ paciente, onClose, onEditClick, onPacienteUpdated }: PacienteDetalhePanelProps) {
  const { user } = useAuth();
  const nascimento = paciente.dataNascimento?.toDate?.() ?? null;
  const idade      = nascimento ? calcularIdade(nascimento) : null;
  const [gerandoTCLE, setGerandoTCLE] = useState(false);
  const [linkTCLE, setLinkTCLE] = useState<string | null>(paciente.tcleUrl ?? null);
  const [gerandoContrato, setGerandoContrato] = useState(false);
  const [linkContrato, setLinkContrato] = useState<string | null>(paciente.contratoUrl ?? null);
  const [modalDelete, setModalDelete] = useState(false);
  const [downloadsTCLE, setDownloadsTCLE] = useState(false);
  const [downloadsContrato, setDownloadsContrato] = useState(false);
  const [downloadsObservacoes, setDownloadsObservacoes] = useState(false);
  const [deletando, setDeletando] = useState(false);

  useEffect(() => {
    setLinkTCLE(paciente.tcleUrl ?? null);
    setLinkContrato(paciente.contratoUrl ?? null);
  }, [paciente.id, paciente.tcleUrl, paciente.contratoUrl]);

  async function gerarLinkTCLE() {
    if (!paciente.id) return;
    setGerandoTCLE(true);
    try {
      const response = await fetch("/api/tcle/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pacienteId: paciente.id }),
      });

      const body = await response.json();

      if (!response.ok) {
        toast.error(body?.error ?? "Não foi possível gerar o TCLE.");
        return;
      }

      const novoLink = body?.linkAssinatura as string;
      setLinkTCLE(novoLink);
      await navigator.clipboard.writeText(novoLink);
      toast.success("Link do TCLE gerado e copiado.");
      await onPacienteUpdated?.();
    } catch {
      toast.error("Erro ao gerar link do TCLE.");
    } finally {
      setGerandoTCLE(false);
    }
  }

  async function copiarLinkTCLE() {
    if (!linkTCLE) return;
    await navigator.clipboard.writeText(linkTCLE);
    toast.success("Link do TCLE copiado.");
  }

  async function gerarLinkContrato() {
    if (!paciente.id) return;
    setGerandoContrato(true);
    try {
      const response = await fetch("/api/contrato/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pacienteId: paciente.id }),
      });

      const body = await response.json();

      if (!response.ok) {
        toast.error(body?.error ?? "Não foi possível gerar o contrato.");
        return;
      }

      const novoLink = body?.linkAssinatura as string;
      setLinkContrato(novoLink);
      await navigator.clipboard.writeText(novoLink);
      toast.success("Link do contrato gerado e copiado.");
      await onPacienteUpdated?.();
    } catch {
      toast.error("Erro ao gerar link do contrato.");
    } finally {
      setGerandoContrato(false);
    }
  }

  async function copiarLinkContrato() {
    if (!linkContrato) return;
    await navigator.clipboard.writeText(linkContrato);
    toast.success("Link do contrato copiado.");
  }

  async function baixarObservacoes() {
    if (!paciente.id || !user) return;
    try {
      const response = await fetch(`/api/pacientes/observacoes-export?pacienteId=${paciente.id}&userId=${user.uid}`);
      if (!response.ok) {
        toast.error("Erro ao exportar observações.");
        return;
      }

      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `observacoes-${paciente.nomeCompleto.replace(/\s+/g, "_")}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setDownloadsObservacoes(true);
      toast.success("Observações exportadas.");
    } catch {
      toast.error("Erro ao baixar observações.");
    }
  }

  async function confirmarDelecao() {
    if (!paciente.id) return;

    // Validar apenas os downloads obrigatórios (documentos que existem)
    const temTCLE = paciente.consentimentoTCLE?.assinado && linkTCLE;
    const temContrato = paciente.contratoAssinado && linkContrato;
    
    if (temTCLE && !downloadsTCLE) {
      toast.error("Você precisa baixar o TCLE antes de deletar o paciente.");
      return;
    }
    
    if (temContrato && !downloadsContrato) {
      toast.error("Você precisa baixar o Contrato antes de deletar o paciente.");
      return;
    }
    
    if (!downloadsObservacoes) {
      toast.error("Você precisa baixar as Observações antes de deletar o paciente.");
      return;
    }

    setDeletando(true);
    try {
      await deletarPaciente(paciente.id);
      toast.success("Paciente deletado permanentemente.");
      setModalDelete(false);
      onClose();
      await onPacienteUpdated?.();
    } catch (error) {
      console.error("Erro ao deletar paciente:", error);
      toast.error(`Erro ao deletar paciente: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setDeletando(false);
    }
  }

  function iniciarDelecao() {
    if (paciente.ativo) {
      toast.error("Você só pode deletar pacientes inativos.");
      return;
    }
    
    // Verifica se há documentos para baixar
    const temTCLE = paciente.consentimentoTCLE?.assinado && linkTCLE;
    const temContrato = paciente.contratoAssinado && linkContrato;
    
    setModalDelete(true);
    setDownloadsTCLE(!temTCLE); // Se não tem TCLE, marca como "baixado"
    setDownloadsContrato(!temContrato); // Se não tem contrato, marca como "baixado"
    setDownloadsObservacoes(false);
  }

  return (
    <div className="w-80 flex-shrink-0 border-l border-slate-100 bg-white flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold text-slate-800 text-sm">Detalhes do Paciente</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onEditClick}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary-500 transition-colors"
            title="Editar paciente"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body com scroll */}
      <div className="flex-1 overflow-y-auto">
        {/* Avatar + Nome */}
        <div className="px-5 py-5 border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">{paciente.nomeCompleto}</p>
              {idade !== null && (
                <p className="text-xs text-slate-400 mt-0.5">{idade} anos · {nascimento ? formatDate(nascimento) : ""}</p>
              )}
              <span className={cn(
                "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full mt-1",
                paciente.ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
              )}>
                {paciente.ativo ? "Ativo" : "Inativo"}
              </span>
            </div>
          </div>
        </div>

        {/* Dados de contato */}
        <div className="px-5 py-4 border-b border-slate-50 space-y-2.5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Contato</p>
          {paciente.email && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="truncate">{paciente.email}</span>
            </div>
          )}
          {paciente.telefone && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>{maskPhone(paciente.telefone)}</span>
            </div>
          )}
        </div>

        {/* Endereço */}
        {paciente.endereco?.cidade && (
          <div className="px-5 py-4 border-b border-slate-50 space-y-1.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Endereço</p>
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <span>
                {[
                  paciente.endereco.logradouro,
                  paciente.endereco.numero,
                  paciente.endereco.bairro,
                  `${paciente.endereco.cidade}/${paciente.endereco.estado}`,
                ].filter(Boolean).join(", ")}
              </span>
            </div>
          </div>
        )}

        {/* TCLE / Contrato */}
        <div className="px-5 py-4 border-b border-slate-50 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Documentos</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className={cn("w-4 h-4 flex-shrink-0", paciente.consentimentoTCLE?.assinado ? "text-green-500" : "text-amber-400")} />
              <span className={paciente.consentimentoTCLE?.assinado ? "text-green-700" : "text-amber-600"}>
                TCLE: {paciente.consentimentoTCLE?.assinado ? "Assinado" : "Pendente"}
              </span>
            </div>

            {!paciente.consentimentoTCLE?.assinado && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={gerarLinkTCLE}
                  disabled={gerandoTCLE}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-50 text-primary-700 text-xs font-semibold hover:bg-primary-100 disabled:opacity-60"
                >
                  {gerandoTCLE ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  Gerar link TCLE
                </button>

                {linkTCLE && (
                  <>
                    <button
                      type="button"
                      onClick={copiarLinkTCLE}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copiar link
                    </button>
                    <a
                      href={linkTCLE}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir
                    </a>
                  </>
                )}
              </div>
            )}

            {paciente.consentimentoTCLE?.assinado && linkTCLE && (
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={linkTCLE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Visualizar / Baixar PDF
                </a>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm">
              <FileText className={cn("w-4 h-4 flex-shrink-0", paciente.contratoAssinado ? "text-green-500" : "text-amber-400")} />
              <span className={paciente.contratoAssinado ? "text-green-700" : "text-amber-600"}>
                Contrato: {paciente.contratoAssinado ? "Assinado" : "Pendente"}
              </span>
            </div>

            {!paciente.contratoAssinado && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={gerarLinkContrato}
                  disabled={gerandoContrato}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-50 text-primary-700 text-xs font-semibold hover:bg-primary-100 disabled:opacity-60"
                >
                  {gerandoContrato ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  Gerar link Contrato
                </button>

                {linkContrato && (
                  <>
                    <button
                      type="button"
                      onClick={copiarLinkContrato}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copiar link
                    </button>
                    <a
                      href={linkContrato}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir
                    </a>
                  </>
                )}
              </div>
            )}

            {paciente.contratoAssinado && linkContrato && (
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={linkContrato}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Visualizar / Baixar PDF
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Observações */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Observações Privadas</p>
          </div>
          <ObservacoesSection paciente={paciente} />
        </div>
      </div>

      {/* Botão deletar (footer fixo) */}
      {!paciente.ativo && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
          <button
            onClick={iniciarDelecao}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Deletar Paciente Permanentemente
          </button>
        </div>
      )}

      {/* Modal de confirmação de deleção */}
      {modalDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalDelete(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold text-slate-800">Deletar Paciente</h3>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600">
                Esta ação é <strong>irreversível</strong>. Você deve baixar todos os documentos disponíveis antes de prosseguir.
              </p>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Downloads Obrigatórios</p>
                
                {paciente.consentimentoTCLE?.assinado && linkTCLE && (
                  <label className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={downloadsTCLE}
                      onChange={(e) => setDownloadsTCLE(e.target.checked)}
                      className="flex-shrink-0"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">TCLE Assinado</p>
                      <a
                        href={linkTCLE}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setDownloadsTCLE(true)}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        Abrir para baixar
                      </a>
                    </div>
                  </label>
                )}

                {paciente.contratoAssinado && linkContrato && (
                  <label className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={downloadsContrato}
                      onChange={(e) => setDownloadsContrato(e.target.checked)}
                      className="flex-shrink-0"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">Contrato Assinado</p>
                      <a
                        href={linkContrato}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setDownloadsContrato(true)}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        Abrir para baixar
                      </a>
                    </div>
                  </label>
                )}

                <label className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={downloadsObservacoes}
                    onChange={(e) => setDownloadsObservacoes(e.target.checked)}
                    className="flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">Observações (se houver)</p>
                    <button
                      type="button"
                      onClick={baixarObservacoes}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      Clique para exportar JSON
                    </button>
                  </div>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => setModalDelete(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarDelecao}
                disabled={!downloadsTCLE || !downloadsContrato || !downloadsObservacoes || deletando}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deletando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
