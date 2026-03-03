import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  User,
  UserCredential,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./config";
import { COLLECTIONS } from "./collections";
import type { UserFirestore } from "@/types/firestore";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// ─── Login com Email/Senha ───────────────────────────────────────────────────
export async function loginWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

// ─── Registro com Email/Senha ────────────────────────────────────────────────
export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });
  await createUserDocument(credential.user, "psicologo");
  return credential;
}

// ─── Login com Google ────────────────────────────────────────────────────────
export async function loginWithGoogle(): Promise<UserCredential> {
  const credential = await signInWithPopup(auth, googleProvider);
  await createUserDocument(credential.user, "psicologo");
  return credential;
}

// ─── Logout ──────────────────────────────────────────────────────────────────
export async function logout(): Promise<void> {
  return signOut(auth);
}

// ─── Reset de Senha ──────────────────────────────────────────────────────────
export async function resetPassword(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email);
}

// ─── Cria documento do usuário no Firestore (se não existir) ─────────────────
export async function createUserDocument(
  user: User,
  role: UserFirestore["role"] = "psicologo"
): Promise<void> {
  const ref = doc(db, COLLECTIONS.USERS, user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userData: any = {
      email:                   user.email ?? "",
      displayName:             user.displayName,
      photoURL:                user.photoURL,
      role,
      clinicaId:               user.uid,
      crp:                     null,
      crpUF:                   null,
      crpAtivo:                false,
      miniCV:                  null,
      abordagem:               [],
      especialidades:          [],
      valorSessao:             null,
      duracaoSessao:           50,
      fusoHorario:             "America/Sao_Paulo",
      notificacaoWhatsapp:     false,
      notificacaoEmail:        true,
      telefone:                null,
      createdAt:               serverTimestamp(),
      updatedAt:               serverTimestamp(),
    };
    await setDoc(ref, userData);
  }
}

// ─── Busca dados do usuário no Firestore ─────────────────────────────────────
export async function getUserDocument(uid: string): Promise<UserFirestore | null> {
  const ref  = doc(db, COLLECTIONS.USERS, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as UserFirestore;
}
