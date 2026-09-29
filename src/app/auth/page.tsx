import Link from "next/link";
import { AuthForm } from "@/features/auth/auth-form";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_confirmation: "Link de confirmação inválido ou incompleto.",
  confirmation_failed: "Não foi possível confirmar o e-mail. O link pode ter expirado.",
  session_failed: "O e-mail foi confirmado, mas a sessão não pôde ser iniciada.",
  onboarding_failed: "A conta foi confirmada, mas o workspace inicial não pôde ser preparado.",
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string }>;
}) {
  const params = await searchParams;
  const initialMode = params.mode === "signup" ? "signup" : "login";
  const initialMessage = params.error ? ERROR_MESSAGES[params.error] ?? "" : "";

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <Link className="auth-brand" href="/">
          <span className="eyebrow">ProcessTwin AI</span>
          <strong>Digital Twin de Processos</strong>
        </Link>
        <AuthForm
          initialMode={initialMode}
          initialMessage={initialMessage}
        />
        <Link className="text-link auth-demo-link" href="/demo">
          Ver demonstração sem conta →
        </Link>
      </div>
    </main>
  );
}
