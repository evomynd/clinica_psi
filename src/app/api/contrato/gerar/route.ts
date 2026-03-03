import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { PacienteFirestore } from "@/types/firestore";

interface GerarContratoPayload {
  pacienteId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GerarContratoPayload;
    const pacienteId = body?.pacienteId?.trim();

    if (!pacienteId) {
      return NextResponse.json({ error: "pacienteId é obrigatório." }, { status: 400 });
    }

    const pacienteRef = doc(db, COLLECTIONS.PACIENTES, pacienteId);
    const pacienteSnap = await getDoc(pacienteRef);

    if (!pacienteSnap.exists()) {
      return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
    }

    const paciente = pacienteSnap.data() as PacienteFirestore;

    if (paciente.contratoAssinado) {
      return NextResponse.json({ error: "Contrato já assinado para este paciente." }, { status: 409 });
    }

    const token = crypto.randomUUID().replace(/-/g, "");
    const expiraEmDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
    const expiraEm = Timestamp.fromDate(expiraEmDate);

    const origin = request.nextUrl.origin;
    const linkAssinatura = `${origin}/contrato?token=${token}`;

    await updateDoc(pacienteRef, {
      contratoAssinado: false,
      contratoUrl: linkAssinatura,
      contratoToken: token,
      contratoTokenExpiraEm: expiraEm,
      contratoDataAssinatura: null,
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      linkAssinatura,
      expiraEm: expiraEmDate.toISOString(),
    });
  } catch (error) {
    console.error("[API/contrato/gerar]", error);
    return NextResponse.json({ error: "Erro ao gerar link de contrato." }, { status: 500 });
  }
}
