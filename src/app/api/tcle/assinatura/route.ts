import { NextRequest, NextResponse } from "next/server";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { PacienteFirestore, UserFirestore } from "@/types/firestore";

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "desconhecido";
  }
  return request.headers.get("x-real-ip") || "desconhecido";
}

async function buscarPacientePorToken(token: string): Promise<{ id: string; data: PacienteFirestore } | null> {
  const q = query(
    collection(db, COLLECTIONS.PACIENTES),
    where("tcleToken", "==", token),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const d = snap.docs[0];
  return {
    id: d.id,
    data: { id: d.id, ...d.data() } as PacienteFirestore,
  };
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")?.trim();

    if (!token) {
      return NextResponse.json({ error: "Token é obrigatório." }, { status: 400 });
    }

    const pacienteDoc = await buscarPacientePorToken(token);
    if (!pacienteDoc) {
      return NextResponse.json({ error: "Token inválido." }, { status: 404 });
    }

    const { data: paciente } = pacienteDoc;

    const expiraEm = paciente.tcleTokenExpiraEm?.toDate?.() ?? null;
    if (expiraEm && expiraEm.getTime() < Date.now()) {
      return NextResponse.json({ error: "Link expirado." }, { status: 410 });
    }

    const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, paciente.userId));
    const profissional = userSnap.exists() ? (userSnap.data() as UserFirestore) : null;

    return NextResponse.json({
      success: true,
      pacienteNome: paciente.nomeCompleto,
      terapeutaNome: profissional?.displayName ?? "Profissional responsável",
      terapeutaCrp: profissional?.crp ? `${profissional?.crpUF ?? ""}/${profissional.crp}` : null,
      versao: paciente.consentimentoTCLE?.versao ?? "1.0",
      assinado: !!paciente.consentimentoTCLE?.assinado,
      dataAssinatura: paciente.consentimentoTCLE?.dataHora?.toDate?.()?.toISOString?.() ?? null,
      expiraEm: expiraEm?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("[API/tcle/assinatura][GET]", error);
    return NextResponse.json({ error: "Erro ao validar assinatura." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string };
    const token = body?.token?.trim();

    if (!token) {
      return NextResponse.json({ error: "Token é obrigatório." }, { status: 400 });
    }

    const pacienteDoc = await buscarPacientePorToken(token);
    if (!pacienteDoc) {
      return NextResponse.json({ error: "Token inválido." }, { status: 404 });
    }

    const { id: pacienteId, data: paciente } = pacienteDoc;
    const expiraEm = paciente.tcleTokenExpiraEm?.toDate?.() ?? null;

    if (expiraEm && expiraEm.getTime() < Date.now()) {
      return NextResponse.json({ error: "Link expirado." }, { status: 410 });
    }

    if (paciente.consentimentoTCLE?.assinado) {
      return NextResponse.json({ success: true, message: "TCLE já foi assinado." });
    }

    await updateDoc(doc(db, COLLECTIONS.PACIENTES, pacienteId), {
      consentimentoTCLE: {
        assinado: true,
        dataHora: serverTimestamp(),
        ipAddress: getClientIp(request),
        versao: paciente.consentimentoTCLE?.versao ?? "1.0",
      },
      tcleToken: null,
      tcleTokenExpiraEm: null,
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true, message: "TCLE assinado com sucesso." });
  } catch (error) {
    console.error("[API/tcle/assinatura][POST]", error);
    return NextResponse.json({ error: "Erro ao assinar TCLE." }, { status: 500 });
  }
}
