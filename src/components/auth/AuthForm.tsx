"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AuthFormProps {
  onSuccess?: (message: string) => void;
  initialMode?: "login" | "signup";
}

const INPUT =
  "w-full h-[50px] px-4 rounded-[14px] bg-bg border border-s2 text-base text-tx placeholder:text-mu/70 outline-none focus:border-ac transition-colors";
const LABEL = "flex flex-col gap-1.5 text-[13px] font-medium text-mu";

export function AuthForm({ onSuccess, initialMode = "login" }: AuthFormProps) {
  const [isSignUp, setIsSignUp] = useState(initialMode === "signup");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          // Trigger `handle_new_user` (supabase/schema.sql) creates the profile from this.
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          setErrorMsg(error.message);
        } else if (data.session) {
          setSuccessMsg("Konto utworzone pomyślnie!");
          if (onSuccess) onSuccess("Konto utworzone pomyślnie!");
        } else {
          setSuccessMsg("Konto utworzone! Sprawdź email, aby potwierdzić rejestrację.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setErrorMsg(error.message);
        } else {
          setSuccessMsg("Zalogowano pomyślnie!");
          if (onSuccess) onSuccess("Zalogowano pomyślnie!");
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Wystąpił nieoczekiwany błąd.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      // On success the browser is redirected to Google, so there is nothing more to do here.
      if (error) setErrorMsg(error.message);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Wystąpił nieoczekiwany błąd.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-extrabold tracking-[-.03em]">
          {isSignUp ? "Utwórz konto w Katalogu" : "Zaloguj się do Katalogu"}
        </h2>
        <p className="text-sm text-mu">
          {isSignUp
            ? "Zacznij bezpiecznie katalogować swoje zbiory"
            : "Zarządzaj swoją kolekcją w chmurze"}
        </p>
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="h-[54px] rounded-2xl bg-bg border border-s2 text-tx text-[17px] font-semibold disabled:opacity-50 transition-opacity"
      >
        Kontynuuj z Google
      </button>
      <div className="flex items-center gap-3 text-xs text-mu" aria-hidden="true">
        <span className="flex-1 h-px bg-s2" />
        lub
        <span className="flex-1 h-px bg-s2" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignUp && (
          <label htmlFor="auth-display-name" className={LABEL}>
            Nazwa wyświetlana
            <input
              id="auth-display-name"
              type="text"
              required
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jak mają Cię widzieć inni"
              className={INPUT}
            />
          </label>
        )}

        <label htmlFor="auth-email" className={LABEL}>
          Adres e-mail
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="twoj@email.pl"
            className={INPUT}
          />
        </label>

        <label htmlFor="auth-password" className={LABEL}>
          Hasło
          <input
            id="auth-password"
            type="password"
            required
            minLength={6}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={INPUT}
          />
        </label>

        {errorMsg && (
          <div role="alert" className="p-3 rounded-[14px] bg-rose-500/10 border border-rose-500/25 text-rose-400 text-sm">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div role="status" className="p-3 rounded-[14px] bg-ac/10 border border-ac/30 text-ac text-sm">
            {successMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-[54px] mt-1 rounded-2xl bg-ac text-act text-[17px] font-semibold disabled:opacity-50 transition-opacity"
        >
          {loading ? "Przetwarzanie..." : isSignUp ? "Zarejestruj się" : "Zaloguj się"}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className="p-1 text-sm text-mu"
        >
          {isSignUp ? "Masz już konto? Zaloguj się" : "Nie masz konta? Zarejestruj się"}
        </button>
      </form>
    </div>
  );
}
