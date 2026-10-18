import React, { useState, useEffect } from "react";
import { ShieldCheck, Clock, Wifi, WifiOff, LogOut, RefreshCw } from "lucide-react";

interface HeaderProps {
  isSseConnected: boolean;
  onLogout: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isSseConnected,
  onLogout,
  onRefresh,
  isRefreshing,
}) => {
  const [now, setNow] = useState(new Date());
  const [countdown, setCountdown] = useState<string>("");

  useEffect(() => {
    const timer = setInterval(() => {
      const current = new Date();
      setNow(current);

      // Target is 16:00:00 UTC (23:00:00 WIB)
      const target = new Date(Date.UTC(
        current.getUTCFullYear(),
        current.getUTCMonth(),
        current.getUTCDate(),
        16,
        0,
        0,
        0
      ));

      if (target.getTime() <= current.getTime()) {
        target.setUTCDate(target.getUTCDate() + 1);
      }

      const diffMs = target.getTime() - current.getTime();
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);

      setCountdown(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-orange-600 flex items-center justify-center font-bold text-white shadow-md shadow-orange-600/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-lg text-slate-900 tracking-tight flex items-center gap-2">
              OpenMi
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-500">Xiaomi Bootloader Quota Automation</p>
          </div>
        </div>

        {/* Center: Live countdown to 23:00 WIB */}
        <div className="hidden md:flex items-center space-x-6">
          <div className="flex items-center gap-2 bg-slate-100/90 px-3.5 py-1.5 rounded-full border border-slate-200 shadow-inner">
            <Clock className="w-4 h-4 text-orange-600 animate-pulse" />
            <span className="text-xs text-slate-600">23:00 WIB Reset:</span>
            <span className="text-sm font-mono font-bold text-orange-600 tracking-wider">
              {countdown || "--:--:--"}
            </span>
            <span className="text-[11px] text-slate-400 font-mono ml-1">
              ({now.toLocaleTimeString()})
            </span>
          </div>
        </div>

        {/* Right Actions & Health */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            title="Refresh accounts"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-orange-600" : ""}`} />
          </button>

          {/* SSE Connection indicator */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isSseConnected
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            {isSseConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Live Sync</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden sm:inline">Disconnected</span>
              </>
            )}
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition border border-slate-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
