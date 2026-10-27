import React, { useState, useEffect } from "react";
import { Clock, Wifi, WifiOff, LogOut, RefreshCw } from "lucide-react";
import { BrandIcon } from "./BrandIcon";

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
    const updateCountdown = () => {
      const current = new Date();
      setNow(current);

      // Target is 16:00:00 UTC (23:00:00 WIB = 00:00:00 GMT+8)
      const target = new Date(
        Date.UTC(
          current.getUTCFullYear(),
          current.getUTCMonth(),
          current.getUTCDate(),
          16,
          0,
          0,
          0
        )
      );

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
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur-xs sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 shrink-0">
          <BrandIcon className="w-8 h-8 sm:w-9 sm:h-9 shadow-sm shadow-orange-600/20 rounded-[8px]" />
          <div>
            <div className="font-semibold text-base sm:text-lg text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>OpenMi</span>
              <span className="text-[9px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block leading-none mt-0.5">
              Xiaomi Bootloader Quota Automation
            </p>
          </div>
        </div>

        {/* Center: Live countdown to 23:00 WIB (Responsive: compact on mobile, full on desktop) */}
        <div className="flex items-center">
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100/90 px-2.5 sm:px-3.5 py-1.5 rounded-full border border-slate-200 shadow-inner">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600 shrink-0" />
            <span className="text-[11px] sm:text-xs text-slate-600 hidden sm:inline">23:00 WIB Reset:</span>
            <span className="text-xs sm:text-sm font-mono font-bold text-orange-600 tracking-wider tabular-nums">
              {countdown || "--:--:--"}
            </span>
            <span className="text-[10px] text-slate-400 font-mono hidden md:inline ml-0.5 tabular-nums">
              ({now.toLocaleTimeString()})
            </span>
          </div>
        </div>

        {/* Right Actions & Health */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            title="Refresh accounts"
            aria-label="Refresh accounts"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-orange-600" : ""}`} />
          </button>

          {/* SSE Connection status badge */}
          <div
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium border ${
              isSseConnected
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
            title={isSseConnected ? "Live SSE connection active" : "SSE connection lost"}
          >
            {isSseConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="hidden sm:inline">Live Sync</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="hidden sm:inline">Offline</span>
              </>
            )}
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-slate-100 transition border border-slate-200 cursor-pointer"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
