import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/config";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface NotificacaoPayload {
  agendamentoId:  string;
  pacienteNome:   string;
  pacienteEmail:  string;
  pacienteTelefone?: string;
  dataHora:       string;   // ISO string
  tipoNotificacao: "lembrete_24h" | "lembrete_1h" | "confirmacao" | "cancelamento";
  canal:          "email" | "whatsapp" | "ambos";
}

// ─── POST /api/agenda/notificar ───────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as NotificacaoPayload;

    // Validação mínima
    if (!body.agendamentoId || !body.pacienteEmail || !body.tipoNotificacao) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
    }

    // ── Aqui seria integrado com serviço externo (SendGrid / Twilio) ─────────
    // Por ora: apenas loga no Firestore para auditoria.
    await addDoc(collection(db, "notificacoesEnviadas"), {
      ...body,
      status:    "pendente",       // será atualizado pelo worker ao enviar
      tentativas: 0,
      criadoEm:  serverTimestamp(),
    });

    // ── Template básico para simular envio ───────────────────────────────────
    const dataFormatada = new Date(body.dataHora).toLocaleString("pt-BR", {
      dateStyle: "full",
      timeStyle: "short",
    });

    const mensagem = body.tipoNotificacao === "lembrete_24h"
      ? `Lembrete: sua sessão está marcada para ${dataFormatada}. Acesse o link enviado para entrar na sala.`
      : body.tipoNotificacao === "confirmacao"
      ? `Sua sessão foi confirmada para ${dataFormatada}. Aguardamos você!`
      : body.tipoNotificacao === "cancelamento"
      ? `Sua sessão foi cancelada. Entre em contato para reagendar.`
      : `Sua sessão começa em 1 hora (${dataFormatada}). Prepare-se!`;

    return NextResponse.json({
      success: true,
      mensagem,
      agendamentoId: body.agendamentoId,
      canal: body.canal,
    });
  } catch (error) {
    console.error("[API/notificar]", error);
    return NextResponse.json({ error: "Erro interno ao processar notificação." }, { status: 500 });
  }
}

// ─── GET — healthcheck ────────────────────────────────────────────────────────
export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "/api/agenda/notificar" });
}
