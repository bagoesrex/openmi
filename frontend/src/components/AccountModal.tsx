import React, { useState, useEffect, useRef } from "react";
import type { Account, NewAccountInput, QrSessionResponse, QrPollStatus, TimingMode } from "../types";
import { X, ShieldAlert, QrCode, KeyRound, RefreshCw, CheckCircle2, Smartphone } from "lucide-react";
import { createQrSession, checkQrStatus, cancelQrSession } from "../lib/api";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: NewAccountInput) => Promise<void>;
  initialAccount?: Account | null;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialAccount,
}) => {
  const [activeTab, setActiveTab] = useState<"qr" | "manual">("qr");
  const [label, setLabel] = useState("");
  const [region, setRegion] = useState("global");
  const [cUserId, setCUserId] = useState("");
  const [serviceToken, setServiceToken] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(true);
  const [timingMode, setTimingMode] = useState<TimingMode>("asia");
  const [customTimings, setCustomTimings] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // QR Auth state
  const [qrSession, setQrSession] = useState<QrSessionResponse | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrStatus, setQrStatus] = useState<QrPollStatus>("WAITING");
  const [qrError, setQrError] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const startQrSession = async () => {
    stopPolling();
    if (qrSession?.sessionId) {
      cancelQrSession(qrSession.sessionId);
    }

    setQrLoading(true);
    setQrError(null);
    setQrStatus("WAITING");

    try {
      const session = await createQrSession();
      setQrSession(session);
      setQrLoading(false);

      // Start polling status
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await checkQrStatus(session.sessionId);
          setQrStatus(res.status);

          if (res.status === "SUCCESS") {
            stopPolling();
            if (res.cUserId) setCUserId(res.cUserId);
            if (res.serviceToken) setServiceToken(res.serviceToken);
            if (!label && res.cUserId) {
              setLabel(`Xiaomi-${res.cUserId.slice(-4)}`);
            }
          } else if (res.status === "EXPIRED" || res.status === "ERROR") {
            stopPolling();
            if (res.error) setQrError(res.error);
          }
        } catch (err: any) {
          // Keep polling unless session failed completely
        }
      }, 2000);
    } catch (err: any) {
      setQrLoading(false);
      setQrError(err.message || "Failed to initialize Xiaomi QR session");
      setQrStatus("ERROR");
    }
  };

  useEffect(() => {
    if (initialAccount) {
      setActiveTab("manual");
      setLabel(initialAccount.label);
      setRegion(initialAccount.region || "global");
      setCUserId(initialAccount.cUserId);
      setServiceToken(initialAccount.serviceToken);
      setDeviceId(initialAccount.deviceId || "");
      setProxyUrl(initialAccount.proxyUrl || "");
      setAutoApplyEnabled(initialAccount.autoApplyEnabled === 1);
      setTimingMode(initialAccount.timingMode || "asia");
      setCustomTimings(initialAccount.customTimings || "");
    } else {
      setActiveTab("qr");
      setLabel("");
      setRegion("global");
      setCUserId("");
      setServiceToken("");
      setDeviceId("");
      setProxyUrl("");
      setAutoApplyEnabled(true);
      setTimingMode("asia");
      setCustomTimings("");
    }
    setError(null);
    setQrSession(null);
    setQrError(null);
    setQrStatus("WAITING");

    if (isOpen && (!initialAccount || activeTab === "qr")) {
      startQrSession();
    }

    return () => {
      stopPolling();
      if (qrSession?.sessionId) {
        cancelQrSession(qrSession.sessionId);
      }
    };
  }, [initialAccount, isOpen]);

  const handleTabChange = (tab: "qr" | "manual") => {
    setActiveTab(tab);
    if (tab === "qr" && !qrSession && !qrLoading) {
      startQrSession();
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !cUserId.trim() || !serviceToken.trim()) {
      setError("Please fill in Label, cUserId, and serviceToken (or scan QR code).");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        label: label.trim(),
        region: region.trim(),
        cUserId: cUserId.trim(),
        serviceToken: serviceToken.trim(),
        deviceId: deviceId.trim() || null,
        proxyUrl: proxyUrl.trim() || null,
        autoApplyEnabled,
        timingMode,
        customTimings: timingMode === "custom" ? customTimings.trim() || null : null,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-3.5 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            {initialAccount ? "Edit Xiaomi Account" : "Register Xiaomi Account"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl mb-4 shrink-0 text-xs font-medium">
          <button
            type="button"
            onClick={() => handleTabChange("qr")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
              activeTab === "qr"
                ? "bg-white text-orange-600 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Scan QR Login</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("manual")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
              activeTab === "manual"
                ? "bg-white text-orange-600 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Manual Input</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 shrink-0">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab 1: QR Login View */}
        {activeTab === "qr" && (
          <div className="overflow-y-auto pr-1 flex flex-col items-center text-center space-y-4">
            <div className="w-full max-w-xs bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center">
              {qrLoading ? (
                <div className="w-48 h-48 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
                  <span className="text-xs">Generating Xiaomi QR code...</span>
                </div>
              ) : qrSession ? (
                <div className="relative">
                  <img
                    src={qrSession.qrUrl}
                    alt="Xiaomi Login QR Code"
                    className={`w-48 h-48 rounded-lg border border-slate-200 shadow-xs object-contain transition-opacity ${
                      qrStatus === "EXPIRED" ? "opacity-25 grayscale" : "opacity-100"
                    }`}
                  />
                  {qrStatus === "SUCCESS" && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-xs rounded-lg flex flex-col items-center justify-center gap-2 animate-in zoom-in-95">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-700">Scan Approved!</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-48 h-48 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <ShieldAlert className="w-8 h-8 text-rose-500" />
                  <span className="text-xs text-rose-600">{qrError || "Failed to load QR code"}</span>
                  <button
                    type="button"
                    onClick={startQrSession}
                    className="mt-2 text-xs font-medium text-orange-600 hover:text-orange-700 underline cursor-pointer"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Status Badge */}
              <div className="mt-3.5 w-full flex items-center justify-center">
                {qrStatus === "WAITING" && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    <span>Waiting for scan with Mi Account...</span>
                  </div>
                )}
                {qrStatus === "SCANNED" && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                    <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                    <span>Scanned! Tap &quot;Authorize&quot; on your phone</span>
                  </div>
                )}
                {qrStatus === "SUCCESS" && (
                  <div className="text-xs text-emerald-600 font-medium">
                    Account ID: <span className="font-mono font-bold">{cUserId}</span>
                  </div>
                )}
                {qrStatus === "EXPIRED" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-rose-600">QR Expired</span>
                    <button
                      type="button"
                      onClick={startQrSession}
                      className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium hover:underline cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Refresh
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Account Details Form underneath QR */}
            <form onSubmit={handleSubmit} className="w-full space-y-3 text-left text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Account Label <span className="text-orange-600">*</span>
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Personal Phone (Xiaomi 14)"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-xs sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Region <span className="text-orange-600">*</span>
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-xs sm:text-sm"
                  >
                    <option value="global">Global (sgp-api/global)</option>
                    <option value="id">Indonesia (sgp-api/id)</option>
                    <option value="ru">Russia (ru-api/ru)</option>
                    <option value="eu">Europe (ams-api/eu)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Device Model (Optional)
                  </label>
                  <input
                    type="text"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    placeholder="e.g. 23117PN0CG"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Execution Timing Profile
                </label>
                <select
                  value={timingMode}
                  onChange={(e) => setTimingMode(e.target.value as TimingMode)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-xs sm:text-sm font-medium"
                >
                  <option value="asia">⚡ Asia Burst (58.8s - 59.9s) [Recommended]</option>
                  <option value="europe">🌍 Europe Burst (58.7s - 59.8s)</option>
                  <option value="single">🎯 Single Shot (23:00:00 exact)</option>
                  <option value="custom">⚙️ Custom Offsets (JSON)</option>
                </select>
                {timingMode === "custom" && (
                  <input
                    type="text"
                    value={customTimings}
                    onChange={(e) => setCustomTimings(e.target.value)}
                    placeholder="e.g. [58.5, 59.0, 59.5, 59.9]"
                    className="mt-2 w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none pt-1">
                  <input
                    type="checkbox"
                    checked={autoApplyEnabled}
                    onChange={(e) => setAutoApplyEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="font-medium">Enable automatic apply at 23:00 WIB</span>
                </label>
              </div>

              <div className="pt-3.5 flex items-center justify-end gap-2.5 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[38px] px-4 py-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || qrStatus !== "SUCCESS"}
                  className="min-h-[38px] px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-medium rounded-lg shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  {saving ? "Saving..." : qrStatus === "SUCCESS" ? "Save Account" : "Scan QR to Continue"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Manual Input View */}
        {activeTab === "manual" && (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs overflow-y-auto pr-1">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Account Label <span className="text-orange-600">*</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Personal Phone (Xiaomi 14)"
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-xs sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Region <span className="text-orange-600">*</span>
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-xs sm:text-sm"
                >
                  <option value="global">Global (sgp-api/global)</option>
                  <option value="id">Indonesia (sgp-api/id)</option>
                  <option value="ru">Russia (ru-api/ru)</option>
                  <option value="eu">Europe (ams-api/eu)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  cUserId <span className="text-orange-600">*</span>
                </label>
                <input
                  type="text"
                  value={cUserId}
                  onChange={(e) => setCUserId(e.target.value)}
                  placeholder="Xiaomi Account ID"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-xs sm:text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                serviceToken <span className="text-orange-600">*</span>
              </label>
              <textarea
                value={serviceToken}
                onChange={(e) => setServiceToken(e.target.value)}
                placeholder="Paste captured serviceToken cookie here"
                rows={3}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono text-[11px] placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 leading-relaxed"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Extracted from browser cookies or via <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">bun run capture</code>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Device Model / ID (Optional)
                </label>
                <input
                  type="text"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="e.g. 23117PN0CG"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Proxy URL (Optional)
                </label>
                <input
                  type="text"
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                  placeholder="http://ip:port or socks5://ip:port"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-xs sm:text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Execution Timing Profile
              </label>
              <select
                value={timingMode}
                onChange={(e) => setTimingMode(e.target.value as TimingMode)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-xs sm:text-sm font-medium"
              >
                <option value="asia">⚡ Asia Burst (58.8s - 59.9s) [Recommended]</option>
                <option value="europe">🌍 Europe Burst (58.7s - 59.8s)</option>
                <option value="single">🎯 Single Shot (23:00:00 exact)</option>
                <option value="custom">⚙️ Custom Offsets (JSON)</option>
              </select>
              {timingMode === "custom" && (
                <input
                  type="text"
                  value={customTimings}
                  onChange={(e) => setCustomTimings(e.target.value)}
                  placeholder="e.g. [58.5, 59.0, 59.5, 59.9]"
                  className="mt-2 w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              )}
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={autoApplyEnabled}
                  onChange={(e) => setAutoApplyEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="font-medium">Enable automatic apply at 23:00 WIB</span>
              </label>
            </div>

            <div className="pt-3.5 flex items-center justify-end gap-2.5 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[38px] px-4 py-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[38px] px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-medium rounded-lg shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                {saving ? "Saving..." : initialAccount ? "Update Account" : "Register Account"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
