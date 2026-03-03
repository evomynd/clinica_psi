"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileSignature, ShieldCheck, Loader2, CheckCircle2, AlertTriangle, Printer } from "lucide-react";

interface ValidacaoResponse {
  pacienteNome: string;
  pacienteEndereco: string;
  terapeutaNome: string;
  terapeutaCrp: string | null;
  terapeutaUF: string | null;
  duracaoSessao: number;
  valorSessao: number;
  formaPagamento: string;
  modalidade: string;
  frequencia: string;
  politicaCancelamento: string;
  foroCidade: string;
  foroUF: string;
  assinado: boolean;
  dataAssinatura: string | null;
  expiraEm: string | null;
}

function ContratoPublicContent() {
  const params = useSearchParams();
  const token = useMemo(() => params.get("token")?.trim() ?? "", [params]);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aceite, setAceite] = useState(false);
  const [dados, setDados] = useState<ValidacaoResponse | null>(null);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    async function carregar() {
      if (!token) {
        setErro("Link inválido. Token ausente.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErro(null);

      try {
        const response = await fetch(`/api/contrato/assinatura?token=${encodeURIComponent(token)}`);
        const body = await response.json();

        if (!response.ok) {
          setErro(body?.error ?? "Não foi possível validar este link.");
          setDados(null);
          setConcluido(false);
          return;
        }

        setDados(body as ValidacaoResponse);
        setConcluido(Boolean(body?.assinado));
      } catch {
        setErro("Erro de conexão ao validar o link.");
      } finally {
        setLoading(false);
      }
    }

    carregar();
  }, [token]);

  async function assinar() {
    if (!token || !aceite) return;
    setSending(true);
    setErro(null);

    try {
      const response = await fetch("/api/contrato/assinatura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await response.json();

      if (!response.ok) {
        setErro(body?.error ?? "Não foi possível concluir a assinatura.");
        return;
      }

      setConcluido(true);
    } catch {
      setErro("Erro de conexão ao assinar.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-primary-50 to-indigo-50">
            <div className="flex items-center gap-2 text-primary-700">
              <FileSignature className="w-5 h-5" />
              <h1 className="text-lg font-semibold">Contrato de Prestação de Serviços Psicológicos</h1>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Leia com atenção. Você pode salvar este contrato como PDF usando o botão “Imprimir/Salvar PDF”.
            </p>
          </div>

          <div className="p-6 space-y-5">
            {loading && (
              <div className="py-12 flex flex-col items-center gap-2 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p>Validando link…</p>
              </div>
            )}

            {!loading && erro && (
              <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            {!loading && !erro && dados && (
              <>
                <section className="prose prose-sm max-w-none text-slate-700 space-y-4">
                  {/* 1. IDENTIFICAÇÃO DAS PARTES */}
                  <div>
                    <h2 className="text-base font-semibold text-slate-800 mb-2">1. IDENTIFICAÇÃO DAS PARTES</h2>
                    <p className="mb-1">
                      <strong>CONTRATADA:</strong> {dados.terapeutaNome}
                      {dados.terapeutaCrp && <>, CRP {dados.terapeutaCrp}</>}
                      {dados.terapeutaUF && <>, residente no estado {dados.terapeutaUF}</>}
                    </p>
                    <p>
                      <strong>CONTRATANTE:</strong> {dados.pacienteNome}, residente em {dados.pacienteEndereco}.
                    </p>
                  </div>

                  {/* 2. OBJETO E MODALIDADE */}
                  <div>
                    <h2 className="text-base font-semibold text-slate-800 mb-2">2. OBJETO E MODALIDADE</h2>
                    <p>
                      O presente contrato visa a prestação de serviços de psicoterapia na modalidade{" "}
                      <strong>{dados.modalidade === "presencial" ? "Presencial" : dados.modalidade === "online" ? "Online" : dados.modalidade}</strong>.
                    </p>
                    <p>
                      As sessões terão duração de <strong>{dados.duracaoSessao} minutos</strong>, com frequência{" "}
                      <strong>{dados.frequencia === "semanal" ? "Semanal" : dados.frequencia === "quinzenal" ? "Quinzenal" : dados.frequencia}</strong>.
                    </p>
                  </div>

                  {/* 3. SIGILO E PRIVACIDADE (LGPD) */}
                  <div>
                    <h2 className="text-base font-semibold text-slate-800 mb-2">3. SIGILO E PRIVACIDADE (LGPD)</h2>
                    <p>
                      Todas as informações compartilhadas são protegidas pelo Sigilo Profissional (Art. 9º do Código de Ética do Psicólogo).
                    </p>
                    <p>
                      O paciente consente com o tratamento de seus dados pessoais e sensíveis estritamente para fins de prontuário e gestão clínica,
                      conforme a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
                    </p>
                  </div>

                  {/* 4. HONORÁRIOS E CANCELAMENTOS */}
                  <div>
                    <h2 className="text-base font-semibold text-slate-800 mb-2">4. HONORÁRIOS E CANCELAMENTOS</h2>
                    <p>
                      O valor por sessão é de <strong>R$ {dados.valorSessao.toFixed(2)}</strong>, a ser pago via{" "}
                      <strong>
                        {dados.formaPagamento === "pix" ? "Pix" :
                         dados.formaPagamento === "cartao" ? "Cartão" :
                         dados.formaPagamento === "dinheiro" ? "Dinheiro" :
                         dados.formaPagamento === "transferencia" ? "Transferência" :
                         dados.formaPagamento}
                      </strong>.
                    </p>
                    <p>
                      <strong>Faltas e Desmarcações:</strong> Devem ser comunicadas com antecedência mínima de{" "}
                      <strong>{dados.politicaCancelamento === "24h" ? "24 horas" : "48 horas"}</strong>. Caso contrário, o valor da sessão poderá ser
                      cobrado integralmente, pois o horário ficou reservado ao paciente.
                    </p>
                  </div>

                  {/* 5. ATENDIMENTO ONLINE (Se aplicável) */}
                  {dados.modalidade === "online" && (
                    <div>
                      <h2 className="text-base font-semibold text-slate-800 mb-2">5. ATENDIMENTO ONLINE</h2>
                      <p>
                        O paciente declara estar em local privado e seguro para garantir a confidencialidade.
                      </p>
                      <p>
                        O psicólogo utiliza plataformas que garantem a criptografia dos dados, conforme as normas vigentes de segurança da informação.
                      </p>
                    </div>
                  )}

                  {/* 6. CONSENTIMENTO E DESISTÊNCIA */}
                  <div>
                    <h2 className="text-base font-semibold text-slate-800 mb-2">
                      {dados.modalidade === "online" ? "6" : "5"}. CONSENTIMENTO E DESISTÊNCIA
                    </h2>
                    <p>
                      O paciente declara que foi informado sobre os métodos de trabalho e riscos (como desconforto emocional temporário) e aceita iniciar o processo.
                    </p>
                    <p>
                      A interrupção do tratamento pode ocorrer a qualquer momento por vontade do paciente, mediante aviso prévio para encerramento ético.
                    </p>
                  </div>

                  {/* FORO */}
                  <div>
                    <h2 className="text-base font-semibold text-slate-800 mb-2">
                      {dados.modalidade === "online" ? "7" : "6"}. FORO
                    </h2>
                    <p>
                      Fica eleito o foro da comarca de <strong>{dados.foroCidade}/{dados.foroUF}</strong>, com renúncia de qualquer outro,
                      por mais privilegiado que seja, para dirimir dúvidas oriundas deste contrato.
                    </p>
                  </div>
                </section>

                {dados.expiraEm && !concluido && (
                  <p className="text-xs text-slate-500">
                    Este link expira em: {new Date(dados.expiraEm).toLocaleString("pt-BR")}
                  </p>
                )}

                {concluido ? (
                  <>
                    <div className="rounded-xl border border-green-200 bg-green-50 text-green-700 px-4 py-3 text-sm flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold mb-1">Contrato assinado com sucesso!</p>
                        {dados.dataAssinatura && (
                          <p className="text-xs text-green-600">
                            Data da assinatura: {new Date(dados.dataAssinatura).toLocaleString("pt-BR")}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold"
                    >
                      <Printer className="w-4 h-4" />
                      Baixar PDF Assinado
                    </button>
                  </>
                ) : (
                  <>
                    <label className="flex items-start gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={aceite}
                        onChange={(e) => setAceite(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        Declaro que li e concordo com os termos acima, assinando eletronicamente este contrato.
                      </span>
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={assinar}
                        disabled={!aceite || sending}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-60"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        Assinar Contrato
                      </button>

                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium"
                      >
                        <Printer className="w-4 h-4" />
                        Imprimir / Salvar PDF
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ContratoPublicPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 py-8 px-4">
          <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <div className="py-12 flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p>Carregando contrato…</p>
            </div>
          </div>
        </main>
      }
    >
      <ContratoPublicContent />
    </Suspense>
  );
}
