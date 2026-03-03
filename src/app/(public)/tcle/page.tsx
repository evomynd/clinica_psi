"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, ShieldCheck, Loader2, CheckCircle2, AlertTriangle, Printer } from "lucide-react";

interface ValidacaoResponse {
  pacienteNome: string;
  terapeutaNome: string;
  terapeutaCrp: string | null;
  versao: string;
  assinado: boolean;
  dataAssinatura: string | null;
  expiraEm: string | null;
}

function TCLEPublicContent() {
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
        const response = await fetch(`/api/tcle/assinatura?token=${encodeURIComponent(token)}`);
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
      const response = await fetch("/api/tcle/assinatura", {
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
              <FileText className="w-5 h-5" />
              <h1 className="text-lg font-semibold">TCLE — Termo de Consentimento Livre e Esclarecido</h1>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Leia com atenção. Você pode salvar este termo como PDF usando o botão “Imprimir/Salvar PDF”.
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
                <section className="prose prose-sm max-w-none text-slate-700">
                  <p>
                    Eu, <strong>{dados.pacienteNome}</strong>, declaro que fui informado(a) de forma clara sobre a
                    natureza do atendimento psicológico, seus objetivos, limites éticos, sigilo profissional e
                    condições gerais de atendimento.
                  </p>
                  <p>
                    Estou ciente de que o acompanhamento será conduzido por <strong>{dados.terapeutaNome}</strong>
                    {dados.terapeutaCrp ? <> (CRP {dados.terapeutaCrp})</> : null}, seguindo as normas técnicas e éticas aplicáveis.
                  </p>
                  <p>
                    Também declaro que recebi orientações sobre política de faltas, reagendamentos, forma de pagamento,
                    confidencialidade e limites legais de quebra de sigilo.
                  </p>
                  <p>
                    Versão do documento: <strong>{dados.versao}</strong>
                  </p>
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
                        <p className="font-semibold mb-1">TCLE assinado com sucesso!</p>
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
                        Declaro que li e concordo com o conteúdo deste TCLE, autorizando o início/continuidade do atendimento.
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
                        Assinar TCLE
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

export default function TCLEPublicPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 py-8 px-4">
          <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <div className="py-12 flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p>Carregando termo…</p>
            </div>
          </div>
        </main>
      }
    >
      <TCLEPublicContent />
    </Suspense>
  );
}
