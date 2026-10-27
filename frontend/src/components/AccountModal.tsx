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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl relative max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4 shrink-0">
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

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 shrink-0">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

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
              className="min-h-[38px] px-5 py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-medium rounded-lg shadow-sm shadow-orange-600/30 transition disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Saving..." : initialAccount ? "Update Account" : "Register Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccountModal;
