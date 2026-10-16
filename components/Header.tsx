"use client";

import React from "react";
import { Radio, AlertCircle } from "lucide-react";

interface HeaderProps {
  cooldownSeconds?: number;
  totalFound?: number;
  onOpenSniper?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cooldownSeconds = 0,
  totalFound = 0,
  onOpenSniper
}) => {
  return (
    <header className="mb-2.5 space-y-2">
      {/* Banner de Rate Limit da API */}
      {cooldownSeconds > 0 && (
        <div className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-between text-xs text-zinc-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
            <span>Limite de requisições ativo</span>
          </div>
          <span className="font-mono font-medium bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700 text-[11px] text-zinc-200">
            {cooldownSeconds}s
          </span>
        </div>
      )}

      {/* Top Bar Principal - Tática e Limpa */}
      <div className="flex items-center justify-between py-1 border-b border-[#222226]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500/90" />
          <h1 className="text-sm sm:text-base font-semibold tracking-tight text-zinc-100">
            PoGo Radar
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {onOpenSniper && (
            <button
              type="button"
              onClick={onOpenSniper}
              className="px-2.5 py-1 rounded-lg bg-[#18181b] hover:bg-[#222226] active:bg-zinc-800 border border-[#27272a] hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer select-none transition-colors"
              title="Configurar sentinela no celular"
            >
              <Radio className="w-3 h-3 text-zinc-400" />
              <span>Sniper Celular</span>
            </button>
          )}

          <div className="text-xs text-zinc-400">
            {totalFound > 0 ? (
              <span className="font-mono text-zinc-300 text-xs">
                {totalFound} alvos
              </span>
            ) : (
              <span className="text-zinc-500 text-[11px] font-mono">
                Pronto
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
