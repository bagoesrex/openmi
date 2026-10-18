import React, { useState } from "react";
import type { Account } from "../types";
import {
  CheckCircle2,
  XCircle,
  Network,
  Power,
  RefreshCw,
  Edit2,
  Trash2,
  AlertTriangle,
  Smartphone,
} from "lucide-react";

interface AccountCardProps {
  account: Account;
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
  onToggleAutoApply: (id: string, enabled: boolean) => void;
  onTestConnection: (id: string) => Promise<any>;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  onEdit,
  onDelete,
  onToggleAutoApply,
  onTestConnection,
}) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await onTestConnection(account.id);
      setTestResult({ success: res.valid, message: res.valid ? "Cookie valid" : `Error ${res.code}` });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Failed" });
    } finally {
      setTesting(false);
    }
  };

  const getResultBadge = (code?: number | null) => {
    if (code === undefined || code === null) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
          No attempt yet
        </span>
      );
    }
    if (code === 1) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Passed (Quota Granted)
        </span>
      );
    }
    if (code === 3) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Quota Full (Try Tomorrow)
        </span>
      );
    }
    if (code === 2 || code === 4) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
          Cooldown / Limit
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
        Code: {code}
      </span>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 shadow-lg transition duration-200">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white text-base">{account.label}</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
              {account.region}
            </span>
          </div>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            UID: {account.cUserId}
          </p>
        </div>

        {/* Auto Apply Toggle */}
        <button
          onClick={() => onToggleAutoApply(account.id, account.autoApplyEnabled === 0)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition border ${
            account.autoApplyEnabled === 1
              ? "bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20"
              : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700/50"
          }`}
          title={account.autoApplyEnabled === 1 ? "Auto-apply enabled" : "Auto-apply paused"}
        >
          <Power className="w-3.5 h-3.5" />
          <span>{account.autoApplyEnabled === 1 ? "Auto 23:00" : "Paused"}</span>
        </button>
      </div>

      {/* Status Details */}
      <div className="space-y-2.5 text-xs text-slate-300 py-3 border-y border-slate-800/80 my-3">
        {/* Cookie Health */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Cookie Status:</span>
          <div className="flex items-center gap-1.5">
            {account.sessionValid === 1 ? (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Valid
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-rose-400 font-medium">
                <XCircle className="w-3.5 h-3.5" />
                Expired
              </span>
            )}
          </div>
        </div>

        {/* Last Quota Status */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Last Quota Result:</span>
          <div>{getResultBadge(account.lastApplyResult)}</div>
        </div>

        {/* Device ID / Proxy */}
        {account.proxyUrl && (
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1">
              <Network className="w-3 h-3 text-cyan-400" />
              Proxy:
            </span>
            <span className="font-mono text-[11px] truncate max-w-[180px] text-slate-300">
              {account.proxyUrl}
            </span>
          </div>
        )}

        {account.deviceId && (
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1">
              <Smartphone className="w-3 h-3 text-slate-500" />
              Device:
            </span>
            <span className="font-mono text-[11px] text-slate-400">{account.deviceId}</span>
          </div>
        )}
      </div>

      {/* Test Result Message */}
      {testResult && (
        <div
          className={`mb-3 p-2 rounded text-xs flex items-center gap-1.5 ${
            testResult.success
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
          }`}
        >
          {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin" : ""}`} />
          <span>{testing ? "Testing..." : "Test Cookie"}</span>
        </button>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => onEdit(account)}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
            title="Edit credentials"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(account.id)}
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition"
            title="Delete account"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
