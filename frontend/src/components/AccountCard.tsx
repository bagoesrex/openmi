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
        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-600 border border-slate-200">
          No attempt yet
        </span>
      );
    }
    if (code === 1) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          Passed (Quota Granted)
        </span>
      );
    }
    if (code === 3) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-50 text-amber-800 border border-amber-200">
          Quota Full (Try Tomorrow)
        </span>
      );
    }
    if (code === 2 || code === 4) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-rose-50 text-rose-700 border border-rose-200">
          Cooldown / Limit
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
        Code: {code}
      </span>
    );
  };

  return (
    <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 shadow-xs hover:shadow-md transition duration-200">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 text-base">{account.label}</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
              {account.region}
            </span>
          </div>
          <p className="text-xs font-mono text-slate-500 mt-0.5">
            UID: {account.cUserId}
          </p>
        </div>

        {/* Auto Apply Toggle */}
        <button
          onClick={() => onToggleAutoApply(account.id, account.autoApplyEnabled === 0)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition border cursor-pointer ${
            account.autoApplyEnabled === 1
              ? "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70"
          }`}
          title={account.autoApplyEnabled === 1 ? "Auto-apply enabled" : "Auto-apply paused"}
        >
          <Power className="w-3.5 h-3.5" />
          <span>{account.autoApplyEnabled === 1 ? "Auto 23:00" : "Paused"}</span>
        </button>
      </div>

      {/* Status Details */}
      <div className="space-y-2.5 text-xs text-slate-600 py-3 border-y border-slate-100 my-3">
        {/* Cookie Health */}
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Cookie Status:</span>
          <div className="flex items-center gap-1.5">
            {account.sessionValid === 1 ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Valid
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
                <XCircle className="w-3.5 h-3.5" />
                Expired
              </span>
            )}
          </div>
        </div>

        {/* Last Quota Status */}
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Last Quota Result:</span>
          <div>{getResultBadge(account.lastApplyResult)}</div>
        </div>

        {/* Device ID / Proxy */}
        {account.proxyUrl && (
          <div className="flex items-center justify-between text-slate-500">
            <span className="flex items-center gap-1">
              <Network className="w-3 h-3 text-cyan-600" />
              Proxy:
            </span>
            <span className="font-mono text-[11px] truncate max-w-[180px] text-slate-700">
              {account.proxyUrl}
            </span>
          </div>
        )}

        {account.deviceId && (
          <div className="flex items-center justify-between text-slate-500">
            <span className="flex items-center gap-1">
              <Smartphone className="w-3 h-3 text-slate-400" />
              Device:
            </span>
            <span className="font-mono text-[11px] text-slate-600">{account.deviceId}</span>
          </div>
        )}
      </div>

      {/* Test Result Message */}
      {testResult && (
        <div
          className={`mb-3 p-2 rounded text-xs flex items-center gap-1.5 ${
            testResult.success
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin text-orange-600" : ""}`} />
          <span>{testing ? "Testing..." : "Test Cookie"}</span>
        </button>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => onEdit(account)}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition cursor-pointer"
            title="Edit credentials"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(account.id)}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition cursor-pointer"
            title="Delete account"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
