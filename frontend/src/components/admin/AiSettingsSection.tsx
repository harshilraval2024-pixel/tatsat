"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { jfetch } from "@/lib/nrgs-api";
import { useConfirm } from "@/components/admin/useConfirm";

type AiSettings = {
  provider: "" | "off" | "gemini" | "openai";
  model: string;
  base_url: string;
  key_set: boolean;
  key_hint: string;
  key_readable: boolean;
  source: "admin" | "env" | "none";
  daily_limit: number;
  default_model: string;
  working_provider: string;
  chat_enabled: boolean;
  bill_reader_enabled: boolean;
};

type Preset = "env" | "off" | "gemini" | "openai" | "groq" | "custom";

const GROQ_URL = "https://api.groq.com/openai/v1";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "env", label: "Use the server's environment settings" },
  { id: "off", label: "Off (disable the AI features)" },
  { id: "gemini", label: "Google Gemini (free tier available)" },
  { id: "openai", label: "OpenAI" },
  { id: "groq", label: "Groq" },
  { id: "custom", label: "Other OpenAI-compatible service" },
];

const DEFAULT_MODELS: Record<Preset, string> = {
  env: "",
  off: "",
  gemini: "Automatic (newest Flash model)",
  openai: "gpt-4o-mini",
  groq: "",
  custom: "",
};

const label = "text-xs font-semibold uppercase tracking-wide text-muted";
const field =
  "focus-ring mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60";

function presetOf(s: AiSettings): Preset {
  if (s.provider === "") return "env";
  if (s.provider === "off") return "off";
  if (s.provider === "gemini") return "gemini";
  if (s.base_url.includes("groq.com")) return "groq";
  return s.base_url ? "custom" : "openai";
}

function providerOf(p: Preset): AiSettings["provider"] {
  if (p === "env") return "";
  if (p === "off") return "off";
  if (p === "gemini") return "gemini";
  return "openai";
}

function describe(s: AiSettings): string {
  const names: Record<string, string> = { gemini: "Google Gemini", openai: "an OpenAI-compatible service", fake: "the offline demo" };
  if (s.working_provider === "off") {
    return s.source === "env" ? "Not configured on the server. The AI features are off." : "Off. The AI features are hidden.";
  }
  const where = s.source === "admin" ? "settings saved here" : "the server's environment settings";
  return `On — using ${names[s.working_provider] ?? s.working_provider} (${where}).`;
}

