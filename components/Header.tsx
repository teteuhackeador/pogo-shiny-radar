"use client";

import React from "react";
import { Radio, AlertCircle } from "lucide-react";

interface HeaderProps {
  cooldownSeconds?: number;
  totalFound?: number;
}

export const Header: React.FC<HeaderProps> = ({ cooldownSeconds = 0, totalFound = 0 }) => {
  return (
    <header className="mb-4">
      {/* Banner de Cooldown se houver Rate Limit ativo */}
      {cooldownSeconds > 0 && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-amber-950/30 border border-amber-800/40 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>Limite de requisições ativo</span>
          </div>
          <span className="font-mono font-medium bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60 text-[11px]">
            {cooldownSeconds}s
          </span>
        </div>
      )}

      <div className="flex items-center justify-between py-2 border-b border-[#27272a]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-base sm:text-lg font-semibold tracking-tight text-zinc-100">
            PoGo Shiny Radar
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-400">
          {totalFound > 0 ? (
            <span className="font-mono text-zinc-300">
              {totalFound} encontrados
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <Radio className="w-3 h-3 text-emerald-400" />
              Online
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
