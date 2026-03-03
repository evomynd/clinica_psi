"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Loader2, Plus, Trash2 } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  buscarTarefasPorUsuario,
  criarTarefa,
  atualizarTarefa,
  deleteDoc,
  doc,
} from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firebase/collections";
import { db } from "@/lib/firebase/config";
import type { TarefaFirestore } from "@/types/firestore";
import { toast } from "sonner";

export default function TarefasPage() {
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tarefas, setTarefas] = useState<TarefaFirestore[]>([]);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [usarDataHora, setUsarDataHora] = useState(false);
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [saving, setSaving] = useState(false);

  async function carregar() {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const dados = await buscarTarefasPorUsuario(user.uid);
      setTarefas(dados);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar tarefas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const pendentes = useMemo(() => tarefas.filter((t) => t.status === "pendente"), [tarefas]);
  const concluidas = useMemo(() => tarefas.filter((t) => t.status === "concluida"), [tarefas]);

  async function onCriarTarefa(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.uid || !userProfile?.clinicaId) return;
    if (!titulo.trim()) {
      toast.error("Informe o título da tarefa");
      return;
    }

    let dataHora: Timestamp | null = null;
    if (usarDataHora) {
      if (!data || !hora) {
        toast.error("Informe data e hora da tarefa");
        return;
      }
      dataHora = Timestamp.fromDate(new Date(`${data}T${hora}:00`));
    }

    setSaving(true);
    try {
      await criarTarefa({
        userId: user.uid,
        clinicaId: userProfile.clinicaId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        status: "pendente",
        dataHora,
        origem: "manual",
        concluidaEm: null,
      });

      setTitulo("");
      setDescricao("");
      setUsarDataHora(false);
      setData("");
      setHora("");
      await carregar();
      toast.success("Tarefa criada!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar tarefa");
    } finally {
      setSaving(false);
    }
  }

  async function toggleConcluida(tarefa: TarefaFirestore) {
    if (!tarefa.id) return;
    const concluida = tarefa.status === "concluida";
    try {
      await atualizarTarefa(tarefa.id, {
        status: concluida ? "pendente" : "concluida",
        concluidaEm: concluida ? null : Timestamp.now(),
      });
      await carregar();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar tarefa");
    }
  }

  async function excluirTarefa(id?: string) {
    if (!id) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.TAREFAS, id));
      await carregar();
      toast.success("Tarefa excluída");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir tarefa");
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-800">Tarefas</h1>
        <p className="text-slate-500 text-sm mt-1">To-do list com integração ao calendário da agenda</p>
      </div>

      <form onSubmit={onCriarTarefa} className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Título *</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl"
            placeholder="Ex: Devolver valor da sessão de João"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Descrição (opcional)</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl"
            placeholder="Detalhes da tarefa"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={usarDataHora} onChange={(e) => setUsarDataHora(e.target.checked)} />
          Definir data e hora para aparecer no calendário
        </label>

        {usarDataHora && (
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl" />
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl" />
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Criar tarefa
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TaskColumn
          title={`Pendentes (${pendentes.length})`}
          tasks={pendentes}
          onToggle={toggleConcluida}
          onDelete={excluirTarefa}
        />
        <TaskColumn
          title={`Concluídas (${concluidas.length})`}
          tasks={concluidas}
          onToggle={toggleConcluida}
          onDelete={excluirTarefa}
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando tarefas...
        </div>
      )}
    </div>
  );
}

function TaskColumn({
  title,
  tasks,
  onToggle,
  onDelete,
}: {
  title: string;
  tasks: TarefaFirestore[];
  onToggle: (t: TarefaFirestore) => Promise<void>;
  onDelete: (id?: string) => Promise<void>;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">{title}</h2>
      <div className="space-y-2">
        {tasks.length === 0 && <p className="text-xs text-slate-400">Sem tarefas</p>}
        {tasks.map((t) => (
          <div key={t.id} className="border border-slate-100 rounded-xl p-3">
            <div className="flex items-start justify-between gap-2">
              <button onClick={() => onToggle(t)} className="mt-0.5 text-slate-500 hover:text-primary-600">
                {t.status === "concluida" ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4" />}
              </button>
              <div className="flex-1">
                <p className={`text-sm font-medium ${t.status === "concluida" ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.titulo}</p>
                {t.descricao && <p className="text-xs text-slate-500 mt-0.5">{t.descricao}</p>}
                {t.dataHora && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    {t.dataHora.toDate().toLocaleDateString("pt-BR")} às {t.dataHora.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
              <button onClick={() => onDelete(t.id)} className="text-slate-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
