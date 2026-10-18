import React, { useState } from "react";
import type { ExecutionLog } from "../types";
import { Terminal, Trash2, Copy, Check } from "lucide-react";

interface LogTerminalProps {
  logs: ExecutionLog[];
  onClear: () => void;
}

export const LogTerminal: React.FC<LogTerminalProps> = ({ logs, onClear }) => {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toTimeString().split(" ")[0] + "." + String(d.getMilliseconds()).padStart(3, "0");
  };

  const getActionColor = (action: string, code?: number | null) => {
    if (code === 1) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (code === 6) return "text-amber-800 bg-amber-50 border-amber-200";
    if (code === 2 || code === 3 || code === 4 || (code && code > 100))
      return "text-rose-700 bg-rose-50 border-rose-200";
    if (action.includes("ERROR")) return "text-rose-700 bg-rose-50 border-rose-200";
    return "text-blue-700 bg-blue-50 border-blue-200";
  };

  const handleCopyLog = (log: ExecutionLog) => {
    const text = `[${new Date(log.timestamp).toISOString()}] [${log.action}] Result: ${log.resultCode}\nMessage: ${log.message}\n${log.errorDetails ? `Diagnostic Details: ${log.errorDetails}\n` : ""}${log.rawPayload ? `Payload: ${log.rawPayload}` : ""}`;
    navigator.clipboard.writeText(text);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition flex flex-col h-[520px]">
      {/* Terminal Titlebar */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-orange-600" />
          <span className="text-xs font-mono font-medium text-slate-700">
            Live Execution Stream & Diagnostic Logs
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200/70 text-slate-600">
            {logs.length} events
          </span>
        </div>

        <button
          onClick={onClear}
          disabled={logs.length === 0}
          className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1 p-1 rounded hover:bg-slate-200/60 transition disabled:opacity-30 disabled:hover:text-slate-500 cursor-pointer"
          title="Clear console view"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="text-[11px]">Clear</span>
        </button>
      </div>

      {/* Terminal Logs List */}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-2 terminal-scroll bg-slate-50/70">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center">
            <Terminal className="w-8 h-8 mb-2 opacity-40 text-slate-500" />
            <p className="font-medium text-slate-500">Waiting for events... Background scheduler is standby for 23:00 WIB.</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Events will stream live via Server-Sent Events (SSE).
            </p>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition group"
            >
              <div className="flex items-center justify-between text-[11px] mb-1">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">{formatTime(log.timestamp)}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border ${getActionColor(
                      log.action,
                      log.resultCode
                    )}`}
                  >
                    {log.action}
                  </span>
                  {log.resultCode !== undefined && log.resultCode !== null && (
                    <span className="text-slate-600 font-medium">Code: {log.resultCode}</span>
                  )}
                  {log.accountId && (
                    <span className="text-slate-400 text-[10px]">acc:{log.accountId.slice(0, 8)}</span>
                  )}
                </div>

                <button
                  onClick={() => handleCopyLog(log)}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition cursor-pointer"
                  title="Copy log entry"
                >
                  {copiedId === log.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {log.message && (
                <div className="text-slate-800 text-xs break-words">{log.message}</div>
              )}

              {/* Rich diagnostic hints for troubleshooting */}
              {log.errorDetails && (
                <div className="mt-1.5 p-2 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px] break-words">
                  <span className="font-bold text-amber-800">Diagnostic Note: </span>
                  {log.errorDetails}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
