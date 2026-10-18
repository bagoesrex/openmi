import React, { useState, useEffect } from "react";
import type { Account, NewAccountInput } from "../types";
import { X, ShieldAlert } from "lucide-react";

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
  const [label, setLabel] = useState("");
  const [region, setRegion] = useState("global");
  const [cUserId, setCUserId] = useState("");
  const [serviceToken, setServiceToken] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAccount) {
      setLabel(initialAccount.label);
      setRegion(initialAccount.region || "global");
      setCUserId(initialAccount.cUserId);
      setServiceToken(initialAccount.serviceToken);
      setDeviceId(initialAccount.deviceId || "");
      setProxyUrl(initialAccount.proxyUrl || "");
      setAutoApplyEnabled(initialAccount.autoApplyEnabled === 1);
    } else {
      setLabel("");
      setRegion("global");
      setCUserId("");
      setServiceToken("");
      setDeviceId("");
      setProxyUrl("");
      setAutoApplyEnabled(true);
    }
    setError(null);
  }, [initialAccount, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !cUserId.trim() || !serviceToken.trim()) {
      setError("Please fill in Label, cUserId, and serviceToken.");
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
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <h2 className="text-lg font-bold text-white">
            {initialAccount ? "Edit Xiaomi Account" : "Register Xiaomi Account"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Account Label <span className="text-orange-500">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Personal Phone (Xiaomi 14)"
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Region <span className="text-orange-500">*</span>
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="global">Global (new.c.mi.com/global/)</option>
                <option value="id">Indonesia (new.c.mi.com/id/)</option>
                <option value="ru">Russia (new.c.mi.com/ru/)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                cUserId <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                value={cUserId}
                onChange={(e) => setCUserId(e.target.value)}
                placeholder="Xiaomi Account ID"
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              serviceToken <span className="text-orange-500">*</span>
            </label>
            <textarea
              value={serviceToken}
              onChange={(e) => setServiceToken(e.target.value)}
              placeholder="Paste captured serviceToken cookie here"
              rows={3}
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-[11px] placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Extracted from HTTP proxy or browser cookies for domain .mi.com
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Device Model / ID (Optional)
              </label>
              <input
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="e.g. 23117PN0CG"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Outbound Proxy URL (Optional)
              </label>
              <input
                type="text"
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                placeholder="http://ip:port or socks5://ip:port"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={autoApplyEnabled}
                onChange={(e) => setAutoApplyEnabled(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-orange-600 focus:ring-orange-500"
              />
              <span>Enable automatic apply at 23:00 WIB</span>
            </label>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-lg shadow-lg shadow-orange-600/30 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : initialAccount ? "Update Account" : "Register Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
