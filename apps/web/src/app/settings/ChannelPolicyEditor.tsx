"use client";
import { useEffect, useMemo, useState } from "react";
import type { ChannelPolicy } from "@capsule/db";

type ChannelSummary = {
  id: string;
  name: string;
  isPrivate: boolean;
  isArchived: boolean;
  isMember: boolean;
};

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; channels: ChannelSummary[]; policy: ChannelPolicy }
  | { kind: "error"; message: string };

export function ChannelPolicyEditor({ initialPolicy }: { initialPolicy: ChannelPolicy }) {
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const [mode, setMode] = useState<ChannelPolicy["mode"]>(initialPolicy.mode);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialPolicy.channels));
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.kind === "loaded") {
      setMode(state.policy.mode);
      setSelected(new Set(state.policy.channels));
    }
  }, [state]);

  async function loadChannels() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/workspace/channels");
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
      }
      const data = await res.json();
      setState({ kind: "loaded", channels: data.channels, policy: data.policy });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Failed to load" });
    }
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/workspace/channel-policy", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, channels: Array.from(selected) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const filteredChannels = useMemo(() => {
    if (state.kind !== "loaded") return [];
    const q = filter.trim().toLowerCase();
    return q
      ? state.channels.filter((c) => c.name.toLowerCase().includes(q))
      : state.channels;
  }, [state, filter]);

  const modeDescription = {
    none: "No restrictions. Any channel the bot can see is allowed.",
    blocklist: "Selected channels are blocked. All other channels are allowed.",
    allowlist: "Only selected channels are allowed. All others are blocked.",
  }[mode];

  return (
    <div>
      <fieldset className="space-y-2">
        <legend className="text-small font-medium text-ink">Policy mode</legend>
        {(["none", "blocklist", "allowlist"] as const).map((m) => (
          <label key={m} className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="policy-mode"
              checked={mode === m}
              onChange={() => setMode(m)}
              className="mt-1 accent-[var(--accent)]"
            />
            <div>
              <span className="text-body font-medium capitalize">{m}</span>
              <span className="block text-small text-muted">
                {m === "none" && "No restrictions"}
                {m === "blocklist" && "Block specific channels"}
                {m === "allowlist" && "Only allow specific channels"}
              </span>
            </div>
          </label>
        ))}
      </fieldset>

      <p className="mt-4 rounded-card bg-paper p-3 text-small text-muted">{modeDescription}</p>

      {mode !== "none" && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-small font-medium text-ink">
              {selected.size} channel{selected.size === 1 ? "" : "s"} selected
            </h3>
            {state.kind !== "loaded" && (
              <button
                onClick={loadChannels}
                disabled={state.kind === "loading"}
                className="btn-ghost text-small"
              >
                {state.kind === "loading" ? "Loading…" : "Load channels from Slack"}
              </button>
            )}
          </div>

          {state.kind === "error" && (
            <p className="mt-3 rounded-card bg-alert-soft p-3 text-small text-alert">
              {state.message}
            </p>
          )}

          {state.kind === "loaded" && (
            <>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search channels…"
                className="mt-3 w-full rounded-card border border-line bg-surface px-3 py-2 text-small focus:border-accent focus:outline-none"
              />
              <div className="mt-3 max-h-80 overflow-y-auto rounded-card border border-line bg-paper">
                {filteredChannels.length === 0 ? (
                  <p className="p-4 text-small text-muted">No channels matched.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {filteredChannels.map((c) => {
                      const isSelected = selected.has(c.id);
                      return (
                        <li key={c.id}>
                          <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                const next = new Set(selected);
                                if (isSelected) next.delete(c.id);
                                else next.add(c.id);
                                setSelected(next);
                              }}
                              className="h-4 w-4 accent-[var(--accent)]"
                            />
                            <span className="text-small flex-1">
                              <span className="text-muted">{c.isPrivate ? "🔒" : "#"}</span>
                              <span className="ml-1 font-medium">{c.name}</span>
                              {c.isArchived && (
                                <span className="ml-2 pill bg-line/60 text-xs">archived</span>
                              )}
                              {!c.isMember && !c.isArchived && (
                                <span className="ml-2 pill bg-line/60 text-xs">bot not added</span>
                              )}
                            </span>
                            <span className="font-mono text-xs text-muted">{c.id}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <p className="mt-2 text-xs text-muted">
                Showing {filteredChannels.length} of {state.channels.length} channels.
              </p>
            </>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="btn-primary px-5 py-2 text-body disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save policy"}
        </button>
        {saved && <span className="text-small text-sealed">Saved</span>}
      </div>
    </div>
  );
}
