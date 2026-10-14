"use client";

import React, { useState, useEffect } from "react";
import { GEO_PRESETS, GeoPreset } from "@/lib/constants";
import { Navigation, Loader2, Sparkles, Globe, Compass } from "lucide-react";

interface ControlPanelProps {
  lat: number;
  lng: number;
  radiusKm: number;
  targetCount: number;
  isLoading: boolean;
  isShundoGlobal: boolean;
  onlyConfirmedShiny: boolean;
  onCoordinatesChange: (lat: number, lng: number) => void;
  onRadiusChange: (radius: number) => void;
  onTargetCountChange: (count: number) => void;
  onToggleShundoGlobal: (isGlobal: boolean) => void;
  onToggleOnlyConfirmedShiny: (onlyShiny: boolean) => void;
  onExecuteScan: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  lat,
  lng,
  radiusKm,
  targetCount,
  isLoading,
  isShundoGlobal,
  onlyConfirmedShiny,
  onCoordinatesChange,
  onRadiusChange,
  onTargetCountChange,
  onToggleShundoGlobal,
  onToggleOnlyConfirmedShiny,
  onExecuteScan
}) => {
  const [coordsInput, setCoordsInput] = useState<string>(`${lat},${lng}`);
  const [isGettingGps, setIsGettingGps] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Sincroniza o input quando as coordenadas mudam externamente (ex: presets)
  useEffect(() => {
    setCoordsInput(`${lat},${lng}`);
  }, [lat, lng]);

  const handleCoordsInputChange = (val: string) => {
    setCoordsInput(val);
    const parts = val.split(",").map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      onCoordinatesChange(parts[0], parts[1]);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("GPS não suportado neste aparelho.");
      return;
    }

    setIsGettingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = parseFloat(position.coords.latitude.toFixed(7));
        const userLng = parseFloat(position.coords.longitude.toFixed(7));
        const formatted = `${userLat},${userLng}`;
        setCoordsInput(formatted);
        onCoordinatesChange(userLat, userLng);
        setIsGettingGps(false);
      },
      () => {
        setIsGettingGps(false);
        setGpsError("Sinal de GPS indisponível ou negado.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleApplyPreset = (preset: GeoPreset) => {
    const formatted = `${preset.lat},${preset.lng}`;
    setCoordsInput(formatted);
    onCoordinatesChange(preset.lat, preset.lng);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parts = coordsInput.split(",").map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      onCoordinatesChange(parts[0], parts[1]);
    }
    onExecuteScan();
  };

  return (
    <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-3.5 sm:p-4 shadow-sm text-zinc-100 space-y-3">
      {/* Abas Superiores de Modo: Radar Local vs 100% IV Global */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#0e0e11] border border-[#27272a]">
        <button
          type="button"
          onClick={() => onToggleShundoGlobal(false)}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            !isShundoGlobal
              ? "bg-[#1f1f23] text-zinc-100 border border-zinc-700/60 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-zinc-300" />
          <span>Radar Local</span>
        </button>

        <button
          type="button"
          onClick={() => onToggleShundoGlobal(true)}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            isShundoGlobal
              ? "bg-amber-950/40 text-amber-300 border border-amber-600/50 shadow-sm"
              : "text-zinc-400 hover:text-amber-300/80"
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-amber-400" />
          <span>100% IV Mundial</span>
        </button>
      </div>

      {/* Presets Rápidos */}
      <div>
        <div className="text-[11px] font-medium text-zinc-400 mb-1.5 flex items-center justify-between">
          <span>{isShundoGlobal ? "Ponto de Referência (Cálculo de Distância)" : "Locais Rápidos"}</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {GEO_PRESETS.map((preset) => {
            const isSelected =
              Math.abs(lat - preset.lat) < 0.001 && Math.abs(lng - preset.lng) < 0.001;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-zinc-200 text-zinc-950 font-semibold"
                    : "bg-[#18181b] text-zinc-300 hover:text-white border border-[#27272a]"
                }`}
              >
                {preset.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Formulário: Coordenadas + Botão GPS */}
      <form onSubmit={handleFormSubmit} className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
            {isShundoGlobal ? "Sua Posição (para estimar cooldown de teleport)" : "Coordenadas (Latitude, Longitude)"}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={coordsInput}
              onChange={(e) => handleCoordsInputChange(e.target.value)}
              placeholder="43.5442968,-79.7399437"
              className="w-full bg-[#18181b] border border-[#27272a] focus:border-zinc-500 rounded-xl px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-500 outline-none transition-colors"
            />
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isGettingGps}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#18181b] hover:bg-[#202024] text-zinc-200 border border-[#27272a] transition-all active:scale-95"
              title="Obter localização atual via GPS"
            >
              {isGettingGps ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
              ) : (
                <Navigation className="w-3.5 h-3.5 text-zinc-300" />
              )}
              <span>GPS</span>
            </button>
          </div>
          {gpsError && (
            <p className="mt-1 text-[11px] text-rose-400 font-medium">{gpsError}</p>
          )}
        </div>

        {/* Alternância Shundo Confirmado vs Todos os 100% IV no Modo Global */}
        {isShundoGlobal && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#18181b] border border-[#27272a]">
            <div className="flex flex-col pr-2">
              <span className="text-xs font-semibold text-zinc-200">
                {onlyConfirmedShiny ? "Apenas Shiny Confirmado" : "Todos os 100% IV (Sniper)"}
              </span>
              <span className="text-[10px] text-zinc-400">
                {onlyConfirmedShiny
                  ? "Apenas Shundos com predição ativa para sua conta"
                  : "Todos os 100% IV do planeta para Shiny Check"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onToggleOnlyConfirmedShiny(!onlyConfirmedShiny)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                onlyConfirmedShiny
                  ? "bg-amber-400 text-zinc-950 font-bold"
                  : "bg-emerald-950/40 text-emerald-300 border border-emerald-800/50"
              }`}
            >
              {onlyConfirmedShiny ? "Só Shiny" : "Global 100%"}
            </button>
          </div>
        )}

        {/* Seletores Compactos: Raio e Alvos */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <div>
            <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
              <span>{isShundoGlobal ? "Área" : "Raio"}</span>
              <span className="font-mono text-zinc-200 font-semibold">
                {isShundoGlobal ? "Mundial" : `${radiusKm}km`}
              </span>
            </div>
            {isShundoGlobal ? (
              <div className="py-1 px-2.5 rounded-lg text-[11px] font-medium bg-amber-950/20 text-amber-300 border border-amber-800/40 text-center truncate">
                Planeta Terra 🌐
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1">
                {[15, 30, 50, 100].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onRadiusChange(r)}
                    className={`py-1 rounded-lg text-[11px] font-mono transition-colors ${
                      radiusKm === r
                        ? "bg-zinc-200 text-zinc-950 font-bold"
                        : "bg-[#18181b] text-zinc-400 hover:text-zinc-200 border border-[#27272a]"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
              <span>Alvos</span>
              <span className="font-mono text-zinc-200 font-semibold">{targetCount}</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[25, 50, 75, 100].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onTargetCountChange(c)}
                  className={`py-1 rounded-lg text-[11px] font-mono transition-colors ${
                    targetCount === c
                      ? "bg-zinc-200 text-zinc-950 font-bold"
                      : "bg-[#18181b] text-zinc-400 hover:text-zinc-200 border border-[#27272a]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Botão de Disparo do Scanner */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onExecuteScan}
            disabled={isLoading}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-all active:scale-[0.99] ${
              isLoading
                ? "bg-zinc-800 text-zinc-400 border border-[#27272a] cursor-wait"
                : isShundoGlobal
                ? "bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold border border-amber-300 shadow-md shadow-amber-950/30"
                : "bg-zinc-100 hover:bg-white text-zinc-950 font-bold border border-zinc-200 shadow-sm"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                <span>Varrendo satélites mundiais...</span>
              </>
            ) : isShundoGlobal ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-zinc-950" />
                <span>
                  {onlyConfirmedShiny
                    ? "Buscar Shundos Confirmados"
                    : "Varredura Mundial de 100% IV"}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-zinc-900" />
                <span>Escanear Shinys ({radiusKm}km)</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
