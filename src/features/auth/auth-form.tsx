"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

type Props = {
  initialMode?: AuthMode;
  initialMessage?: string;
};

const normalizeError = (message: string, mode: AuthMode) => {
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (lower.includes("email rate limit") || lower.includes("rate limit")) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }
  if (lower.includes("password")) {
    return mode === "signup"
      ? "A senha não atende aos requisitos de segurança."
      : "Não foi possível autenticar com essa senha.";
  }

  return mode === "signup"
    ? "Não foi possível criar a conta. Verifique os dados e tente novamente."
    : "Não foi possível entrar. Tente novamente.";
};

export function AuthForm({
  initialMode = "login",
  initialMessage = "",
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState(initialMessage);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError("");
    setNotice("");
  };

  const bootstrapAccount = async (name?: string) => {
    const response = await fetch("/api/account/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationName: name }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(body.error ?? "Não foi possível preparar a conta.");
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Informe seu e-mail.");
      return;
    }

    if (mode === "signup") {
      if (fullName.trim().length < 2) {
        setError("Informe seu nome.");
        return;
      }
      if (organizationName.trim().length < 2) {
        setError("Informe o nome da sua organização ou projeto.");
        return;
      }
      if (password.length < 8) {
        setError("Use uma senha com pelo menos 8 caracteres.");
        return;
      }
      if (password !== passwordConfirmation) {
        setError("As senhas não coincidem.");
        return;
      }
    }

    setSubmitting(true);

    try {
      const supabase = createClient();

      if (mode === "login") {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (loginError) {
          setError(normalizeError(loginError.message, mode));
          return;
        }

        await bootstrapAccount();
        router.push("/processes/new");
        router.refresh();
        return;
      }

      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", "/processes/new");

      const { data, error: signupError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: callbackUrl.toString(),
          data: {
            full_name: fullName.trim(),
            organization_name: organizationName.trim(),
          },
        },
      });

      if (signupError) {
        setError(normalizeError(signupError.message, mode));
        return;
      }

      if (data.session) {
        await bootstrapAccount(organizationName.trim());
        router.push("/processes/new");
        router.refresh();
        return;
      }

      setNotice(
        "Conta criada. Verifique seu e-mail para confirmar o cadastro e concluir o acesso.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível concluir a autenticação.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-card">
      <div className="auth-tabs" role="tablist" aria-label="Autenticação">
        <button
          className={mode === "login" ? "active" : ""}
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          onClick={() => switchMode("login")}
        >
          Entrar
        </button>
        <button
          className={mode === "signup" ? "active" : ""}
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          onClick={() => switchMode("signup")}
        >
          Criar conta
        </button>
      </div>

      <div className="auth-copy">
        <span className="eyebrow">
          {mode === "signup" ? "Novo workspace" : "Acesso seguro"}
        </span>
        <h1>{mode === "signup" ? "Crie sua conta" : "Entre no ProcessTwin"}</h1>
        <p>
          {mode === "signup"
            ? "Comece com uma organização própria e importe seu primeiro processo."
            : "Acesse seus processos, análises e simulações."}
        </p>
      </div>

      <form className="form-stack" onSubmit={submit}>
        {mode === "signup" && (
          <>
            <label>
              Seu nome
              <input
                autoComplete="name"
                maxLength={120}
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Ex.: Matheus"
              />
            </label>
            <label>
              Organização ou projeto
              <input
                autoComplete="organization"
                maxLength={120}
                required
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                placeholder="Ex.: Empresa Demo"
              />
            </label>
          </>
        )}

        <label>
          E-mail
          <input
            autoComplete="email"
            inputMode="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@empresa.com"
          />
        </label>

        <label>
          Senha
          <input
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={mode === "signup" ? 8 : undefined}
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === "signup" ? "Mínimo de 8 caracteres" : "Sua senha"}
          />
        </label>

        {mode === "signup" && (
          <label>
            Confirmar senha
            <input
              autoComplete="new-password"
              minLength={8}
              type="password"
              required
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              placeholder="Digite a senha novamente"
            />
          </label>
        )}

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="success-banner" role="status">
            {notice}
          </div>
        )}

        <button className="button auth-submit" disabled={submitting} type="submit">
          {submitting
            ? mode === "signup"
              ? "Criando conta…"
              : "Entrando…"
            : mode === "signup"
              ? "Criar minha conta"
              : "Entrar"}
        </button>
      </form>

      <p className="auth-footnote">
        {mode === "signup"
          ? "Ao criar a conta, o ProcessTwin prepara automaticamente seu workspace inicial."
          : "Ainda não tem conta? "}
        {mode === "login" && (
          <button
            className="inline-auth-action"
            type="button"
            onClick={() => switchMode("signup")}
          >
            Criar conta
          </button>
        )}
      </p>
    </section>
  );
}
