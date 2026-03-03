import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JAAS_APP_ID = process.env.JAAS_APP_ID!;
const JAAS_KID = process.env.JAAS_KID!;
const JAAS_PRIVATE_KEY = process.env.JAAS_PRIVATE_KEY!;

interface JitsiTokenRequest {
  roomName: string;
  userName: string;
  userEmail?: string;
  userId: string;
  moderator?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: JitsiTokenRequest = await request.json();
    
    const { roomName, userName, userEmail, userId, moderator = false } = body;

    if (!roomName || !userName || !userId) {
      return NextResponse.json(
        { error: "roomName, userName e userId são obrigatórios" },
        { status: 400 }
      );
    }

    if (!JAAS_APP_ID || !JAAS_KID || !JAAS_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Credenciais JaaS não configuradas no servidor" },
        { status: 500 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + (2 * 60 * 60); // 2 horas de validade

    const payload = {
      aud: "jitsi",
      iss: "chat",
      iat: now,
      exp: exp,
      nbf: now - 10,
      sub: JAAS_APP_ID,
      moderator: moderator ? "true" : "false",
      context: {
        user: {
          id: userId, // ID único do Firebase para contagem do free tier
          name: userName,
          email: userEmail || "",
          moderator: moderator,
          "hidden-from-recorder": false,
        },
        features: {
          livestreaming: false,
          "outbound-call": false,
          "sip-outbound-call": false,
          transcription: false,
          recording: false,
        },
      },
      room: "*", // Permite salas do app JaaS (evita mismatch de formato)
    };

    const token = jwt.sign(payload, JAAS_PRIVATE_KEY.replace(/\\n/g, "\n"), {
      algorithm: "RS256",
      header: {
        kid: JAAS_KID,
        typ: "JWT",
        alg: "RS256",
      },
    });

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Erro ao gerar token Jitsi:", error);
    return NextResponse.json(
      { error: "Erro ao gerar token de acesso" },
      { status: 500 }
    );
  }
}
