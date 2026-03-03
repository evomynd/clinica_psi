"use client";

import { useState, useEffect, useCallback } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, isToday,
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  format, getDay, setHours, setMinutes, startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgendamentoFirestore, TarefaFirestore } from "@/types/firestore";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type ViewMode = "mes" | "semana" | "dia";

interface CalendarEvent {
  id:            string;
  title:         string;
  start:         Date;
  end:           Date;
  status:        AgendamentoFirestore["status"];
  tipoAtendimento: AgendamentoFirestore["tipoAtendimento"];
  raw:           AgendamentoFirestore;
}

interface AgendaCalendarProps {
  agendamentos:    AgendamentoFirestore[];
  tarefas?:        TarefaFirestore[];
  pacientesMap:    Record<string, string>; // pacienteId → nomeCompleto
  onSlotClick:     (date: Date) => void;
  onEventClick:    (agendamento: AgendamentoFirestore) => void;
  onTaskClick?:    (tarefa: TarefaFirestore) => void;
  viewMode:        ViewMode;
  currentDate:     Date;
}

// ─── Helpers de cores por status ──────────────────────────────────────────────
const TIPO_LABEL: Record<AgendamentoFirestore["tipoAtendimento"], string> = {
  sessao_semanal:     "Sessão Semanal",
  sessao_emergencial: "Sessão Emergencial",
  avaliacao:          "Avaliação",
  introducao_15min:   "Introdução (15min)",
};

const STATUS_COLORS: Record<AgendamentoFirestore["status"], string> = {
  agendado:   "bg-blue-100 text-blue-700 border-blue-200",
  confirmado: "bg-primary-100 text-primary-700 border-primary-200",
  realizado:  "bg-slate-100 text-slate-600 border-slate-200",
  cancelado:  "bg-red-100 text-red-600 border-red-200 line-through",
  remarcado:  "bg-yellow-100 text-yellow-700 border-yellow-200",
};

// ─── Horas do dia para view semana/dia ───────────────────────────────────────
const HORAS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00 - 20:00

