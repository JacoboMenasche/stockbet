"use client";

import { useState } from "react";

interface SettingsPanelProps {
  initialPrompt: string;
}

export function SettingsPanel({ initialPrompt }: SettingsPanelProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "resolutionPrompt", value: prompt }),
    });
    setLoading(false);
    if (res.ok) {
      setMessage("Saved");
    } else {
      setMessage("Failed to save");
    }
  }

  return (
    <div>
      <h2
        className="text-sm font-medium mb-4"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        AI Prompt Template
      </h2>

      <div
        className="rounded-xl border p-4 space-y-3"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          backgroundColor: "rgba(255,255,255,0.02)",
        }}
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none resize-y"
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        />
        <p
          className="text-xs"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          Available variables: {"{question}"}, {"{metricType}"},{" "}
          {"{thresholdLabel}"}, {"{companyName}"}, {"{reportDate}"}
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
            style={{
              backgroundColor: "rgba(167,139,250,0.2)",
              color: "#a78bfa",
              border: "1px solid rgba(167,139,250,0.3)",
            }}
          >
            {loading ? "Saving..." : "Save"}
          </button>
          {message && (
            <span
              className="text-xs"
              style={{
                color: message === "Saved" ? "#4ade80" : "#f87171",
              }}
            >
              {message}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
