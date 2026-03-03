"use client";

import { useState, useEffect } from "react";
import { X, Clock, Save, Loader2, Check } from "lucide-react";
import { salvarDisponibilidades, subscribeDisponibilidades } from "@/lib/firebase/firestore";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { DisponibilidadeFirestore } from "@/types/firestore";
import { toast } from "sonner";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface DiaConfig {
  ativo:         boolean;
  horaInicio:    string;
  horaFim:       string;
  intervaloCom:  number;
}

type SemanaDias = Record<0 | 1 | 2 | 3 | 4 | 5 | 6, DiaConfig>;

const DIAS_SEMANA: { key: 0 | 1 | 2 | 3 | 4 | 5 | 6; label: string; abrev: string }[] = [
  { key: 0, label: "Domingo",       abrev: "Dom" },
  { key: 1, label: "Segunda-feira", abrev: "Seg" },
  { key: 2, label: "Terça-feira",   abrev: "Ter" },
  { key: 3, label: "Quarta-feira",  abrev: "Qua" },
  { key: 4, label: "Quinta-feira",  abrev: "Qui" },
  { key: 5, label: "Sexta-feira",   abrev: "Sex" },
  { key: 6, label: "Sábado",        abrev: "Sáb" },
];

const INTERVALOS = [
  { value: 10,  label: "10 min" },
  { value: 15,  label: "15 min" },
  { value: 20,  label: "20 min" },
  { value: 30,  label: "30 min" },
  { value: 60,  label: "1 hora" },
];

const DEFAULT_DIA: DiaConfig = { ativo: false, horaInicio: "08:00", horaFim: "18:00", intervaloCom: 10 };

function semanaVazia(): SemanaDias {
  return {
    0: { ...DEFAULT_DIA },
    1: { ...DEFAULT_DIA, ativo: true },
    2: { ...DEFAULT_DIA, ativo: true },
    3: { ...DEFAULT_DIA, ativo: true },
    4: { ...DEFAULT_DIA, ativo: true },
    5: { ...DEFAULT_DIA, ativo: true },
    6: { ...DEFAULT_DIA },
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface DisponibilidadeModalProps {
  open:     boolean;
  onClose:  () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function DisponibilidadeModal({ open, onClose }: DisponibilidadeModalProps) {
  const { user, userProfile } = useAuth();
  const [semana,   setSemana]   = useState<SemanaDias>(semanaVazia());
  const [loading,  setLoading]  = useState(false);
  const [carregando, setCarregando] = useState(false);

  // Carrega disponibilidades existentes do Firestore
  useEffect(() => {
    if (!open || !user) return;
    setCarregando(true);
    const unsub = subscribeDisponibilidades(user.uid, (slots) => {
      if (slots.length > 0) {
        const nova = semanaVazia();
        slots.forEach((s) => {
          nova[s.diaSemana] = {
            ativo:        true,
            horaInicio:   s.horaInicio,
            horaFim:      s.horaFim,
            intervaloCom: s.intervaloCom,
          };
        });
        setSemana(nova);
      }
      setCarregando(false);
    });
    return unsub;
  }, [open, user]);

  function toggleDia(dia: 0 | 1 | 2 | 3 | 4 | 5 | 6) {
    setSemana((prev) => ({
      ...prev,
      [dia]: { ...prev[dia], ativo: !prev[dia].ativo },
    }));
  }

  function updateDia(dia: 0 | 1 | 2 | 3 | 4 | 5 | 6, field: keyof DiaConfig, value: string | number | boolean) {
    setSemana((prev) => ({
      ...prev,
      [dia]: { ...prev[dia], [field]: value },
    }));
  }

  async function handleSalvar() {
    if (!user || !userProfile) return;
    setLoading(true);
    try {
      const slots = (Object.entries(semana) as [string, DiaConfig][])
        .filter(([, cfg]) => cfg.ativo)
        .map(([dia, cfg]) => ({
          diaSemana:    Number(dia) as DisponibilidadeFirestore["diaSemana"],
          horaInicio:   cfg.horaInicio,
          horaFim:      cfg.horaFim,
          intervaloCom: cfg.intervaloCom,
        }));

      await salvarDisponibilidades(user.uid, userProfile.clinicaId, slots);
      toast.success("Disponibilidade salva com sucesso!");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar disponibilidade.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-secondary-600" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-slate-800 text-lg">Disponibilidade</h2>
              <p className="text-xs text-slate-500">Configure seus horários de atendimento</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {carregando ? (
            <div className="flex items-center justify-center py-12 gap-3 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Carregando disponibilidade...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Cabeçalho das colunas */}
              <div className="grid grid-cols-[140px_1fr_1fr_1fr] gap-2 px-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Dia</span>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Início</span>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Fim</span>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Intervalo</span>
              </div>

              {DIAS_SEMANA.map(({ key, label }) => {
                const cfg = semana[key];
                return (
                  <div
                    key={key}
                    className={cn(
                      "grid grid-cols-[140px_1fr_1fr_1fr] gap-2 items-center p-3 rounded-xl border transition-colors",
                      cfg.ativo
                        ? "border-primary-200 bg-primary-50/50"
                        : "border-slate-100 bg-slate-50/50 opacity-60"
                    )}
                  >
                    {/* Toggle do dia */}
                    <button
                      type="button"
                      onClick={() => toggleDia(key)}
                      className="flex items-center gap-2 text-sm font-medium text-left"
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors flex-shrink-0",
                        cfg.ativo
                          ? "border-primary-500 bg-primary-500"
                          : "border-slate-300 bg-white"
                      )}>
                        {cfg.ativo && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className={cn(cfg.ativo ? "text-slate-800" : "text-slate-400")}>{label}</span>
                    </button>

                    {/* Hora início */}
                    <input
                      type="time"
                      value={cfg.horaInicio}
                      disabled={!cfg.ativo}
                      onChange={(e) => updateDia(key, "horaInicio", e.target.value)}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-40 disabled:cursor-not-allowed"
                    />

                    {/* Hora fim */}
                    <input
                      type="time"
                      value={cfg.horaFim}
                      disabled={!cfg.ativo}
                      onChange={(e) => updateDia(key, "horaFim", e.target.value)}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-40 disabled:cursor-not-allowed"
                    />

                    {/* Intervalo */}
                    <select
                      value={cfg.intervaloCom}
                      disabled={!cfg.ativo}
                      onChange={(e) => updateDia(key, "intervaloCom", Number(e.target.value))}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {INTERVALOS.map((i) => (
                        <option key={i.value} value={i.value}>{i.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 pt-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={loading || carregando}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
              : <><Save className="w-4 h-4" /> Salvar Disponibilidade</>}
          </button>
        </div>
      </div>
    </div>
  );
}
