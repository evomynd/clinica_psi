"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Video, Loader2, AlertCircle, Users, Clock, Copy, Send, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { AgendamentoFirestore, PacienteFirestore } from "@/types/firestore";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

// ─── Componente: Lista de Agendamentos do Dia ────────────────────────────────
function ListaAgendamentosDoDia() {
  const { user } = useAuth();
  const [agendamentos, setAgendamentos] = useState<
    Array<{
      agendamento: AgendamentoFirestore;
      paciente: PacienteFirestore | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function carregar() {
      try {
        setLoading(true);
        const { buscarAgendamentosHoje, buscarPacientePorId } = await import("@/lib/firebase/firestore");
        
        const agendamentosHoje = await buscarAgendamentosHoje(user!.uid);
        
        // Busca dados dos pacientes
        const agendamentosComPacientes = await Promise.all(
          agendamentosHoje.map(async (ag) => {
            const paciente = ag.pacienteId ? await buscarPacientePorId(ag.pacienteId) : null;
            return { agendamento: ag, paciente };
          })
        );

        setAgendamentos(agendamentosComPacientes);
      } catch (err) {
        console.error("Erro ao buscar agendamentos:", err);
        toast.error("Erro ao carregar agendamentos do dia");
      } finally {
        setLoading(false);
      }
    }

    carregar();
  }, [user]);

  function getLinkSessao(linkSala: string) {
    return `${window.location.origin}/sessao?sala=${linkSala}`;
  }

  function copiarLink(linkSala: string, agendamentoId: string) {
    const link = getLinkSessao(linkSala);
    navigator.clipboard.writeText(link);
    setCopiado(agendamentoId);
    toast.success("Link copiado!");
    setTimeout(() => setCopiado(null), 2000);
  }

  function enviarWhatsApp(linkSala: string, nomePaciente: string, horaFormatada: string) {
    const link = getLinkSessao(linkSala);
    const mensagem = `Olá ${nomePaciente}! Segue o link da sua sessão de hoje às ${horaFormatada}:\n\n${link}\n\nAté logo!`;
    const urlWhats = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(urlWhats, "_blank");
  }

  function podeEntrar(dataHora: any): boolean {
    if (!dataHora?.toMillis) return false;
    const agora = Date.now();
    const inicio = dataHora.toMillis();
    const diferenca = inicio - agora;
    // Permite entrar 15 minutos antes (15 * 60 * 1000 = 900000ms)
    return diferenca <= 900000;
  }

  function entrarNaSala(linkSala: string) {
    const url = `/sala?sala=${linkSala}`;
    window.open(url, "_blank");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto text-primary-500 animate-spin mb-4" />
          <p className="text-sm text-slate-500">Carregando agendamentos...</p>
        </div>
      </div>
    );
  }

  if (agendamentos.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <Video className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Nenhuma sessão hoje</h2>
          <p className="text-sm text-slate-500">Você não tem sessões agendadas para hoje</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Sala Virtual</h1>
        <p className="text-sm text-slate-500">Sessões agendadas para hoje</p>
      </div>

      <div className="space-y-4">
        {agendamentos.map(({ agendamento, paciente }) => {
          const dataHora = agendamento.dataHora?.toDate();
          const horaFormatada = dataHora ? format(dataHora, "HH:mm", { locale: ptBR }) : "—";
          const dataFormatada = dataHora ? format(dataHora, "dd/MM/yyyy", { locale: ptBR }) : "—";
          const podeEntrarAgora = podeEntrar(agendamento.dataHora);
          const nomePaciente = paciente?.nomeCompleto || "Paciente desconhecido";

          return (
            <div
              key={agendamento.id}
              className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Header do card */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">{nomePaciente}</h3>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{horaFormatada}</span>
                    </div>
                    <span>•</span>
                    <span>{dataFormatada}</span>
                    <span>•</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      agendamento.status === "agendado" ? "bg-blue-100 text-blue-700" :
                      agendamento.status === "realizado" ? "bg-green-100 text-green-700" :
                      agendamento.status === "cancelado" ? "bg-red-100 text-red-700" :
                      "bg-slate-100 text-slate-700"
                    }`}>
                      {agendamento.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex items-center gap-3">
                {/* Botão WhatsApp */}
                <button
                  onClick={() => enviarWhatsApp(agendamento.linkSala, nomePaciente, horaFormatada)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4" />
                  WhatsApp
                </button>

                {/* Botão Copiar */}
                <button
                  onClick={() => copiarLink(agendamento.linkSala, agendamento.id!)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                >
                  {copiado === agendamento.id ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar Link
                    </>
                  )}
                </button>

                {/* Botão Entrar na Sala */}
                <button
                  onClick={() => entrarNaSala(agendamento.linkSala)}
                  disabled={!podeEntrarAgora}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    podeEntrarAgora
                      ? "bg-primary-600 hover:bg-primary-700 text-white"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                  title={!podeEntrarAgora ? "Disponível 15 minutos antes da sessão" : "Entrar na sala"}
                >
                  <Video className="w-4 h-4" />
                  Entrar na Sala
                </button>
              </div>

              {/* Aviso de disponibilidade */}
              {!podeEntrarAgora && (
                <p className="mt-3 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md">
                  <Clock className="w-3 h-3 inline mr-1" />
                  A sala estará disponível 15 minutos antes do horário agendado
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Componente Principal: Sala Virtual ──────────────────────────────────────
export default function SalaPage() {
  const { user, userProfile } = useAuth();
  const searchParams = useSearchParams();
  const linkSala = searchParams.get("sala");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agendamento, setAgendamento] = useState<AgendamentoFirestore | null>(null);
  const [paciente, setPaciente] = useState<PacienteFirestore | null>(null);
  
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);

  // Busca agendamento pelo linkSala
  useEffect(() => {
    if (!linkSala) return;

    async function buscarAgendamento() {
      try {
        setLoading(true);
        
        const { buscarAgendamentoPorSala } = await import("@/lib/firebase/firestore");
        const agendamentoData = await buscarAgendamentoPorSala(linkSala!);
        
        if (!agendamentoData) {
          setError("Sessão não encontrada. Verifique o link.");
          setLoading(false);
          return;
        }

        setAgendamento(agendamentoData);

        // Busca dados do paciente
        if (agendamentoData.pacienteId) {
          const { buscarPacientePorId } = await import("@/lib/firebase/firestore");
          const pacienteData = await buscarPacientePorId(agendamentoData.pacienteId);
          if (pacienteData) {
            setPaciente(pacienteData);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("Erro ao buscar agendamento:", err);
        setError("Erro ao carregar sessão.");
        setLoading(false);
      }
    }

    buscarAgendamento();
  }, [linkSala]);

  // Inicializa Jitsi quando agendamento carregado
  useEffect(() => {
    if (!agendamento || !user || !userProfile || !jitsiContainerRef.current) return;

    const moderator = agendamento.userId === user.uid;

    async function inicializarJitsi() {
      try {
        // Carrega script do Jitsi
        if (!window.JitsiMeetExternalAPI) {
          const script = document.createElement("script");
          script.src = "https://8x8.vc/vpaas-magic-cookie-ae78187b84ff498e8be9f759889a4413/external_api.js";
          script.async = true;
          script.onload = () => iniciarSala();
          script.onerror = () => {
            setError("Não foi possível carregar a Sala Virtual (script Jitsi).");
            toast.error("Falha ao carregar serviço de vídeo.");
          };
          document.head.appendChild(script);
        } else {
          iniciarSala();
        }
      } catch (err) {
        console.error("Erro ao inicializar Jitsi:", err);
        toast.error("Erro ao carregar sala virtual.");
      }
    }

    async function iniciarSala() {
      if (!agendamento || !user || !userProfile) return;

      try {
        function fixIframePermissions() {
          const iframe = jitsiContainerRef.current?.querySelector("iframe");
          if (iframe) {
            iframe.allow =
              "camera *; microphone *; display-capture *; fullscreen *; autoplay *; clipboard-write *; picture-in-picture *";
          }
        }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          stream.getTracks().forEach((track) => track.stop());
        } catch (permErr: any) {
          if (permErr?.name === "NotAllowedError" || permErr?.name === "PermissionDeniedError") {
            toast.error("Câmera/microfone bloqueados. Autorize nas configurações do navegador.");
          }
        }

        const fullRoomName = `vpaas-magic-cookie-ae78187b84ff498e8be9f759889a4413/clinica-psi-${linkSala}`;

        // Gera JWT no servidor
        const response = await fetch("/api/jitsi/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: fullRoomName,
            userName: userProfile.displayName || "Usuário",
            userEmail: userProfile.email || undefined,
            userId: user.uid, // ID único para contagem do free tier
            moderator,
          }),
        });

        if (!response.ok) {
          throw new Error("Erro ao obter token de acesso");
        }

        const { token } = await response.json();

        const domain = "8x8.vc";
        const options = {
          roomName: fullRoomName,
          parentNode: jitsiContainerRef.current,
          jwt: token,
          width: "100%",
          height: "100%",
          configOverwrite: {
            startWithAudioMuted: true,
            startWithVideoMuted: false,
            disableDeepLinking: true,
            prejoinPageEnabled: false,
            enableWelcomePage: false,
            toolbarButtons: [
              "microphone",
              "camera",
              "desktop",
              "fullscreen",
              "hangup",
              "chat",
              "settings",
              "raisehand",
              "videoquality",
              "tileview",
            ],
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DEFAULT_BACKGROUND: "#f8fafc",
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
          },
        };

        jitsiApiRef.current = new window.JitsiMeetExternalAPI(domain, options);

        setTimeout(fixIframePermissions, 200);
        jitsiApiRef.current.addEventListener("videoConferenceJoined", fixIframePermissions);

        // Event listeners
        jitsiApiRef.current.addEventListener("videoConferenceJoined", () => {
          console.log("Entrou na sala");
        });

        jitsiApiRef.current.addEventListener("videoConferenceLeft", () => {
          console.log("Saiu da sala");
        });

        jitsiApiRef.current.addEventListener("errorOccurred", (evt: any) => {
          console.error("Erro Jitsi:", evt);
          setError("Falha ao conectar na Sala Virtual.");
          toast.error("Erro ao iniciar videoconferência.");
        });
      } catch (err) {
        console.error("Erro ao iniciar sala:", err);
        setError("Erro ao iniciar Sala Virtual.");
        toast.error("Erro ao conectar na sala virtual.");
      }
    }

    inicializarJitsi();

    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, [agendamento, user, userProfile, linkSala]);

  // Se não há linkSala, mostra lista de agendamentos
  if (!linkSala) {
    return <ListaAgendamentosDoDia />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto text-primary-500 animate-spin mb-4" />
          <p className="text-sm text-slate-500">Carregando sala virtual...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Erro ao carregar sala</h2>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col -m-4 md:-m-6 lg:-m-8"
      style={{ height: "calc(100dvh - 64px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Video className="w-5 h-5 text-primary-600" />
          <div>
            <h1 className="text-base font-semibold text-slate-800">Sala Virtual</h1>
            {agendamento && paciente && (
              <p className="text-xs text-slate-500">
                Sessão com {agendamento.userId === user?.uid ? paciente.nomeCompleto : "seu terapeuta"}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Users className="w-4 h-4" />
          <span>{agendamento?.userId === user?.uid ? "Você é o moderador" : "Participante"}</span>
        </div>
      </div>

      {/* Jitsi Container — ocupa todo o restante */}
      <div className="flex-1 min-h-0 bg-slate-900 relative">
        <div
          ref={jitsiContainerRef}
          style={{ position: "absolute", inset: 0 }}
        />
      </div>
    </div>
  );
}
