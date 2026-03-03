"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Video, Loader2, AlertCircle, Users, LogIn } from "lucide-react";
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

const JAAS_APP_ID = "vpaas-magic-cookie-ae78187b84ff498e8be9f759889a4413";

function SessaoPageInner() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const linkSala = searchParams.get("sala");

  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [agendamento, setAgendamento]   = useState<AgendamentoFirestore | null>(null);
  const [paciente, setPaciente]         = useState<PacienteFirestore | null>(null);
  const [nomeVisitante, setNomeVisitante] = useState("");
  const [aguardandoNome, setAguardandoNome] = useState(false);
  const [entrou, setEntrou]             = useState(false);

  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef       = useRef<any>(null);

  // Busca agendamento pelo linkSala
  useEffect(() => {
    if (!linkSala || authLoading) return;

    async function buscarAgendamento() {
      try {
        setLoading(true);
        const snap = await getDocs(
          query(collection(db, COLLECTIONS.AGENDAMENTOS), where("linkSala", "==", linkSala))
        );

        if (snap.empty) {
          setError("Sessão não encontrada. Verifique o link.");
          setLoading(false);
          return;
        }

        const agData = { id: snap.docs[0].id, ...snap.docs[0].data() } as AgendamentoFirestore;
        setAgendamento(agData);

        if (agData.pacienteId) {
          const pSnap = await getDocs(
            query(collection(db, COLLECTIONS.PACIENTES), where("__name__", "==", agData.pacienteId))
          );
          if (!pSnap.empty) {
            setPaciente({ id: pSnap.docs[0].id, ...pSnap.docs[0].data() } as PacienteFirestore);
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
  }, [linkSala, authLoading]);

  // Depois de carregado: decide se precisa pedir nome (visitante não logado)
  useEffect(() => {
    if (loading || !agendamento) return;
    if (!user) {
      setAguardandoNome(true); // paciente não logado → pede nome
    }
  }, [loading, agendamento, user]);

  // Inicializa Jitsi quando entrou=true
  useEffect(() => {
    if (!entrou || !agendamento || !jitsiContainerRef.current) return;

    const isTherapist  = !!user && agendamento.userId === user.uid;
    const displayName  = isTherapist
      ? (userProfile?.displayName || "Terapeuta")
      : (user?.displayName || nomeVisitante || "Paciente");
    const displayEmail = isTherapist ? (userProfile?.email || "") : "";
    // Para paciente não logado, usa pacienteId como userId para contagem JaaS estável
    const userId = user?.uid || agendamento.pacienteId || `visitante-${linkSala}`;

    // Aplica atributo allow no iframe criado pelo Jitsi para câmera/microfone funcionarem
    function fixIframePermissions() {
      const iframe = jitsiContainerRef.current?.querySelector("iframe");
      if (iframe) {
        iframe.allow =
          "camera *; microphone *; display-capture *; fullscreen *; autoplay *; clipboard-write *; picture-in-picture *";
      }
    }

    function montarJitsi(token: string, fullRoomName: string) {
      const options = {
        roomName:   fullRoomName,
        parentNode: jitsiContainerRef.current!,
        jwt:        token,
        width:      "100%",
        height:     "100%",
        configOverwrite: {
          startWithAudioMuted:  false,
          startWithVideoMuted:  false,
          disableDeepLinking:   true,
          prejoinPageEnabled:   false,
          enableWelcomePage:    false,
          toolbarButtons: [
            "microphone","camera","desktop","fullscreen",
            "hangup","chat","settings","raisehand","videoquality","tileview",
          ],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK:             false,
          SHOW_WATERMARK_FOR_GUESTS:        false,
          DEFAULT_BACKGROUND:               "#0f172a",
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
        },
      };

      jitsiApiRef.current = new window.JitsiMeetExternalAPI("8x8.vc", options);

      // Corrige permissões do iframe logo após montagem
      setTimeout(fixIframePermissions, 200);

      // Re-aplica se o iframe for recriado
      jitsiApiRef.current.addEventListener("videoConferenceJoined", fixIframePermissions);
    }

    async function iniciarSala() {
      try {
        // 1. Solicita permissões do navegador ANTES de carregar o Jitsi
        //    Assim o browser exibe o popup nativo de câmera/microfone
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          // Libera as tracks imediatamente — o Jitsi vai pedir de novo internamente
          stream.getTracks().forEach((t) => t.stop());
        } catch (permErr: any) {
          // Permissão negada: avisa mas continua (Jitsi mostrará mensagem própria)
          if (permErr.name === "NotAllowedError" || permErr.name === "PermissionDeniedError") {
            toast.error("Câmera/microfone bloqueados. Autorize nas configurações do navegador.");
          }
        }

        // 2. Gera token JWT
        const fullRoomName = `${JAAS_APP_ID}/clinica-psi-${linkSala}`;
        const response = await fetch("/api/jitsi/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName:  fullRoomName,
            userName:  displayName,
            userEmail: displayEmail || undefined,
            userId,
            moderator: isTherapist,
          }),
        });
        if (!response.ok) throw new Error("Erro ao gerar token de acesso");
        const { token } = await response.json();

        // 3. Carrega script Jitsi e monta
        if (!window.JitsiMeetExternalAPI) {
          const script = document.createElement("script");
          script.src   = `https://8x8.vc/${JAAS_APP_ID}/external_api.js`;
          script.async = true;
          script.onload  = () => montarJitsi(token, fullRoomName);
          script.onerror = () => setError("Não foi possível carregar o serviço de vídeo.");
          document.head.appendChild(script);
        } else {
          montarJitsi(token, fullRoomName);
        }
      } catch (err) {
        console.error("Erro ao iniciar sala:", err);
        setError("Erro ao iniciar a sala virtual. Tente recarregar a página.");
        toast.error("Erro ao conectar na sala virtual.");
      }
    }

    iniciarSala();

    return () => {
      jitsiApiRef.current?.dispose();
      jitsiApiRef.current = null;
    };
  }, [entrou]);

  // ─── TELA: link inválido ──────────────────────────────────────────────────
  if (!linkSala) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50">
        <div className="text-center p-8">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Link inválido</h2>
          <p className="text-sm text-slate-500">Solicite um novo link ao seu terapeuta.</p>
        </div>
      </div>
    );
  }

  // ─── TELA: carregando ─────────────────────────────────────────────────────
  if (loading || authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto text-indigo-500 animate-spin mb-4" />
          <p className="text-sm text-slate-500">Carregando sala virtual…</p>
        </div>
      </div>
    );
  }

  // ─── TELA: erro ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50">
        <div className="text-center p-8">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Erro</h2>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  // ─── TELA: visitante precisa digitar o nome ───────────────────────────────
  if (aguardandoNome && !entrou) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center">
              <Video className="w-7 h-7 text-indigo-600" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-slate-800 text-center mb-1">
            Sala Virtual
          </h1>
          {paciente && (
            <p className="text-sm text-slate-500 text-center mb-6">
              Sessão de terapia
            </p>
          )}
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Seu nome
          </label>
          <input
            type="text"
            value={nomeVisitante}
            onChange={(e) => setNomeVisitante(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && nomeVisitante.trim()) setEntrou(true);
            }}
            placeholder="Digite seu nome para entrar"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            autoFocus
          />
          <button
            onClick={() => { if (nomeVisitante.trim()) setEntrou(true); }}
            disabled={!nomeVisitante.trim()}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            Entrar na Sessão
          </button>
        </div>
      </div>
    );
  }

  // ─── TELA: terapeuta logado, ainda não clicou em entrar ──────────────────
  if (!entrou && !aguardandoNome) {
    const isTherapist = !!user && agendamento?.userId === user.uid;
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center">
              <Video className="w-7 h-7 text-indigo-600" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-slate-800 text-center mb-1">Sala Virtual</h1>
          {paciente && (
            <p className="text-sm text-slate-500 text-center mb-1">
              Sessão com {isTherapist ? paciente.nomeCompleto : "seu terapeuta"}
            </p>
          )}
          <p className="text-xs text-center mb-6 mt-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isTherapist ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
              <Users className="w-3 h-3" />
              {isTherapist ? "Moderador" : "Participante"}
            </span>
          </p>
          <button
            onClick={() => setEntrou(true)}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            <Video className="w-4 h-4" />
            Entrar na Sessão
          </button>
        </div>
      </div>
    );
  }

  // ─── TELA PRINCIPAL: sala Jitsi ───────────────────────────────────────────
  const isTherapist = !!user && agendamento?.userId === user.uid;

  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Video className="w-5 h-5 text-indigo-600" />
          <div>
            <h1 className="text-base font-semibold text-slate-800">Sala Virtual</h1>
            {paciente && (
              <p className="text-xs text-slate-500">
                Sessão com {isTherapist ? paciente.nomeCompleto : "seu terapeuta"}
              </p>
            )}
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${isTherapist ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
          <Users className="w-3 h-3" />
          {isTherapist ? "Moderador" : "Participante"}
        </span>
      </div>

      <div className="flex-1 min-h-0 bg-slate-900 relative">
        <div ref={jitsiContainerRef} style={{ position: "absolute", inset: 0 }} />
      </div>
    </div>
  );
}

export default function SessaoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    }>
      <SessaoPageInner />
    </Suspense>
  );
}
