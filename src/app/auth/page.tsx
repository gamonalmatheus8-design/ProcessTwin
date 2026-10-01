import Link from "next/link";
import { AuthForm } from "@/features/auth/auth-form";
import { safeAuthNext } from "@/features/auth/redirect";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_confirmation: "Link de confirmação inválido ou incompleto.",
  confirmation_failed: "Não foi possível confirmar o e-mail. O link pode ter expirado.",
  session_failed: "O e-mail foi confirmado, mas a sessão não pôde ser iniciada.",
  onboarding_failed: "A conta foi confirmada, mas o workspace inicial não pôde ser preparado.",
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const initialMode = params.mode === "signup" ? "signup" : "login";
  const initialMessage = params.error ? ERROR_MESSAGES[params.error] ?? "" : "";

  return (
    <main className="auth-page">
      <div className="auth-shell pt-auth-enterprise">
        <section className="pt-auth-visual">
          <Link className="pt-home-wordmark" href="/">ProcessTwin</Link>
          <div className="pt-auth-copy-simple">
            <span className="pt-section-label">Plataforma de análise de processos</span>
            <h1>Dados operacionais, processo reconstruído e análise em um único workspace.</h1>
            <p>
              Importe eventos, acompanhe fontes de dados e investigue gargalos
              com o mesmo modelo de processo.
            </p>
          </div>
          <p className="pt-auth-security-note">
            Workspaces isolados por organização e acesso autenticado.
          </p>
        </section>

        <section className="pt-auth-panel">
          <AuthForm
            initialMode={initialMode}
            initialMessage={initialMessage}
            nextPath={safeAuthNext(params.next)}
          />
          <Link className="auth-demo-link" href="/demo/center">
            Ver demonstração do produto
          </Link>
        </section>
      </div>
    </main>
  );
}
