"use client";
import { useState } from "react";

export function DeleteAccountForm() {
  const [confirming, setConfirming] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (res.ok) {
      window.location.assign("/?deleted=1");
      return;
    }
    setError("Could not delete the account. Try again or email support.");
    setBusy(false);
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="btn-ghost text-alert hover:bg-alert-soft"
      >
        Delete account
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-small text-ink">
        This removes every capsule, message snapshot, and audit event scoped to your
        account. If you're the last user in your workspace, the workspace and its
        stored OAuth token are removed too. The action is immediate and irreversible.
      </p>
      <p className="text-small text-muted">
        Type <span className="font-mono text-ink">delete my data</span> to confirm.
      </p>
      <input
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        className="w-full rounded-card border border-line bg-surface px-3 py-2 font-mono text-small focus:border-alert focus:outline-none"
        placeholder="delete my data"
      />
      {error && <p className="text-small text-alert">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={busy || phrase.trim() !== "delete my data"}
          className="btn bg-alert text-white disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Delete account permanently"}
        </button>
        <button
          onClick={() => {
            setConfirming(false);
            setPhrase("");
          }}
          className="btn-ghost"
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
