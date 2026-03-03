import { NextRequest, NextResponse } from "next/server";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { PacienteFirestore, UserFirestore } from "@/types/firestore";

async function buscarPacientePorToken(token: string): Promise<{ id: string; data: PacienteFirestore } | null> {
  const q = query(
    collection(db, COLLECTIONS.PACIENTES),
    where("contratoToken", "==", token),
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

    const expiraEm = paciente.contratoTokenExpiraEm?.toDate?.() ?? null;
    if (expiraEm && expiraEm.getTime() < Date.now()) {
      return NextResponse.json({ error: "Link expirado." }, { status: 410 });
    }

    const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, paciente.userId));
    const profissional = userSnap.exists() ? (userSnap.data() as UserFirestore) : null;

    const foroCidade = profissional?.cidade?.trim() || "cidade do profissional";
    const foroUF = profissional?.crpUF?.trim() || "UF do CRP";

    // Dados do paciente
    const enderecoCompleto = paciente.endereco 
      ? `${paciente.endereco.logradouro || ""}, ${paciente.endereco.numero || "s/n"}, ${paciente.endereco.bairro || ""}, ${paciente.endereco.cidade || ""} - ${paciente.endereco.estado || ""}`.trim()
      : "Endereço não informado";

    return NextResponse.json({
      success: true,
      pacienteNome: paciente.nomeCompleto,
      pacienteEndereco: enderecoCompleto,
      terapeutaNome: profissional?.displayName ?? "Profissional responsável",
      terapeutaCrp: profissional?.crp ? `${profissional?.crpUF ?? ""}/${profissional.crp}` : null,
      terapeutaUF: profissional?.crpUF ?? null,
      duracaoSessao: paciente.duracaoSessaoPadrao ?? profissional?.duracaoSessao ?? 50,
      valorSessao: paciente.valorSessaoPadrao ?? profissional?.valorSessao ?? 0,
      formaPagamento: paciente.formaPagamentoPadrao ?? "a definir",
      modalidade: paciente.modalidadePadrao ?? "a definir",
      frequencia: paciente.frequenciaPadrao ?? "a definir",
      politicaCancelamento: profissional?.politicaCancelamento ?? "24h",
      foroCidade,
      foroUF,
      assinado: !!paciente.contratoAssinado,
      dataAssinatura: paciente.contratoDataAssinatura?.toDate?.()?.toISOString?.() ?? null,
      expiraEm: expiraEm?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("[API/contrato/assinatura][GET]", error);
    return NextResponse.json({ error: "Erro ao validar assinatura do contrato." }, { status: 500 });
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
    const expiraEm = paciente.contratoTokenExpiraEm?.toDate?.() ?? null;

    if (expiraEm && expiraEm.getTime() < Date.now()) {
      return NextResponse.json({ error: "Link expirado." }, { status: 410 });
    }

    if (paciente.contratoAssinado) {
      return NextResponse.json({ success: true, message: "Contrato já foi assinado." });
    }

    await updateDoc(doc(db, COLLECTIONS.PACIENTES, pacienteId), {
      contratoAssinado: true,
      contratoDataAssinatura: serverTimestamp(),
      contratoToken: null,
      contratoTokenExpiraEm: null,
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true, message: "Contrato assinado com sucesso." });
  } catch (error) {
    console.error("[API/contrato/assinatura][POST]", error);
    return NextResponse.json({ error: "Erro ao assinar contrato." }, { status: 500 });
  }
}
