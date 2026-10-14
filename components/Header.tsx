"use client";

import React from "react";
import { Sparkles, Shield, AlertCircle, Wifi, Radio } from "lucide-react";

interface HeaderProps {
  cooldownSeconds?: number;
  totalFound?: number;
}

export const Header: React.FC<HeaderProps> = ({ cooldownSeconds = 0, totalFound = 0 }) => {
  return (
    <header className="mb-6">
      {/* Top Banner de Cooldown se houver Rate Limit ativo */}
      {cooldownSeconds > 0 && (
        <div className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-md flex items-center justify-between gap-3 text-amber-300 text-xs shadow-lg animate-pulse">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Cota de Revelação Saturada:</strong> A API externa permite 10 reveals por ciclo.
            </span>
          </div>
          <span className="font-mono font-bold bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/40">
            Libera em {cooldownSeconds}s
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/40">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
              PoGo Shiny Radar
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                v2.0 PRO
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Scanner aristocrático de Shinys com Blacklist Recursiva & Lazy Reveal
          </p>
        </div>

        {/* Badges de Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-semibold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            <span>VIP Bypass Ativo</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-950/40 border border-purple-800/40 text-[11px] font-semibold text-purple-300">
            <Radio className="w-3 h-3 text-purple-400" />
            <span>tteteu093</span>
          </div>
        </div>
      </div>
    </header>
  );
};
