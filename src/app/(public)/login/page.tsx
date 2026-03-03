"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Brain, Mail, Lock, Eye, EyeOff, Loader2, Chrome } from "lucide-react";
import {
  loginWithEmail,
  registerWithEmail,
  loginWithGoogle,
  resetPassword,
} from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

// ─── Schemas ────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

const registerSchema = z.object({
  displayName: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email:       z.string().email("E-mail inválido"),
  password:    z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
  confirm:     z.string(),
}).refine((d) => d.password === d.confirm, {
  message: "As senhas não coincidem",
  path:    ["confirm"],
});

type LoginData    = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;

type Tab = "login" | "register" | "reset";

// ─── Componente interno (usa useSearchParams) ─────────────────────────────────
function LoginContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirect     = searchParams.get("redirect") ?? "/dashboard";

  const [tab,           setTab]           = useState<Tab>("login");
  const [showPassword,  setShowPassword]  = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [resetEmail,    setResetEmail]    = useState("");
  const [resetSent,     setResetSent]     = useState(false);

  // ─── Forms ────────────────────────────────────────────────────────────────
  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  });
  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────
  async function onLogin(data: LoginData) {
    try {
      await loginWithEmail(data.email, data.password);
      toast.success("Bem-vindo de volta!");
      router.replace(redirect);
    } catch (err: unknown) {
      const msg = firebaseErrorMsg(err);
      toast.error(msg);
    }
  }

  async function onRegister(data: RegisterData) {
    try {
      await registerWithEmail(data.email, data.password, data.displayName);
      toast.success("Conta criada! Bem-vindo à Clínica Psi.");
      router.replace(redirect);
    } catch (err: unknown) {
      toast.error(firebaseErrorMsg(err));
    }
  }

  async function onGoogleLogin() {
    setLoadingGoogle(true);
    try {
      await loginWithGoogle();
      toast.success("Autenticado com Google!");
      router.replace(redirect);
    } catch (err: unknown) {
      toast.error(firebaseErrorMsg(err));
    } finally {
      setLoadingGoogle(false);
    }
  }

  async function onResetPassword() {
    if (!resetEmail) return toast.error("Informe seu e-mail.");
    try {
      await resetPassword(resetEmail);
      setResetSent(true);
    } catch (err: unknown) {
      toast.error(firebaseErrorMsg(err));
    }
  }

  return (
    <div className="min-h-dvh flex">
      {/* ── Ilustração lateral (desktop) ── */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-primary-500 to-primary-700 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative z-10 text-center text-white max-w-sm">
          <div className="w-20 h-20 rounded-3xl bg-white/20 flex items-center justify-center mx-auto mb-8">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-heading font-bold mb-4 text-white">
            Clínica Psi
          </h1>
          <p className="text-primary-100 text-lg leading-relaxed">
            Plataforma completa para gestão e telepsicologia. Acolhedor, seguro e em conformidade com a LGPD.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            {[
              { num: "CFP 09/2024",  label: "Conformidade" },
              { num: "LGPD",         label: "Protegido" },
              { num: "E2EE",         label: "Criptografado" },
            ].map((item) => (
              <div key={item.label} className="bg-white/15 rounded-2xl p-3">
                <p className="font-bold text-sm">{item.num}</p>
                <p className="text-primary-200 text-xs mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Formulário ── */}
      <div className="flex-1 flex items-start justify-center p-6 bg-surface overflow-y-auto">
        <div className="w-full max-w-md animate-slide-up py-8 lg:py-16">
          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-xl text-primary-700">Clínica Psi</span>
          </div>

          {/* Abas */}
          {tab !== "reset" && (
            <div className="flex bg-slate-100 rounded-2xl p-1 mb-8">
              {(["login", "register"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-sm font-semibold transition-all",
                    tab === t
                      ? "bg-white text-primary-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {t === "login" ? "Entrar" : "Criar Conta"}
                </button>
              ))}
            </div>
          )}

          {/* ── Tab: Login ── */}
          {tab === "login" && (
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-5">
              <div>
                <h2 className="text-2xl font-heading font-bold text-slate-800">Bem-vindo de volta</h2>
                <p className="text-slate-500 text-sm mt-1">Acesse sua área com segurança</p>
              </div>

              {/* Google */}
              <button
                type="button"
                onClick={onGoogleLogin}
                disabled={loadingGoogle}
                className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-xl py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                {loadingGoogle
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Chrome className="w-4 h-4 text-blue-500" />
                }
                Continuar com Google
              </button>

              <div className="relative flex items-center gap-3">
                <div className="flex-1 border-t border-slate-200" />
                <span className="text-xs text-slate-400 font-medium">ou</span>
                <div className="flex-1 border-t border-slate-200" />
              </div>

              {/* Email */}
              <InputField
                label="E-mail"
                type="email"
                icon={<Mail className="w-4 h-4" />}
                placeholder="seu@email.com"
                error={loginForm.formState.errors.email?.message}
                {...loginForm.register("email")}
              />

              {/* Senha */}
              <div>
                <InputField
                  label="Senha"
                  type={showPassword ? "text" : "password"}
                  icon={<Lock className="w-4 h-4" />}
                  placeholder="••••••••"
                  error={loginForm.formState.errors.password?.message}
                  suffix={
                    <button type="button" onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  {...loginForm.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setTab("reset")}
                  className="text-xs text-primary-600 hover:underline mt-1 ml-auto block"
                >
                  Esqueci minha senha
                </button>
              </div>

              <SubmitButton loading={loginForm.formState.isSubmitting}>
                Entrar
              </SubmitButton>
            </form>
          )}

          {/* ── Tab: Registro ── */}
          {tab === "register" && (
            <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-5">
              <div>
                <h2 className="text-2xl font-heading font-bold text-slate-800">Crie sua conta</h2>
                <p className="text-slate-500 text-sm mt-1">Comece gratuitamente hoje</p>
              </div>

              <button
                type="button"
                onClick={onGoogleLogin}
                disabled={loadingGoogle}
                className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-xl py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                {loadingGoogle
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Chrome className="w-4 h-4 text-blue-500" />
                }
                Registrar com Google
              </button>

              <div className="relative flex items-center gap-3">
                <div className="flex-1 border-t border-slate-200" />
                <span className="text-xs text-slate-400 font-medium">ou</span>
                <div className="flex-1 border-t border-slate-200" />
              </div>

              <InputField
                label="Nome completo"
                type="text"
                placeholder="Dr(a). Seu Nome"
                error={registerForm.formState.errors.displayName?.message}
                {...registerForm.register("displayName")}
              />
              <InputField
                label="E-mail profissional"
                type="email"
                icon={<Mail className="w-4 h-4" />}
                placeholder="seu@email.com"
                error={registerForm.formState.errors.email?.message}
                {...registerForm.register("email")}
              />
              <InputField
                label="Senha"
                type={showPassword ? "text" : "password"}
                icon={<Lock className="w-4 h-4" />}
                placeholder="Mínimo 8 caracteres"
                error={registerForm.formState.errors.password?.message}
                suffix={
                  <button type="button" onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                {...registerForm.register("password")}
              />
              <InputField
                label="Confirmar senha"
                type={showPassword ? "text" : "password"}
                icon={<Lock className="w-4 h-4" />}
                placeholder="Repita a senha"
                error={registerForm.formState.errors.confirm?.message}
                {...registerForm.register("confirm")}
              />

              <p className="text-xs text-slate-400">
                Ao criar sua conta, você concorda com os{" "}
                <a href="#" className="text-primary-600 hover:underline">Termos de Uso</a> e a{" "}
                <a href="#" className="text-primary-600 hover:underline">Política de Privacidade</a>.
              </p>

              <SubmitButton loading={registerForm.formState.isSubmitting}>
                Criar Conta Gratuita
              </SubmitButton>
            </form>
          )}

          {/* ── Tab: Reset ── */}
          {tab === "reset" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-heading font-bold text-slate-800">Redefinir senha</h2>
                <p className="text-slate-500 text-sm mt-1">Enviaremos um link para o seu e-mail</p>
              </div>

              {resetSent ? (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
                  <p className="text-green-700 font-semibold">E-mail enviado! ✓</p>
                  <p className="text-green-600 text-sm mt-1">Verifique sua caixa de entrada.</p>
                </div>
              ) : (
                <>
                  <InputField
                    label="E-mail cadastrado"
                    type="email"
                    icon={<Mail className="w-4 h-4" />}
                    placeholder="seu@email.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  />
                  <button
                    onClick={onResetPassword}
                    className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 rounded-xl transition-colors"
                  >
                    Enviar link de redefinição
                  </button>
                </>
              )}

              <button
                onClick={() => { setTab("login"); setResetSent(false); }}
                className="text-sm text-slate-500 hover:text-primary-600 transition-colors"
              >
                ← Voltar ao login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página exportada com Suspense (obrigatório para useSearchParams) ─────────
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh flex items-center justify-center bg-[var(--color-surface)]">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────
interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label:  string;
  error?: string;
  icon?:  React.ReactNode;
  suffix?: React.ReactNode;
}

function InputField({ label, error, icon, suffix, className, ...props }: InputFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="relative flex items-center">
        {icon && (
          <span className="absolute left-3 text-slate-400 pointer-events-none">{icon}</span>
        )}
        <input
          className={cn(
            "w-full rounded-xl border border-slate-200 bg-white",
            "py-2.5 text-sm text-slate-800 placeholder:text-slate-400",
            "focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent",
            "transition-shadow",
            icon   ? "pl-10 pr-4" : "px-4",
            suffix ? "pr-10" : "",
            error  ? "border-red-400 focus:ring-red-300" : "",
            className
          )}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-slate-400 cursor-pointer">{suffix}</span>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function SubmitButton({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={cn(
        "w-full bg-primary-500 hover:bg-primary-600 text-white",
        "font-semibold py-3 rounded-xl transition-all",
        "flex items-center justify-center gap-2",
        "shadow-sm hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
      )}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

// ─── Mapeamento de erros Firebase ─────────────────────────────────────────────
function firebaseErrorMsg(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/user-not-found":       "E-mail não encontrado.",
    "auth/wrong-password":       "Senha incorreta.",
    "auth/email-already-in-use": "Este e-mail já está em uso.",
    "auth/weak-password":        "Senha fraca. Use ao menos 8 caracteres.",
    "auth/invalid-email":        "Formato de e-mail inválido.",
    "auth/too-many-requests":    "Muitas tentativas. Aguarde alguns minutos.",
    "auth/popup-closed-by-user": "Janela do Google fechada. Tente novamente.",
    "auth/invalid-credential":   "Credenciais inválidas. Verifique e-mail e senha.",
  };
  return map[code] ?? "Erro inesperado. Tente novamente.";
}