// ─── View Mês ─────────────────────────────────────────────────────────────────
function ViewMes({ agendamentos, tarefas = [], pacientesMap, onSlotClick, onEventClick, onTaskClick, currentDate }: AgendaCalendarProps) {
  const inicioMes   = startOfMonth(currentDate);
  const fimMes      = endOfMonth(currentDate);
  const inicioGrid  = startOfWeek(inicioMes, { locale: ptBR });
  const fimGrid     = endOfWeek(fimMes, { locale: ptBR });
  const dias        = eachDayOfInterval({ start: inicioGrid, end: fimGrid });

  const eventsByDay: Record<string, AgendamentoFirestore[]> = {};
  agendamentos.forEach((a) => {
    const d = a.dataHora.toDate();
    const key = format(d, "yyyy-MM-dd");
    if (!eventsByDay[key]) eventsByDay[key] = [];
    eventsByDay[key].push(a);
  });

  const tarefasByDay: Record<string, TarefaFirestore[]> = {};
  tarefas.forEach((t) => {
    if (!t.dataHora) return;
    const d = t.dataHora.toDate();
    const key = format(d, "yyyy-MM-dd");
    if (!tarefasByDay[key]) tarefasByDay[key] = [];
    tarefasByDay[key].push(t);
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Cabeçalho dias da semana */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Grid dos dias */}
      <div className="flex-1 grid grid-cols-7" style={{ gridAutoRows: "1fr" }}>
        {dias.map((dia) => {
          const key     = format(dia, "yyyy-MM-dd");
          const eventos = eventsByDay[key] ?? [];
          const tarefasDia = tarefasByDay[key] ?? [];
          const eMes    = isSameMonth(dia, currentDate);
          const eHoje   = isToday(dia);

          return (
            <div
              key={key}
              onClick={() => onSlotClick(setHours(setMinutes(dia, 0), 9))}
              className={cn(
                "min-h-[80px] p-1.5 border-r border-b border-slate-100 cursor-pointer hover:bg-slate-50/70 transition-colors",
                !eMes && "opacity-40",
              )}
            >
              <span className={cn(
                "inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium mb-1",
                eHoje ? "bg-primary-500 text-white" : "text-slate-600"
              )}>
                {format(dia, "d")}
              </span>
              <div className="space-y-0.5">
                {eventos.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded-md border cursor-pointer truncate",
                      STATUS_COLORS[ev.status]
                    )}
                    title={`${format(ev.dataHora.toDate(), "HH:mm")} — ${pacientesMap[ev.pacienteId] ?? "Paciente"}`}
                  >
                    {format(ev.dataHora.toDate(), "HH:mm")} {pacientesMap[ev.pacienteId]?.split(" ")[0] ?? ""}
                  </div>
                ))}
                {eventos.length > 3 && (
                  <p className="text-xs text-slate-400 pl-1">+{eventos.length - 3} mais</p>
                )}
                {tarefasDia.slice(0, 2).map((tarefa) => (
                  <div
                    key={`tarefa-${tarefa.id}`}
                    onClick={(e) => { e.stopPropagation(); onTaskClick?.(tarefa); }}
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded-md border truncate cursor-pointer",
                      tarefa.status === "concluida"
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-yellow-100 text-yellow-700 border-yellow-200"
                    )}
                    title={tarefa.titulo}
                  >
                    📝 {tarefa.titulo}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── View Semana ──────────────────────────────────────────────────────────────
function ViewSemana({ agendamentos, tarefas = [], pacientesMap, onSlotClick, onEventClick, onTaskClick, currentDate }: AgendaCalendarProps) {
  const inicioSemana = startOfWeek(currentDate, { locale: ptBR });
  const dias         = Array.from({ length: 7 }, (_, i) => addDays(inicioSemana, i));

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[700px]">
        {/* Cabeçalho */}
        <div className="grid sticky top-0 bg-white z-10 border-b border-slate-100" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
          <div className="py-2 text-xs text-slate-400" />
          {dias.map((dia) => (
            <div key={dia.toISOString()} className="py-2 px-2 text-center border-l border-slate-100">
              <div className="text-xs text-slate-400 uppercase tracking-wide">{format(dia, "EEE", { locale: ptBR })}</div>
              <div className={cn(
                "mx-auto w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold mt-0.5",
                isToday(dia) ? "bg-primary-500 text-white" : "text-slate-700"
              )}>
                {format(dia, "d")}
              </div>
            </div>
          ))}
        </div>

        {/* Grade de horas */}
        {HORAS.map((hora) => (
          <div key={hora} className="grid border-b border-slate-50" style={{ gridTemplateColumns: "56px repeat(7, 1fr)", minHeight: "56px" }}>
            <div className="text-xs text-slate-400 pr-2 pt-1.5 text-right leading-none border-r border-slate-100">
              {String(hora).padStart(2, "0")}:00
            </div>
            {dias.map((dia) => {
              const eventos = agendamentos.filter((a) => {
                const d = a.dataHora.toDate();
                return isSameDay(d, dia) && d.getHours() === hora;
              });
              const tarefasSlot = tarefas.filter((t) => {
                const d = t.dataHora?.toDate?.();
                if (!d) return false;
                return isSameDay(d, dia) && d.getHours() === hora;
              });
              return (
                <div
                  key={dia.toISOString()}
                  onClick={() => onSlotClick(setHours(startOfDay(dia), hora))}
                  className="border-l border-slate-50 p-0.5 cursor-pointer hover:bg-slate-50/60 transition-colors relative min-h-[56px]"
                >
                  {eventos.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                      className={cn(
                        "text-xs px-1.5 py-1 rounded-lg border cursor-pointer mb-0.5 truncate",
                        STATUS_COLORS[ev.status]
                      )}
                    >
                      <div className="font-medium">{format(ev.dataHora.toDate(), "HH:mm")}</div>
                      <div className="truncate">{pacientesMap[ev.pacienteId]?.split(" ")[0] ?? "Paciente"}</div>
                    </div>
                  ))}
                  {tarefasSlot.map((t) => (
                    <div
                      key={`tarefa-${t.id}`}
                      onClick={(e) => { e.stopPropagation(); onTaskClick?.(t); }}
                      className={cn(
                        "text-xs px-1.5 py-1 rounded-lg border mb-0.5 truncate cursor-pointer",
                        t.status === "concluida"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-yellow-100 text-yellow-700 border-yellow-200"
                      )}
                    >
                      <div className="font-medium">{format(t.dataHora!.toDate(), "HH:mm")}</div>
                      <div className="truncate">📝 {t.titulo}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── View Dia ─────────────────────────────────────────────────────────────────
function ViewDia({ agendamentos, tarefas = [], pacientesMap, onSlotClick, onEventClick, onTaskClick, currentDate }: AgendaCalendarProps) {
  const eventosHoje = agendamentos.filter((a) => isSameDay(a.dataHora.toDate(), currentDate));
  const tarefasHoje = tarefas.filter((t) => {
    const d = t.dataHora?.toDate?.();
    return !!d && isSameDay(d, currentDate);
  });

  return (
    <div className="flex-1 overflow-auto">
      <div className="border-b border-slate-100 px-4 py-3 sticky top-0 bg-white z-10">
        <p className="font-semibold text-slate-800">
          {format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
        </p>
        <p className="text-xs text-slate-400">{eventosHoje.length} sessão(ões)</p>
      </div>

      <div className="min-w-[320px]">
        {HORAS.map((hora) => {
          const eventos = eventosHoje.filter((a) => a.dataHora.toDate().getHours() === hora);
          const tarefasSlot = tarefasHoje.filter((t) => t.dataHora?.toDate?.().getHours() === hora);
          return (
            <div
              key={hora}
              className="flex border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer transition-colors"
              onClick={() => onSlotClick(setHours(startOfDay(currentDate), hora))}
              style={{ minHeight: "64px" }}
            >
              <div className="w-16 text-right pr-3 pt-2 text-xs text-slate-400 flex-shrink-0">
                {String(hora).padStart(2, "0")}:00
              </div>
              <div className="flex-1 p-1 space-y-1">
                {eventos.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                    className={cn(
                      "px-3 py-2 rounded-xl border cursor-pointer",
                      STATUS_COLORS[ev.status]
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{format(ev.dataHora.toDate(), "HH:mm")}</span>
                      <span className="text-sm">{pacientesMap[ev.pacienteId] ?? "Paciente"}</span>
                    </div>
                    <div className="text-xs opacity-70 mt-0.5">{ev.duracaoMinutos} min · {TIPO_LABEL[ev.tipoAtendimento] ?? ev.tipoAtendimento}</div>
                  </div>
                ))}
                {tarefasSlot.map((t) => (
                  <div
                    key={`tarefa-${t.id}`}
                    onClick={(e) => { e.stopPropagation(); onTaskClick?.(t); }}
                    className={cn(
                      "px-3 py-2 rounded-xl border cursor-pointer",
                      t.status === "concluida"
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-yellow-100 text-yellow-700 border-yellow-200"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{format(t.dataHora!.toDate(), "HH:mm")}</span>
                      <span className="text-sm">📝 {t.titulo}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Componente principal AgendaCalendar ─────────────────────────────────────
export function AgendaCalendar({ agendamentos, tarefas = [], pacientesMap, onSlotClick, onEventClick, onTaskClick, viewMode, currentDate }: AgendaCalendarProps) {
  return (
    <div className="flex flex-col h-full">
      {viewMode === "mes"    && <ViewMes     {...{ agendamentos, tarefas, pacientesMap, onSlotClick, onEventClick, onTaskClick, viewMode, currentDate }} />}
      {viewMode === "semana" && <ViewSemana  {...{ agendamentos, tarefas, pacientesMap, onSlotClick, onEventClick, onTaskClick, viewMode, currentDate }} />}
      {viewMode === "dia"    && <ViewDia     {...{ agendamentos, tarefas, pacientesMap, onSlotClick, onEventClick, onTaskClick, viewMode, currentDate }} />}
    </div>
  );
}
