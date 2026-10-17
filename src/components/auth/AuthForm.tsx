"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AuthFormProps {
  onSuccess?: (message: string) => void;
  initialMode?: "login" | "signup";
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48" className="flex-none">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46Z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18A13.98 13.98 0 0 1 10.9 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7Z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07Z"
      />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 384 512" fill="currentColor" className="flex-none -mt-0.5">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

const OAUTH_BUTTON =
  "h-[54px] rounded-2xl bg-bg border border-s2 text-tx text-[17px] font-semibold disabled:opacity-50 transition-opacity flex items-center justify-center gap-2.5";

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

  const handleOAuth = async (provider: "google" | "apple") => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      // On success the browser is redirected to the provider, so there is nothing more to do here.
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

      <button type="button" onClick={() => handleOAuth("google")} disabled={loading} className={OAUTH_BUTTON}>
        <GoogleLogo />
        Kontynuuj z Google
      </button>
      <button type="button" onClick={() => handleOAuth("apple")} disabled={loading} className={OAUTH_BUTTON}>
        <AppleLogo />
        Kontynuuj z Apple
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
