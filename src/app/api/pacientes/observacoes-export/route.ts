import { NextRequest, NextResponse } from "next/server";
import { buscarObservacoesDoPaciente, buscarPaciente } from "@/lib/firebase/firestore";
import { decryptText } from "@/lib/encryption";

export async function GET(request: NextRequest) {
  try {
    const pacienteId = request.nextUrl.searchParams.get("pacienteId")?.trim();
    const userId = request.nextUrl.searchParams.get("userId")?.trim();

    if (!pacienteId || !userId) {
      return NextResponse.json({ error: "pacienteId e userId são obrigatórios." }, { status: 400 });
    }

    const paciente = await buscarPaciente(pacienteId);
    if (!paciente) {
      return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
    }

    const observacoes = await buscarObservacoesDoPaciente(pacienteId, userId);

    const observacoesDecriptadas = observacoes.map((obs) => {
      let conteudo = obs.conteudoCriptografado;
      if (obs.isEncrypted) {
        try {
          conteudo = decryptText(obs.conteudoCriptografado, obs.conteudoIV, userId);
        } catch {
          conteudo = "[Erro ao descriptografar]";
        }
      }
      return {
        data: obs.dataObservacao?.toDate?.()?.toISOString?.() ?? null,
        conteudo,
      };
    });

    const exportData = {
      paciente: {
        nome: paciente.nomeCompleto,
        email: paciente.email,
        telefone: paciente.telefone,
      },
      observacoes: observacoesDecriptadas,
      exportadoEm: new Date().toISOString(),
    };

    return NextResponse.json(exportData);
  } catch (error) {
    console.error("[API/pacientes/observacoes-export]", error);
    return NextResponse.json({ error: "Erro ao exportar observações." }, { status: 500 });
  }
}
