"use client";

import React, { useState, useEffect } from "react";
import { PokemonSpawn } from "@/types/pokemon";
import { getPokemonSpriteUrl, getPokemonFallbackSprite, calculateDistanceKm } from "@/lib/constants";
import {
  Clock,
  Copy,
  ExternalLink,
  Check,
  Loader2,
  CheckSquare,
  Square,
  MapPin,
  EyeOff
} from "lucide-react";

interface ShinyCardProps {
  pokemon: PokemonSpawn;
  coordsCenter: { lat: number; lng: number };
  isCaptured: boolean;
  revealedCoords?: string | null;
  onToggleCaptured: (encounterId: string) => void;
  onRevealSuccess: (encounterId: string, coords: string) => void;
  onRateLimited: (retryAfter: number) => void;
  onHideSpecies?: (speciesName: string) => void;
  onToast?: (message: string) => void;
}

export const ShinyCard: React.FC<ShinyCardProps> = ({
  pokemon,
  coordsCenter,
  isCaptured,
  revealedCoords,
  onToggleCaptured,
  onRevealSuccess,
  onRateLimited,
  onHideSpecies,
  onToast
}) => {
  const [imgSrc, setImgSrc] = useState<string>(getPokemonSpriteUrl(pokemon.pokemon_id));
  const [copied, setCopied] = useState<boolean>(false);
  const [revealing, setRevealing] = useState<boolean>(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [isCriticalTime, setIsCriticalTime] = useState<boolean>(false);

  const exactCoords = revealedCoords || pokemon.exact_coords;

  // Atualização em tempo real do temporizador de despawn
  useEffect(() => {
    if (!pokemon.despawn_at) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const despawnTime = new Date(pokemon.despawn_at).getTime();
      const diffMs = despawnTime - now;

      if (diffMs <= 0) {
        setTimeLeft("Expirado");
        setIsExpired(true);
        setIsCriticalTime(false);
        return;
      }

      const totalSec = Math.floor(diffMs / 1000);
      setIsCriticalTime(totalSec <= 180);
      const minutes = Math.floor(totalSec / 60);
      const seconds = totalSec % 60;
      setTimeLeft(`${minutes}m ${seconds.toString().padStart(2, "0")}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [pokemon.despawn_at]);

  // Revela e retorna a coordenada (exata verdadeira ou fallback aproximado)
  const fetchExactCoords = async (): Promise<{ coords: string; isApprox: boolean } | null> => {
    if (exactCoords) return { coords: exactCoords, isApprox: false };
    if (!pokemon.reveal_code) {
      if (pokemon.apx_lat != null && pokemon.apx_long != null) {
        return { coords: `${pokemon.apx_lat},${pokemon.apx_long}`, isApprox: true };
      }
      return null;
    }

    setRevealing(true);
    setRevealError(null);

    try {
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reveal_code: pokemon.reveal_code,
          encounter_id: pokemon.encounter_id,
          apx_lat: pokemon.apx_lat,
          apx_long: pokemon.apx_long
        })
      });

      const data = await res.json();

      if (data.success && data.coords) {
        if (!data.is_approx) {
          onRevealSuccess(pokemon.encounter_id, data.coords);
        } else {
          setRevealError(`Cota da API ativa (${data.retry_after || 180}s) • Usando aprox.`);
          onRateLimited(data.retry_after || 180);
        }
        return { coords: data.coords, isApprox: !!data.is_approx };
      }

      if (res.status === 429 || data.error === "rate_limited") {
        const retry = data.retry_after || 180;
        setRevealError(`Cota da API ativa (${retry}s) • Usando aprox.`);
        onRateLimited(retry);

        // Fallback imediato para coordenadas aproximadas
        if (pokemon.apx_lat != null && pokemon.apx_long != null) {
          return { coords: `${pokemon.apx_lat},${pokemon.apx_long}`, isApprox: true };
        }
        return null;
      }

      // Fallback em caso de falha da API
      if (pokemon.apx_lat != null && pokemon.apx_long != null) {
        return { coords: `${pokemon.apx_lat},${pokemon.apx_long}`, isApprox: true };
      }

      setRevealError("Falha ao obter coordenadas.");
      return null;
    } catch {
      if (pokemon.apx_lat != null && pokemon.apx_long != null) {
        return { coords: `${pokemon.apx_lat},${pokemon.apx_long}`, isApprox: true };
      }
      setRevealError("Erro de conexão.");
      return null;
    } finally {
      setRevealing(false);
    }
  };

  // Botão Copiar Coords: obtém a coordenada exata verdadeira ou aproximada e copia pro clipboard
  const handleCopyCoords = async () => {
    let target = exactCoords ? { coords: exactCoords, isApprox: false } : null;

    if (!target) {
      target = await fetchExactCoords();
    }

    if (!target || !target.coords) return;

    try {
      await navigator.clipboard.writeText(target.coords);
      setCopied(true);
      if (onToast) {
        if (target.isApprox) {
          onToast(`Copiado aprox. (~100m da cota): ${target.coords}`);
        } else {
          onToast(`Copiado exato: ${target.coords}`);
        }
      }
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (onToast) onToast("Erro ao copiar para a área de transferência.");
    }
  };

  // Botão Maps: abre diretamente no Google Maps com a coordenada
  const handleOpenMaps = async () => {
    let target = exactCoords ? { coords: exactCoords, isApprox: false } : null;

    if (!target) {
      target = await fetchExactCoords();
    }

    if (!target || !target.coords) return;

    window.open(
      `https://www.google.com/maps?q=${encodeURIComponent(target.coords)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const isShundo = pokemon.shiny && pokemon.iv_percent === 100 && pokemon.raw_iv === "15/15/15";

  return (
    <div
      className={`rounded-2xl border transition-all text-zinc-100 p-3 sm:p-3.5 ${
        isCaptured
          ? "bg-[#0e0e11] border-[#27272a]/60 opacity-50"
          : isShundo
          ? "bg-[#14130e] border-amber-600/40"
          : "bg-[#121214] border-[#27272a]"
      }`}
    >
      {/* Linha Superior: Nome, Stats Básicos e Botão Peguei */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-sm font-semibold text-zinc-100 truncate">
              {pokemon.pokemon_name}
            </h3>
            {isShundo ? (
              <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm">
                ✨ SHUNDO (15/15/15)
              </span>
            ) : (
              <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 bg-zinc-800 text-amber-300 border-zinc-700">
                ✨ SHINY {pokemon.iv_percent}%
              </span>
            )}
            <span className="text-[11px] font-mono text-zinc-400">
              Nv. {pokemon.level}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-xs font-mono">
            <span className="font-semibold text-zinc-200">
              CP {pokemon.cp}
            </span>
            <span className="text-zinc-500">•</span>
            <span
              className={
                isShundo
                  ? "text-amber-400 font-bold"
                  : pokemon.iv_percent >= 90
                  ? "text-emerald-400 font-medium"
                  : "text-zinc-300"
              }
            >
              IV {pokemon.iv_percent}%
            </span>
            <span className="text-zinc-500 text-[10px]">
              ({pokemon.raw_iv})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Botão Ocultar Espécie */}
          {onHideSpecies && (
            <button
              type="button"
              onClick={() => onHideSpecies(pokemon.pokemon_name)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-[#18181b] hover:bg-rose-950/40 text-zinc-400 hover:text-rose-300 border border-[#27272a] hover:border-rose-900/50 transition-colors"
              title={`Ocultar todos os ${pokemon.pokemon_name} do radar`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ocultar</span>
            </button>
          )}

          {/* Botão/Checkbox "Peguei" */}
          <button
            type="button"
            onClick={() => onToggleCaptured(pokemon.encounter_id)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              isCaptured
                ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800/60"
                : "bg-[#18181b] text-zinc-400 hover:text-zinc-200 border border-[#27272a]"
            }`}
            title={isCaptured ? "Marcar como não capturado" : "Marcar como capturado"}
          >
            {isCaptured ? (
              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Square className="w-3.5 h-3.5 text-zinc-500" />
            )}
            <span>Peguei</span>
          </button>
        </div>
      </div>

      {/* Linha Central: Sprite + Detalhes de Despawn e Localização */}
      <div className="flex items-center gap-3 py-1">
        {/* Sprite */}
        <div className="relative w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-xl bg-[#18181b] border border-[#27272a]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={pokemon.pokemon_name}
            onError={() => setImgSrc(getPokemonFallbackSprite(pokemon.pokemon_id))}
            className="w-12 h-12 object-contain"
            loading="lazy"
          />
        </div>

        {/* Metadados: Tempo restante, Distância e Local */}
        <div className="flex-1 min-w-0 text-xs">
          <div className="flex items-center gap-1.5 mb-1 font-mono">
            <Clock className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
            <span
              className={
                isExpired
                  ? "text-rose-400"
                  : isCriticalTime
                  ? "text-amber-400 font-semibold"
                  : "text-zinc-300"
              }
            >
              {timeLeft ? `${timeLeft} restando` : "Calculando..."}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 truncate">
            <MapPin className="w-3 h-3 text-zinc-500 flex-shrink-0" />
            {(() => {
              let dist: number | null = null;
              if (exactCoords && coordsCenter) {
                const [cLat, cLng] = exactCoords.split(",").map(Number);
                if (!isNaN(cLat) && !isNaN(cLng)) {
                  dist = calculateDistanceKm(coordsCenter.lat, coordsCenter.lng, cLat, cLng);
                }
              } else if (pokemon.apx_lat != null && pokemon.apx_long != null && coordsCenter) {
                dist = calculateDistanceKm(coordsCenter.lat, coordsCenter.lng, pokemon.apx_lat, pokemon.apx_long);
              } else if (pokemon.distance_km != null) {
                dist = pokemon.distance_km;
              }
              return dist != null ? (
                <>
                  <span className="text-emerald-400 font-mono font-medium">{dist} km</span>
                  <span className="text-zinc-600">•</span>
                </>
              ) : null;
            })()}
            <span className="truncate">{pokemon.location || (pokemon.apx_lat ? `Região de ${pokemon.apx_lat.toFixed(3)}, ${pokemon.apx_long?.toFixed(3)}` : "Localização informada")}</span>
          </div>
        </div>
      </div>

      {/* Erro de Revelação, se houver */}
      {revealError && (
        <p className="mt-1 text-center text-[11px] text-amber-400 font-medium">
          {revealError}
        </p>
      )}

      {/* Linha Inferior: Botões de Ação para o Polegar */}
      <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-[#27272a]">
        {/* Botão Copiar Coords */}
        <button
          type="button"
          onClick={handleCopyCoords}
          disabled={revealing || isExpired}
          className={`h-10 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
            copied
              ? "bg-emerald-600 text-white"
              : "bg-[#18181b] hover:bg-[#222226] text-zinc-100 border border-[#27272a]"
          }`}
        >
          {revealing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
              <span>Obtendo...</span>
            </>
          ) : copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-white" />
              <span>Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-zinc-300" />
              <span>Copiar Coords</span>
            </>
          )}
        </button>

        {/* Botão Google Maps */}
        <button
          type="button"
          onClick={handleOpenMaps}
          disabled={revealing || isExpired}
          className="h-10 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-[#18181b] hover:bg-[#222226] text-zinc-100 border border-[#27272a] transition-all active:scale-95"
        >
          <ExternalLink className="w-3.5 h-3.5 text-zinc-300" />
          <span>Maps</span>
        </button>
      </div>
    </div>
  );
};
