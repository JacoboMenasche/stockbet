"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";

interface EarningsEvent {
  id: string;
  quarter: string;
  reportDate: string | Date;
  releaseTime: string;
  company: { id: string; ticker: string; name: string; [key: string]: unknown };
  _count: { markets: number };
  [key: string]: unknown;
}

interface Company {
  id: string;
  ticker: string;
  name: string;
}

interface EarningsPanelProps {
  earnings: EarningsEvent[];
  companies: Company[];
}

export function EarningsPanel({ earnings, companies }: EarningsPanelProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("POST_MARKET");
  const [showCreate, setShowCreate] = useState(false);
  const [newCompanyId, setNewCompanyId] = useState("");
  const [newQuarter, setNewQuarter] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("POST_MARKET");
  const [loading, setLoading] = useState(false);

  async function handleUpdate(id: string) {
    setLoading(true);
    await fetch(`/api/admin/earnings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportDate: editDate, releaseTime: editTime }),
    });
    setEditingId(null);
    setLoading(false);
    router.refresh();
  }

  async function handleCreate() {
    if (!newCompanyId || !newQuarter || !newDate) return;
    setLoading(true);
    await fetch("/api/admin/earnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: newCompanyId,
        quarter: newQuarter,
        reportDate: newDate,
        releaseTime: newTime,
      }),
    });
    setShowCreate(false);
    setNewCompanyId("");
    setNewQuarter("");
    setNewDate("");
    setLoading(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
          Earnings Events
        </h2>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
        >
          {showCreate ? "Cancel" : "Add Earnings"}
        </button>
      </div>

      {showCreate && (
        <div
          className="rounded-xl border p-4 mb-4 space-y-3"
          style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
        >
          <div className="grid grid-cols-2 gap-3">
            <select
              value={newCompanyId}
              onChange={(e) => setNewCompanyId(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <option value="">Select company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.ticker} — {c.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Quarter (e.g. Q2-2026)"
              value={newQuarter}
              onChange={(e) => setNewQuarter(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <select
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <option value="POST_MARKET">Post-market</option>
              <option value="PRE_MARKET">Pre-market</option>
            </select>
          </div>
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
              {["Ticker", "Quarter", "Report Date", "Release", "Markets", ""].map((h) => (
                <th key={h} className="pb-3 text-left font-normal" style={{ color: "rgba(255,255,255,0.35)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {earnings.map((e) => (
              <tr key={e.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td className="py-3 pr-4 text-white font-medium">{e.company.ticker}</td>
                <td className="py-3 pr-4" style={{ color: "rgba(255,255,255,0.5)" }}>{e.quarter}</td>
                <td className="py-3 pr-4">
                  {editingId === e.id ? (
                    <input
                      type="date"
                      value={editDate}
                      onChange={(ev) => setEditDate(ev.target.value)}
                      className="rounded px-2 py-1 text-xs text-white outline-none"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  ) : (
                    <span className="text-white">{formatDate(new Date(e.reportDate))}</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  {editingId === e.id ? (
                    <select
                      value={editTime}
                      onChange={(ev) => setEditTime(ev.target.value)}
                      className="rounded px-2 py-1 text-xs text-white outline-none"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      <option value="POST_MARKET">Post</option>
                      <option value="PRE_MARKET">Pre</option>
                    </select>
                  ) : (
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>
                      {e.releaseTime === "PRE_MARKET" ? "Pre" : "Post"}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 tabular" style={{ color: "rgba(255,255,255,0.5)" }}>{e._count.markets}</td>
                <td className="py-3 text-right">
                  {editingId === e.id ? (
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => handleUpdate(e.id)}
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
                        setEditingId(e.id);
                        setEditDate(new Date(e.reportDate).toISOString().slice(0, 10));
                        setEditTime(e.releaseTime);
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
