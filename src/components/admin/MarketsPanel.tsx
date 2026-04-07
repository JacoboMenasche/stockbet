"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Market {
  id: string;
  question: string;
  metricType: string;
  threshold: unknown;
  thresholdLabel: string;
  yesPriceLatest: number;
  noPriceLatest: number;
  company: { ticker: string; [key: string]: unknown };
  earningsEvent: { id: string; quarter: string; [key: string]: unknown };
  [key: string]: unknown;
}

interface EarningsEvent {
  id: string;
  quarter: string;
  company: { id: string; ticker: string; name: string; [key: string]: unknown };
  [key: string]: unknown;
}

interface Company {
  id: string;
  ticker: string;
  name: string;
}

interface MarketsPanelProps {
  markets: Market[];
  earnings: EarningsEvent[];
  companies: Company[];
}

const METRIC_TYPES = ["EPS", "GROSS_MARGIN", "REVENUE_GROWTH", "OPERATING_MARGIN", "FREE_CASH_FLOW", "ARPU", "SUBSCRIBERS"];

export function MarketsPanel({ markets, earnings, companies }: MarketsPanelProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editThreshold, setEditThreshold] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newEventId, setNewEventId] = useState("");
  const [newMetric, setNewMetric] = useState("EPS");
  const [newThreshold, setNewThreshold] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpdate(id: string) {
    setLoading(true);
    await fetch(`/api/admin/markets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: editQuestion,
        threshold: parseFloat(editThreshold),
        thresholdLabel: editLabel,
      }),
    });
    setEditingId(null);
    setLoading(false);
    router.refresh();
  }

  async function handleCreate() {
    if (!newEventId || !newQuestion || !newThreshold || !newLabel) return;
    const event = earnings.find((e) => e.id === newEventId);
    if (!event) return;
    setLoading(true);
    await fetch("/api/admin/markets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: event.company.id,
        earningsEventId: newEventId,
        question: newQuestion,
        metricType: newMetric,
        threshold: parseFloat(newThreshold),
        thresholdLabel: newLabel,
      }),
    });
    setShowCreate(false);
    setNewEventId("");
    setNewQuestion("");
    setNewThreshold("");
    setNewLabel("");
    setLoading(false);
    router.refresh();
  }

  // suppress unused var warning
  void companies;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
          Open Markets
        </h2>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
        >
          {showCreate ? "Cancel" : "Create Market"}
        </button>
      </div>

      {showCreate && (
        <div
          className="rounded-xl border p-4 mb-4 space-y-3"
          style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
        >
          <div className="grid grid-cols-2 gap-3">
            <select
              value={newEventId}
              onChange={(e) => setNewEventId(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <option value="" style={{ backgroundColor: "#1a1a2e", color: "white" }}>Select earnings event</option>
              {earnings.map((e) => (
                <option key={e.id} value={e.id} style={{ backgroundColor: "#1a1a2e", color: "white" }}>{e.company.ticker} — {e.quarter}</option>
              ))}
            </select>
            <select
              value={newMetric}
              onChange={(e) => setNewMetric(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {METRIC_TYPES.map((m) => (
                <option key={m} value={m} style={{ backgroundColor: "#1a1a2e", color: "white" }}>{m}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Threshold (e.g. 47.3)"
              value={newThreshold}
              onChange={(e) => setNewThreshold(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <input
              type="text"
              placeholder="Label (e.g. > 47.3%)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>
          <input
            type="text"
            placeholder="Question (e.g. Will AAPL gross margin exceed 47.3%?)"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
            style={{ backgroundColor: "rgba(167,139,250,0.2)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
          >
            Create
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Ticker", "Metric", "Question", "Threshold", "YES/NO", ""].map((h) => (
                <th key={h} className="pb-3 text-left font-normal" style={{ color: "rgba(255,255,255,0.35)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {markets.map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td className="py-3 pr-4 text-white font-medium">{m.company.ticker}</td>
                <td className="py-3 pr-4" style={{ color: "rgba(255,255,255,0.5)" }}>{m.metricType}</td>
                <td className="py-3 pr-4">
                  {editingId === m.id ? (
                    <input
                      type="text"
                      value={editQuestion}
                      onChange={(e) => setEditQuestion(e.target.value)}
                      className="rounded px-2 py-1 text-xs text-white outline-none w-full"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  ) : (
                    <span className="text-white line-clamp-1 max-w-xs block">{m.question}</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  {editingId === m.id ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={editThreshold}
                        onChange={(e) => setEditThreshold(e.target.value)}
                        className="rounded px-2 py-1 text-xs text-white outline-none w-16"
                        style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="rounded px-2 py-1 text-xs text-white outline-none w-20"
                        style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    </div>
                  ) : (
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>{m.thresholdLabel}</span>
                  )}
                </td>
                <td className="py-3 pr-4 tabular">
                  <span style={{ color: "var(--color-yes)" }}>{m.yesPriceLatest}</span>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}> / </span>
                  <span style={{ color: "var(--color-no)" }}>{m.noPriceLatest}</span>
                </td>
                <td className="py-3 text-right">
                  {editingId === m.id ? (
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => handleUpdate(m.id)}
                        disabled={loading}
                        className="px-2 py-1 rounded text-xs font-medium disabled:opacity-40"
                        style={{ backgroundColor: "rgba(74,222,128,0.15)", color: "#4ade80" }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ color: "rgba(255,255,255,0.4)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(m.id);
                        setEditQuestion(m.question);
                        setEditThreshold(String(m.threshold));
                        setEditLabel(m.thresholdLabel);
                      }}
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
