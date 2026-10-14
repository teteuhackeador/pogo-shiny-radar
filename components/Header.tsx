"use client";

import React, { useState, useEffect } from "react";
import { Radio, AlertCircle, Clock, ShieldAlert, CheckCircle2 } from "lucide-react";

interface HeaderProps {
  cooldownSeconds?: number;
  totalFound?: number;
}

export const Header: React.FC<HeaderProps> = ({ cooldownSeconds = 0, totalFound = 0 }) => {
  const [teleportCooldownEnd, setTeleportCooldownEnd] = useState<number | null>(null);
  const [timeLeftStr, setTimeLeftStr] = useState<string>("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("pogo_teleport_cooldown_end");
      if (saved) {
        const end = parseInt(saved, 10);
        if (end > Date.now()) {
          setTeleportCooldownEnd(end);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!teleportCooldownEnd) {
      setTimeLeftStr("");
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = teleportCooldownEnd - now;
      if (diff <= 0) {
        setTeleportCooldownEnd(null);
        try {
          localStorage.removeItem("pogo_teleport_cooldown_end");
        } catch {}
        setTimeLeftStr("");
        return;
      }
      const totalSec = Math.floor(diff / 1000);
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      setTimeLeftStr(`${hours > 0 ? `${hours}h ` : ""}${mins}m ${secs.toString().padStart(2, "0")}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [teleportCooldownEnd]);

  const handleStartCooldown = () => {
    const end = Date.now() + 120 * 60 * 1000; // 2 horas (120 minutos)
    setTeleportCooldownEnd(end);
    try {
      localStorage.setItem("pogo_teleport_cooldown_end", String(end));
    } catch {}
  };

  const handleCancelCooldown = () => {
    setTeleportCooldownEnd(null);
    try {
      localStorage.removeItem("pogo_teleport_cooldown_end");
    } catch {}
  };

  return (
    <header className="mb-4 space-y-2">
      {/* Banner de Rate Limit da API */}
      {cooldownSeconds > 0 && (
        <div className="px-3 py-2 rounded-xl bg-amber-950/30 border border-amber-800/40 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>Limite de requisições da API ativo</span>
          </div>
          <span className="font-mono font-medium bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60 text-[11px]">
            {cooldownSeconds}s
          </span>
        </div>
      )}

      {/* Banner do Cooldown de 2h de Teleporte do Jogo */}
      {teleportCooldownEnd && timeLeftStr ? (
        <div className="px-3 py-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-rose-200">Softban Cooldown Ativo</span>
              <span className="text-[10px] text-rose-400/90 truncate">Não jogue bola nem gire pokéstop por 2h</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-mono font-bold bg-rose-950 px-2 py-0.5 rounded border border-rose-800 text-rose-200 text-xs">
              {timeLeftStr}
            </span>
            <button
              type="button"
              onClick={handleCancelCooldown}
              className="text-[10px] text-zinc-400 hover:text-zinc-200 underline"
            >
              Reset
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-1 text-[11px] text-zinc-400">
          <span>Teleporte longo precisa de 2h de espera</span>
          <button
            type="button"
            onClick={handleStartCooldown}
            className="flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Clock className="w-3 h-3" />
            <span>Iniciar Timer 2h</span>
          </button>
        </div>
      )}

      {/* Top Header Principal */}
      <div className="flex items-center justify-between py-1.5 border-b border-[#27272a]">
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
