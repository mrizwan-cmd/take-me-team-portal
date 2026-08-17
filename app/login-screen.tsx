"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { GoogleGLogo, SvgIcon } from "./portal-ui";

const errorMessages: Record<string, string> = {
  access_denied: "Google sign-in was cancelled. You can try again whenever you are ready.",
  domain: "That account is not part of the Take Me Google Workspace. Use your @takeme.taxi email.",
  expired: "The sign-in request expired. Please start again.",
  setup: "Google company sign-in is waiting for administrator configuration.",
  failed: "Google sign-in could not be completed. Please try again or contact IT support.",
};

export default function LoginScreen({ offline = false }: { offline?: boolean }) {
  const [message, setMessage] = useState("");
  const [temporaryEnabled, setTemporaryEnabled] = useState(false);
  const [temporaryOpen, setTemporaryOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const reason = new URLSearchParams(window.location.search).get("login_error") || "";
      setMessage(errorMessages[reason] || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/temp-admin", { cache: "no-store" })
      .then(response => response.json())
      .then((result: { enabled?: boolean }) => { if (active) setTemporaryEnabled(Boolean(result.enabled)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const temporaryLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (offline || submitting) return;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/temp-admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json() as { error?: string; destination?: string };
      if (!response.ok || !result.destination) throw new Error(result.error || "Temporary sign-in could not be completed");
      window.location.assign(result.destination);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Temporary sign-in could not be completed");
      setSubmitting(false);
    }
  };

  return (
    <main className="login-screen">
      <section className="login-story" aria-label="Take Me Team Portal introduction">
        <div className="login-brand">
          <Image src="/take-me-logo-black.png" alt="Take Me" width={70} height={76} priority />
          <span>
            <b>Team Portal</b>
            <small>TAKE ME GROUP</small>
          </span>
        </div>
        <div className="login-promise">
          <p>ONE PLACE FOR THE WHOLE TEAM</p>
          <h1>Everything employees need, ready from day one.</h1>
          <p>Plan projects, manage shifts, submit requests, meet with Google Calendar and find company knowledge from any device.</p>
        </div>
        <div className="login-feature-grid">
          {[
            { icon: "projects", title: "Projects", desc: "Boards, tasks and delivery" },
            { icon: "calendar", title: "Google Calendar", desc: "Meetings and availability" },
            { icon: "requests", title: "Requests", desc: "Approvals and purchase orders" },
            { icon: "knowledge", title: "Company knowledge", desc: "Policies, files and guidance" }
          ].map(item => (
            <article key={item.title}>
              <i><SvgIcon name={item.icon} size={20} /></i>
              <span>
                <b>{item.title}</b>
                <small>{item.desc}</small>
              </span>
            </article>
          ))}
        </div>
        <p className="login-security">Protected for Take Me employees through Google Workspace</p>
      </section>
      <section className="login-entry" aria-label="Company sign in">
        <div className="login-card">
          <Image src="/take-me-logo-black.png" alt="Take Me" width={62} height={68} priority />
          <p className="eyebrow">TAKE ME TEAM PORTAL</p>
          <h2>Welcome to work.</h2>
          <p>Sign in using the Google account connected to your Take Me company email.</p>
          {message && <div className="login-message" role="alert">{message}</div>}
          {offline && <div className="login-message" role="status">You are offline. Reconnect before signing in.</div>}
          <a
            className={`google-login-button ${offline ? "disabled" : ""}`}
            aria-disabled={offline}
            tabIndex={offline ? -1 : undefined}
            onClick={event => { if (offline) event.preventDefault(); }}
            href="/api/auth/google/login?return_to=%2F"
          >
            <GoogleGLogo size={20} />
            <b>Continue with Google</b>
          </a>
          {temporaryEnabled && (
            <div className="temporary-admin-access">
              <div className="login-divider"><span>Temporary setup access</span></div>
              {!temporaryOpen ? (
                <button className="temporary-admin-toggle" type="button" onClick={() => setTemporaryOpen(true)}>
                  Sign in with admin username
                </button>
              ) : (
                <form className="temporary-admin-form" onSubmit={temporaryLogin}>
                  <label>
                    <span>Admin username</span>
                    <input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required maxLength={128} />
                  </label>
                  <label>
                    <span>Admin password</span>
                    <input autoComplete="current-password" type="password" value={password} onChange={event => setPassword(event.target.value)} required maxLength={256} />
                  </label>
                  <button type="submit" disabled={offline || submitting}>
                    {submitting ? "Signing in…" : "Open admin settings"}
                  </button>
                  <small>Temporary access expires automatically and is for initial setup only.</small>
                </form>
              )}
            </div>
          )}
          <small className="login-domain">Only verified <b>@takeme.taxi</b> Google Workspace accounts can enter.</small>
          <div className="login-assurance">
            <span>• No password storage</span>
            <span>• Company accounts only</span>
            <span>• Encrypted session</span>
          </div>
        </div>
        <p className="login-footnote">Need access? Contact your manager or Take Me IT support.</p>
      </section>
    </main>
  );
}
