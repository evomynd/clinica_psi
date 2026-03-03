"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, User, Phone, Mail, MapPin, Calendar, Edit2,
  FileText, Plus, Trash2, Loader2, Lock, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  buscarObservacoesDoPaciente,
  criarObservacao,
  atualizarObservacao,
  deletarObservacao,
  Timestamp,
} from "@/lib/firebase/firestore";
import { encryptText, decryptText } from "@/lib/encryption";
import { useAuth } from "@/lib/hooks/useAuth";
import { formatDate, calcularIdade, maskPhone, cn } from "@/lib/utils";
import type { PacienteFirestore, ObservacaoPacienteFirestore } from "@/types/firestore";

interface PacienteDetalhePanelProps {
  paciente:   PacienteFirestore;
  onClose:    () => void;
  onEditClick:() => void;
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
export function PacienteDetalhePanel({ paciente, onClose, onEditClick }: PacienteDetalhePanelProps) {
  const nascimento = paciente.dataNascimento?.toDate?.() ?? null;
  const idade      = nascimento ? calcularIdade(nascimento) : null;

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
            <div className="flex items-center gap-2 text-sm">
              <FileText className={cn("w-4 h-4 flex-shrink-0", paciente.contratoAssinado ? "text-green-500" : "text-amber-400")} />
              <span className={paciente.contratoAssinado ? "text-green-700" : "text-amber-600"}>
                Contrato: {paciente.contratoAssinado ? "Assinado" : "Pendente"}
              </span>
            </div>
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
    </div>
  );
}
