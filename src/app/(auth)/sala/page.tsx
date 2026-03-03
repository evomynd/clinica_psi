"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Video, Loader2, AlertCircle, Users } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { AgendamentoFirestore, PacienteFirestore } from "@/types/firestore";
import { toast } from "sonner";

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

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
    if (!linkSala || !user) return;

    async function buscarAgendamento() {
      try {
        setLoading(true);
        
        const q = query(
          collection(db, COLLECTIONS.AGENDAMENTOS),
          where("linkSala", "==", linkSala)
        );
        
        const snap = await getDocs(q);
        
        if (snap.empty) {
          setError("Sessão não encontrada. Verifique o link.");
          setLoading(false);
          return;
        }

        const agendamentoData = { id: snap.docs[0].id, ...snap.docs[0].data() } as AgendamentoFirestore;
        setAgendamento(agendamentoData);

        // Busca dados do paciente
        if (agendamentoData.pacienteId) {
          const pacienteSnap = await getDocs(
            query(collection(db, COLLECTIONS.PACIENTES), where("__name__", "==", agendamentoData.pacienteId))
          );
          if (!pacienteSnap.empty) {
            setPaciente({ id: pacienteSnap.docs[0].id, ...pacienteSnap.docs[0].data() } as PacienteFirestore);
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
  }, [linkSala, user]);

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

  if (!linkSala) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Link de sala não fornecido</h2>
          <p className="text-sm text-slate-500">Acesse pela agenda ou com o link completo da sessão</p>
        </div>
      </div>
    );
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
