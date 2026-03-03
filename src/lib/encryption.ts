/**
 * Criptografia para observações de pacientes (MVP)
 * 
 * NOTA DE SEGURANÇA: Esta é uma implementação simplificada com AES-CBC
 * para proteger as anotações do psicólogo sobre os pacientes.
 * A chave deriva do uid + APP_SECRET, permitindo acesso em qualquer dispositivo.
 */

import CryptoJS from "crypto-js";

const APP_SECRET = process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "clinica-psi-mvp";

// ─── Criptografa texto ────────────────────────────────────────────────────────
export function encryptText(plainText: string, uid: string): {
  ciphertext: string;
  iv: string;
} {
  const key = CryptoJS.SHA256(APP_SECRET + uid).toString();
  const iv  = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(
    plainText,
    CryptoJS.enc.Hex.parse(key),
    { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
  );
  return {
    ciphertext: encrypted.toString(),
    iv:         iv.toString(),
  };
}

// ─── Descriptografa texto ─────────────────────────────────────────────────────
export function decryptText(ciphertext: string, iv: string, uid: string): string {
  try {
    const key = CryptoJS.SHA256(APP_SECRET + uid).toString();
    const decrypted = CryptoJS.AES.decrypt(
      ciphertext,
      CryptoJS.enc.Hex.parse(key),
      {
        iv:      CryptoJS.enc.Hex.parse(iv),
        mode:    CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch {
    return "[Erro ao descriptografar]";
  }
}

// ─── Hash de CPF (one-way, para busca) ────────────────────────────────────────
export function hashCPF(cpf: string): string {
  const stripped = cpf.replace(/\D/g, "");
  return CryptoJS.SHA256(APP_SECRET + stripped).toString();
}
