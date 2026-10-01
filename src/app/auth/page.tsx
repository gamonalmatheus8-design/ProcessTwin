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
      <div className="auth-shell">
        <section className="pt-auth-visual">
          <Link className="pt-home-brand" href="/">
            <span className="pt-brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <strong>ProcessTwin AI</strong>
          </Link>
          <div>
            <span className="eyebrow">Process intelligence, grounded in your data</span>
            <h1>Transforme eventos operacionais em decisões melhores.</h1>
            <p>
              Reconstrua o processo real, encontre onde o trabalho para e simule
              cenários com hipóteses explícitas antes de agir.
            </p>
          </div>
          <div className="pt-proof-line">
            <span><i /> Dados isolados por organização</span>
            <span><i /> Análises reproduzíveis</span>
          </div>
        </section>

        <section className="pt-auth-panel">
          <AuthForm
            initialMode={initialMode}
            initialMessage={initialMessage}
            nextPath={safeAuthNext(params.next)}
          />
          <Link className="auth-demo-link" href="/demo/center">
            Explorar uma demonstração antes de entrar →
          </Link>
        </section>
      </div>
    </main>
  );
}
