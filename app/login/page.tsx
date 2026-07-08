"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }

    setStatus("sent");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--sidebar-bg)",
        color: "var(--paper)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--sp-6)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ marginBottom: "var(--sp-10)" }}>
          <div
            className="flex items-center gap-3"
            style={{ marginBottom: "var(--sp-2)" }}
          >
            <span className="pulse-dot" />
            <span
              className="mono"
              style={{
                fontSize: "var(--fs-11)",
                letterSpacing: "var(--ls-widest)",
                textTransform: "uppercase",
                color: "var(--white-a60)",
              }}
            >
              Attomik HQ
            </span>
          </div>
          <h1
            style={{
              fontSize: "var(--text-4xl)",
              fontWeight: "var(--fw-heading)",
              letterSpacing: "var(--ls-tight)",
              color: "var(--paper)",
              lineHeight: 1.05,
            }}
          >
            Sign in.
          </h1>
          <p
            style={{
              marginTop: "var(--sp-3)",
              color: "var(--white-a60)",
              fontSize: "var(--text-base)",
            }}
          >
            We&rsquo;ll email you a magic link.
          </p>
        </div>

        {status === "sent" ? (
          <div
            className="alert alert-success"
            style={{
              background: "var(--accent-a10)",
              borderColor: "var(--accent-a40)",
              color: "var(--accent)",
            }}
          >
            <div>
              <div
                className="mono"
                style={{
                  fontSize: "var(--fs-11)",
                  letterSpacing: "var(--ls-widest)",
                  textTransform: "uppercase",
                  marginBottom: "var(--sp-1)",
                }}
              >
                Check your email
              </div>
              <div
                style={{
                  color: "var(--white-a80)",
                  fontSize: "var(--text-base)",
                }}
              >
                Magic link sent to <span className="mono">{email}</span>.
              </div>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex-col"
            style={{ gap: "var(--sp-4)" }}
          >
            <div className="form-group">
              <label
                htmlFor="email"
                className="form-label"
                style={{ color: "var(--white-a50)" }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@attomik.co"
                className="mono"
                style={{
                  background: "transparent",
                  color: "var(--paper)",
                  border: "1px solid var(--white-a20)",
                  fontSize: "var(--text-sm)",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={status === "sending"}
              className="btn btn-primary btn-lg w-full"
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>

            {error && (
              <div className="form-error mono" style={{ color: "var(--danger)" }}>
                {error}
              </div>
            )}
          </form>
        )}

        <div
          className="mono"
          style={{
            marginTop: "var(--sp-12)",
            fontSize: "var(--fs-10)",
            letterSpacing: "var(--ls-widest)",
            textTransform: "uppercase",
            color: "var(--white-a30)",
          }}
        >
          hq.attomik.co
        </div>
      </div>
    </main>
  );
}