export function AiSettingsSection() {
  const [saved, setSaved] = useState<AiSettings | null>(null);
  const [preset, setPreset] = useState<Preset>("env");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [limit, setLimit] = useState("");
  const [chatOn, setChatOn] = useState(false);
  const [billOn, setBillOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; detail?: string; model?: string } | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [modelsNote, setModelsNote] = useState<string | null>(null);
  const [findingModels, setFindingModels] = useState(false);
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();

  const apply = useCallback((s: AiSettings) => {
    setSaved(s);
    setPreset(presetOf(s));
    setModel(s.model);
    setBaseUrl(presetOf(s) === "groq" ? GROQ_URL : s.base_url);
    setLimit(s.source === "admin" || s.daily_limit !== 500 ? String(s.daily_limit) : "");
    setApiKey("");
    setChatOn(s.chat_enabled);
    setBillOn(s.bill_reader_enabled);
  }, []);

  useEffect(() => {
    jfetch<AiSettings>("/admin/ai-settings")
      .then(apply)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [apply]);

  if (!saved) {
    return err ? <p className="text-sm text-accent">{err}</p> : <p className="text-sm text-muted">Loading AI settings…</p>;
  }

  const needsKey = preset === "gemini" || preset === "openai" || preset === "groq" || preset === "custom";
  const effectiveBase = preset === "groq" ? GROQ_URL : preset === "custom" ? baseUrl.trim() : "";
  const dirty =
    providerOf(preset) !== saved.provider ||
    model.trim() !== saved.model ||
    (providerOf(preset) === "openai" && effectiveBase !== saved.base_url) ||
    apiKey.trim() !== "" ||
    chatOn !== saved.chat_enabled ||
    billOn !== saved.bill_reader_enabled ||
    (limit.trim() !== "" && Number(limit) !== saved.daily_limit);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!saved || busy) return;
    const lim = limit.trim() ? Number(limit) : null;
    if (lim !== null && (!Number.isInteger(lim) || lim < 1 || lim > 100000)) {
      setErr("Daily request limit must be a whole number between 1 and 100000.");
      return;
    }
    const ok = await askConfirm({
      title: "Save AI settings?",
      message:
        preset === "off"
          ? "The Solar Advisor chat and bill reader will be switched off for all visitors."
          : apiKey.trim()
            ? "The new API key will be stored encrypted and used for all visitors' AI requests. You will not be able to view it again."
            : "The AI provider settings will change immediately for all visitors.",
      confirmLabel: "Save AI settings",
    });
    if (!ok) return;
    setErr(null);
    setTestResult(null);
    setBusy(true);
    try {
      const next = await jfetch<AiSettings>("/admin/ai-settings", {
        method: "PUT",
        body: JSON.stringify({
          provider: providerOf(preset),
          model: model.trim(),
          base_url: effectiveBase,
          api_key: apiKey.trim() || null,
          clear_key: false,
          daily_limit: lim,
          chat_enabled: chatOn,
          bill_reader_enabled: billOn,
        }),
      });
      apply(next);
      toast.success("AI settings saved.");
    } catch (q) {
      setErr(q instanceof Error ? q.message : String(q));
    } finally {
      setBusy(false);
    }
  }

  async function removeKey() {
    if (!saved) return;
    const ok = await askConfirm({
      title: "Remove the saved API key?",
      message: "The AI features stop working until a new key is entered (unless the server has its own key configured).",
      confirmLabel: "Remove key",
      danger: true,
    });
    if (!ok) return;
    setErr(null);
    setBusy(true);
    try {
      const next = await jfetch<AiSettings>("/admin/ai-settings", {
        method: "PUT",
        body: JSON.stringify({
          provider: saved.provider,
          model: saved.model,
          base_url: saved.base_url,
          api_key: null,
          clear_key: true,
          daily_limit: saved.source === "admin" ? saved.daily_limit : null,
          chat_enabled: saved.chat_enabled,
          bill_reader_enabled: saved.bill_reader_enabled,
        }),
      });
      apply(next);
      toast.success("API key removed.");
    } catch (q) {
      setErr(q instanceof Error ? q.message : String(q));
    } finally {
      setBusy(false);
    }
  }

  async function findModels() {
    setFindingModels(true);
    setModelsNote(null);
    try {
      const r = await jfetch<{ models: string[]; recommended: string; message: string }>("/admin/ai-settings/models");
      setModels(r.models);
      setModelsNote(
        r.models.length
          ? `Found ${r.models.length} models you can use.` +
              (r.recommended ? ` Leave the field blank to use ${r.recommended} automatically, or pick one from the list.` : " Pick one from the list.")
          : r.message || "No models found.",
      );
    } catch (q) {
      setModelsNote(q instanceof Error ? q.message : String(q));
    } finally {
      setFindingModels(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    setErr(null);
    try {
      setTestResult(
        await jfetch<{ ok: boolean; message: string; detail?: string; model?: string }>("/admin/ai-settings/test", {
          method: "POST",
        }),
      );
    } catch (q) {
      setTestResult({ ok: false, message: q instanceof Error ? q.message : String(q) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      <div>
        <h2 className="font-display text-lg font-bold text-white">AI assistant (Solar Advisor &amp; bill reader)</h2>
        <p className="mt-2 text-sm text-muted">
          Connect an AI provider here instead of editing server settings. Get a free Gemini key at{" "}
          <a
            className="text-primary underline"
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
          >
            aistudio.google.com/apikey
          </a>
          . Each AI feature only works when its own box below is ticked <em>and</em> a provider with a key is
          working.
        </p>
      </div>

      <div
        role="status"
        className={`rounded-2xl border px-4 py-3 text-sm ${
          saved.working_provider === "off" ? "border-white/15 text-muted" : "border-primary/40 bg-primary/5 text-white"
        }`}
      >
        {describe(saved)}
        {!saved.key_readable ? (
          <span className="mt-1 block text-accent">
            The saved key can no longer be read (the server secret changed). Please enter the key again.
          </span>
        ) : null}
      </div>

      {err ? (
        <p role="alert" className="text-sm text-accent">
          {err}
        </p>
      ) : null}

      <form onSubmit={save} className="space-y-5 rounded-3xl border border-white/10 bg-black/10 p-5 sm:p-6" aria-busy={busy}>
        <fieldset className="rounded-2xl border border-white/10 p-4">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-muted">AI features</legend>
          <label className="flex items-start gap-3 text-sm text-white">
            <input
              type="checkbox"
              className="mt-1"
              checked={chatOn}
              disabled={busy}
              onChange={(e) => setChatOn(e.target.checked)}
            />
            <span>
              <strong>Ask AI chat</strong>
              <span className="block text-xs text-muted">
                Adds the &quot;Ask AI&quot; tab to the website chat. Visitors can ask about system size, cost and
                subsidy.
              </span>
            </span>
          </label>
          <label className="mt-4 flex items-start gap-3 text-sm text-white">
            <input
              type="checkbox"
              className="mt-1"
              checked={billOn}
              disabled={busy}
              onChange={(e) => setBillOn(e.target.checked)}
            />
            <span>
              <strong>Bill photo reader</strong>
              <span className="block text-xs text-muted">
                Adds &quot;Upload a bill photo&quot; to the Calculator. The AI reads the bill and fills the form.
              </span>
            </span>
          </label>
          <p className="mt-3 text-xs text-muted">Both are off until you tick them and press Save.</p>
        </fieldset>

        <div>
          <label className={label} htmlFor="ai-preset">
            Provider
          </label>
          <select
            id="ai-preset"
            className={field}
            value={preset}
            disabled={busy}
            onChange={(e) => {
              const p = e.target.value as Preset;
              setPreset(p);
              if (p === "groq") setBaseUrl(GROQ_URL);
              else if (p !== "custom") setBaseUrl("");
              setTestResult(null);
            }}
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {needsKey ? (
          <>
            <div>
              <label className={label} htmlFor="ai-key">
                API key
              </label>
              <input
                id="ai-key"
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                className={field}
                value={apiKey}
                disabled={busy}
                maxLength={400}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={saved.key_set ? `Saved (${saved.key_hint}) — leave blank to keep it` : "Paste your API key"}
              />
              <p className="mt-1 text-xs text-muted">
                Stored encrypted. It can be replaced or removed, but never viewed again.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="ai-model">
                  Model {preset === "groq" || preset === "custom" ? "(required)" : "(optional)"}
                </label>
                <input
                  id="ai-model"
                  list="ai-models"
                  className={field}
                  value={model}
                  disabled={busy}
                  maxLength={100}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={DEFAULT_MODELS[preset] || "e.g. a vision-capable model name"}
                />
                <datalist id="ai-models">
                  {models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>Needs image support for the bill reader.</span>
                  <button
                    type="button"
                    onClick={findModels}
                    disabled={findingModels || busy || dirty || !saved.key_set}
                    title={!saved.key_set ? "Save an API key first" : dirty ? "Save your changes first" : undefined}
                    className="rounded-full border border-primary/50 px-3 py-1 font-semibold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {findingModels ? "Searching…" : "Find available models"}
                  </button>
                </div>
                {modelsNote ? <p className="mt-1 text-xs text-white/80">{modelsNote}</p> : null}
              </div>
              <div>
                <label className={label} htmlFor="ai-limit">
                  Daily request limit
                </label>
                <input
                  id="ai-limit"
                  inputMode="numeric"
                  className={field}
                  value={limit}
                  disabled={busy}
                  maxLength={6}
                  onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="500"
                />
                <p className="mt-1 text-xs text-muted">Hard cap across all visitors, to protect your bill.</p>
              </div>
            </div>

            {preset === "custom" ? (
              <div>
                <label className={label} htmlFor="ai-base">
                  Base URL
                </label>
                <input
                  id="ai-base"
                  className={field}
                  value={baseUrl}
                  disabled={busy}
                  maxLength={300}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                />
                <p className="mt-1 text-xs text-muted">Must be a public https:// address.</p>
              </div>
            ) : null}
          </>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
          <button
            type="submit"
            disabled={busy || !dirty}
            className="focus-ring inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-bg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-bg border-t-transparent" aria-hidden />
                Saving…
              </>
            ) : (
              "Save AI settings"
            )}
          </button>
          <button
            type="button"
            onClick={runTest}
            disabled={testing || busy || dirty || saved.working_provider === "off"}
            title={dirty ? "Save your changes first, then test" : undefined}
            className="focus-ring inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-primary/60 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testing ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
                Testing…
              </>
            ) : (
              "Test connection"
            )}
          </button>
          {saved.key_set ? (
            <button
              type="button"
              onClick={removeKey}
              disabled={busy}
              className="rounded-full border border-accent/50 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              Remove saved key
            </button>
          ) : null}
          <span className={`text-xs ${dirty ? "text-primary" : "text-muted"}`}>
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
        </div>

        {testResult ? (
          <p
            role={testResult.ok ? "status" : "alert"}
            className={`text-sm ${testResult.ok ? "text-white" : "text-accent"}`}
          >
            {testResult.ok ? "✓ " : "✗ "}
            {testResult.message}
            {testResult.model ? <span className="mt-1 block text-xs text-muted">Model used: {testResult.model}</span> : null}
            {testResult.detail ? (
              <span className="mt-1 block text-xs text-muted">Provider said: {testResult.detail}</span>
            ) : null}
          </p>
        ) : null}
      </form>
    </div>
  );
}
