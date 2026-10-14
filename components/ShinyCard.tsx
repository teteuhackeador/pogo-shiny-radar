"use client";

import React, { useState, useEffect } from "react";
import { PokemonSpawn } from "@/types/pokemon";
import { getPokemonSpriteUrl, getPokemonFallbackSprite } from "@/lib/constants";
import {
  Sparkles,
  MapPin,
  Clock,
  Shield,
  Zap,
  Swords,
  Copy,
  ExternalLink,
  CheckCircle2,
  Compass,
  AlertTriangle,
  Loader2,
  Check
} from "lucide-react";

interface ShinyCardProps {
  pokemon: PokemonSpawn;
  coordsCenter: { lat: number; lng: number };
  isCaptured: boolean;
  revealedCoords?: string | null;
  onToggleCaptured: (encounterId: string) => void;
  onRevealSuccess: (encounterId: string, coords: string) => void;
  onRateLimited: (retryAfter: number) => void;
}

export const ShinyCard: React.FC<ShinyCardProps> = ({
  pokemon,
  coordsCenter,
  isCaptured,
  revealedCoords,
  onToggleCaptured,
  onRevealSuccess,
  onRateLimited
}) => {
  const [imgSrc, setImgSrc] = useState<string>(getPokemonSpriteUrl(pokemon.pokemon_id));
  const [copied, setCopied] = useState<boolean>(false);
  const [revealing, setRevealing] = useState<boolean>(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [secondsUntilDespawn, setSecondsUntilDespawn] = useState<number>(9999);

  const exactCoords = revealedCoords || pokemon.exact_coords;

  // Atualização em tempo real do temporizador de despawn
  useEffect(() => {
    if (!pokemon.despawn_at) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const despawnTime = new Date(pokemon.despawn_at).getTime();
      const diffMs = despawnTime - now;

      if (diffMs <= 0) {
        setTimeLeft("Despawnou");
        setIsExpired(true);
        setSecondsUntilDespawn(0);
        return;
      }

      const totalSec = Math.floor(diffMs / 1000);
      setSecondsUntilDespawn(totalSec);
      const minutes = Math.floor(totalSec / 60);
      const seconds = totalSec % 60;
      setTimeLeft(`${minutes}m ${seconds.toString().padStart(2, "0")}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [pokemon.despawn_at]);

  // Função para revelar coordenadas sob demanda
  const handleReveal = async () => {
    if (exactCoords || revealing || !pokemon.reveal_code) return;

    setRevealing(true);
    setRevealError(null);

    try {
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reveal_code: pokemon.reveal_code, encounter_id: pokemon.encounter_id })
      });

      const data = await res.json();

      if (res.status === 429 || data.error === "rate_limited") {
        const retryAfter = data.retry_after || 180;
        setRevealError(`Cota excedida: aguarde ${retryAfter}s`);
        onRateLimited(retryAfter);
        return;
      }

      if (data.success && data.coords) {
        onRevealSuccess(pokemon.encounter_id, data.coords);
      } else {
        setRevealError(data.message || "Não foi possível obter coordenadas.");
      }
    } catch (e: any) {
      setRevealError("Erro de conexão ao revelar.");
    } finally {
      setRevealing(false);
    }
  };

  const handleCopyCoords = async () => {
    if (!exactCoords) return;
    try {
      await navigator.clipboard.writeText(exactCoords);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback para input manual
    }
  };

  const isShundo = pokemon.iv_percent === 100;
  const isHighIv = pokemon.iv_percent >= 90;

  return (
    <div
      className={`relative rounded-2xl border transition-all duration-300 backdrop-blur-md overflow-hidden ${
        isCaptured
          ? "bg-[#0b0c13]/70 border-emerald-950/40 opacity-55 grayscale-[20%]"
          : isShundo
          ? "bg-gradient-to-b from-[#1c1402] via-[#0d0e17] to-[#07080d] border-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.25)] hover:border-amber-400"
          : isHighIv
          ? "bg-gradient-to-b from-[#130b1c] via-[#0d0e17] to-[#07080d] border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:border-purple-400"
          : "bg-[#0a0c14]/90 border-slate-800/80 hover:border-slate-700 hover:shadow-lg shadow-black/40"
      }`}
    >
      {/* Top Header do Card: Badges e Status de Captura */}
      <div className="flex items-center justify-between p-3.5 pb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Badge Shiny */}
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500/20 to-purple-500/20 text-amber-300 border border-amber-500/40 shadow-sm animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            SHINY
          </span>

          {/* Badge Shundo / 100% */}
          {isShundo && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-gradient-to-r from-amber-500 to-yellow-300 text-black border border-yellow-200 shadow-md">
              👑 SHUNDO 100%
            </span>
          )}

          {/* Badge IV Alto */}
          {!isShundo && isHighIv && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              ⚡ IV {pokemon.iv_percent}%
            </span>
          )}

          {/* Nível do Pokémon */}
          <span className="text-[11px] font-medium text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-800">
            Nv. {pokemon.level}
          </span>
        </div>

        {/* Botão de Já Capturei / Capturado */}
        <button
          onClick={() => onToggleCaptured(pokemon.encounter_id)}
          title={isCaptured ? "Marcar como pendente" : "Marcar como capturado"}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
            isCaptured
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm"
              : "bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 border border-slate-700"
          }`}
        >
          <CheckCircle2
            className={`w-3.5 h-3.5 ${
              isCaptured ? "text-emerald-400 fill-emerald-400/20" : "text-slate-400"
            }`}
          />
          {isCaptured ? "Capturado" : "Já Peguei"}
        </button>
      </div>

      {/* Conteúdo Principal: Imagem e Dados de Combate */}
      <div className="px-4 py-3 flex gap-4 items-center">
        {/* Sprite Shiny com aura */}
        <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950 border border-slate-800/80 shadow-inner group">
          <div
            className={`absolute inset-0 rounded-2xl filter blur-md opacity-25 ${
              isShundo ? "bg-amber-400" : "bg-purple-500"
            }`}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={pokemon.pokemon_name}
            onError={() => setImgSrc(getPokemonFallbackSprite(pokemon.pokemon_id))}
            className="relative z-10 w-20 h-20 object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,0.6)] transform group-hover:scale-110 transition-transform duration-300"
            loading="lazy"
          />
          <span className="absolute bottom-1 right-2 text-[10px] text-slate-400 font-mono">
            #{pokemon.pokemon_id}
          </span>
        </div>

        {/* Informações Numéricas e Nome */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-1">
            <h3 className="text-lg font-bold text-slate-100 truncate tracking-wide">
              {pokemon.pokemon_name}
            </h3>
            <span className="text-xs font-mono text-amber-400/90 font-bold">
              CP {pokemon.cp}
            </span>
          </div>

          {/* Barra de IV e Porcentagem */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 bg-slate-950/80 h-2 rounded-full overflow-hidden border border-slate-800/80 p-[1px]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isShundo
                    ? "bg-gradient-to-r from-amber-400 to-yellow-300 shadow-[0_0_8px_#f59e0b]"
                    : pokemon.iv_percent >= 80
                    ? "bg-gradient-to-r from-purple-500 to-pink-500"
                    : "bg-slate-600"
                }`}
                style={{ width: `${Math.min(pokemon.iv_percent, 100)}%` }}
              />
            </div>
            <span
              className={`text-xs font-mono font-bold ${
                isShundo ? "text-amber-300" : isHighIv ? "text-purple-300" : "text-slate-400"
              }`}
            >
              {pokemon.iv_percent}%
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              ({pokemon.raw_iv})
            </span>
          </div>

          {/* Ataques (Moveset) */}
          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400 truncate">
            <div className="flex items-center gap-1 truncate">
              <Zap className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="truncate">{pokemon.fast_move || "Fast"}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1 truncate">
              <Swords className="w-3 h-3 text-purple-400 flex-shrink-0" />
              <span className="truncate">{pokemon.charge_move || "Charge"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Localização e Temporizador de Despawn */}
      <div className="px-4 py-2 border-t border-slate-900/90 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1.5 min-w-0 pr-2">
          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate font-medium">{pokemon.location || "Região desconhecida"}</span>
        </div>

        <div
          className={`flex items-center gap-1 flex-shrink-0 font-mono text-xs font-medium px-2 py-0.5 rounded-md ${
            isExpired
              ? "bg-rose-950/40 text-rose-400 border border-rose-900/50"
              : secondsUntilDespawn <= 180
              ? "bg-amber-950/40 text-amber-400 border border-amber-900/50 animate-pulse"
              : "bg-slate-900/60 text-slate-300 border border-slate-800"
          }`}
        >
          <Clock className="w-3 h-3" />
          <span>{timeLeft || "Calculando..."}</span>
        </div>
      </div>

      {/* Área de Ação: Revelar ou Coordenadas Prontas */}
      <div className="p-3 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/40 border-t border-slate-800/80">
        {!exactCoords ? (
          <div>
            <button
              onClick={handleReveal}
              disabled={revealing || isExpired}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                isExpired
                  ? "bg-slate-900 text-slate-400 border border-slate-800 cursor-not-allowed"
                  : "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-900/30 hover:shadow-violet-700/50 border border-violet-400/30"
              }`}
            >
              {revealing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Obtendo Coordenadas no Satélite...</span>
                </>
              ) : (
                <>
                  <Compass className="w-4 h-4 text-amber-300" />
                  <span>Revelar Coordenadas Exatas</span>
                </>
              )}
            </button>
            {revealError && (
              <p className="mt-1.5 text-center text-[11px] text-amber-400 font-medium flex items-center justify-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                {revealError}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-black/60 border border-slate-800">
              <span className="text-[11px] font-mono text-slate-300 select-all font-semibold">
                📍 {exactCoords}
              </span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                Verificado ✓
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Botão Copiar */}
              <button
                onClick={handleCopyCoords}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                  copied
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/40"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-amber-300" />
                    <span>Copiar Coords</span>
                  </>
                )}
              </button>

              {/* Botão Google Maps */}
              <a
                href={`https://www.google.com/maps?q=${exactCoords}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-900/30 border border-blue-400/20 active:scale-95 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5 text-white" />
                <span>Google Maps</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
