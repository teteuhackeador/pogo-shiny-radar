"use client";

import React, { useState, useEffect } from "react";
import { GEO_PRESETS, GeoPreset } from "@/lib/constants";
import { RadarHuntMode } from "@/types/pokemon";
import {
  Navigation,
  Loader2,
  Globe,
  Compass,
  Target,
  Crown,
  Sparkles,
  MapPin,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Search
} from "lucide-react";

interface ControlPanelProps {
  lat: number;
  lng: number;
  radiusKm: number;
  targetCount: number;
  isLoading: boolean;
  huntMode: RadarHuntMode;
  scannedHuntMode?: RadarHuntMode;
  onCoordinatesChange: (lat: number, lng: number) => void;
  onRadiusChange: (radius: number) => void;
  onTargetCountChange: (count: number) => void;
  onHuntModeChange: (mode: RadarHuntMode) => void;
  onExecuteScan: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  lat,
  lng,
  radiusKm,
  targetCount,
  isLoading,
  huntMode,
  scannedHuntMode = "hundo_global",
  onCoordinatesChange,
  onRadiusChange,
  onTargetCountChange,
  onHuntModeChange,
  onExecuteScan
}) => {
  const [coordsInput, setCoordsInput] = useState<string>(`${lat},${lng}`);
  const [isGettingGps, setIsGettingGps] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const isLocalMode = huntMode === "local_shiny" || huntMode === "shundo_local";
  // Em modo local, mantém ajustes expandidos para facilitar raio/cidade. Em modo global, recolhe para economizar tela.
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(isLocalMode);

  useEffect(() => {
    setCoordsInput(`${lat},${lng}`);
  }, [lat, lng]);

  // Se trocar para modo local, abre os ajustes automaticamente
  useEffect(() => {
    if (isLocalMode) {
      setIsSettingsOpen(true);
    }
  }, [isLocalMode]);

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

  // Identifica se a coordenada atual bate com algum preset
  const matchedPreset = GEO_PRESETS.find(
    (p) => Math.abs(lat - p.lat) < 0.01 && Math.abs(lng - p.lng) < 0.01
  );

  const modeLabels: Record<RadarHuntMode, { title: string; shortTitle: string; icon: any }> = {
    hundo_global: { title: "100% IV Global", shortTitle: "100% Global", icon: Crown },
    shundo_global: { title: "Shundo Global", shortTitle: "Shundo", icon: Globe },
    shiny_global: { title: "Meus Shinies", shortTitle: "Meus Shinies", icon: Sparkles },
    local_shiny: { title: "Shinys (Raio)", shortTitle: "Raio Local", icon: Compass },
    shundo_local: { title: "Shundo (Raio)", shortTitle: "Shundo Raio", icon: Target }
  };

  const modes: RadarHuntMode[] = [
    "hundo_global",
    "shundo_global",
    "shiny_global",
    "local_shiny",
    "shundo_local"
  ];

  const hasModeChanged = huntMode !== scannedHuntMode;

  return (
    <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-2.5 sm:p-3.5 text-zinc-100 space-y-2.5">
      {/* 1. Segmented Control Tático Horizontal - Zero AI Slop */}
      <div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar p-1 rounded-xl bg-[#0a0a0c] border border-[#222226]">
          {modes.map((mode) => {
            const isSelected = huntMode === mode;
            const item = modeLabels[mode];
            const Icon = item.icon;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onHuntModeChange(mode)}
                className={`flex-1 min-w-[76px] sm:min-w-0 py-2 px-1.5 rounded-lg text-[11px] font-medium flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                  isSelected
                    ? "bg-[#27272a] text-zinc-100 font-semibold shadow-sm border border-zinc-700/80"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-[#18181b]/60"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-zinc-100" : "text-zinc-400"}`} />
                <span className="whitespace-nowrap truncate">{item.shortTitle}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Barra de Resumo de Localização & Toggle de Ajustes */}
      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#18181b] border border-[#27272a] text-xs">
        <div className="flex items-center gap-1.5 min-w-0 text-zinc-300">
          <MapPin className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
          <span className="font-medium truncate">
            {matchedPreset ? matchedPreset.name : "Coordenadas Custom"}
          </span>
          <span className="text-zinc-500 font-mono text-[11px] truncate">
            ({lat.toFixed(3)}, {lng.toFixed(3)})
          </span>
          <span className="text-zinc-600 hidden sm:inline">•</span>
          <span className="text-zinc-400 text-[11px] font-mono hidden sm:inline">
            {isLocalMode ? `${radiusKm}km` : "Global"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsSettingsOpen((prev) => !prev)}
          className="flex-shrink-0 flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 py-0.5 px-2 rounded-lg bg-[#222226] hover:bg-[#2c2c31] border border-[#2c2c31] transition-colors"
        >
          <SlidersHorizontal className="w-3 h-3 text-zinc-400" />
          <span>{isSettingsOpen ? "Ocultar" : "Ajustes"}</span>
          {isSettingsOpen ? (
            <ChevronUp className="w-3 h-3 text-zinc-400" />
          ) : (
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          )}
        </button>
      </div>

      {/* 3. Painel Retrátil de Ajustes (Localização, GPS, Raio e Alvos) */}
      {isSettingsOpen && (
        <form onSubmit={handleFormSubmit} className="space-y-2.5 pt-1 border-t border-[#222226] animate-in fade-in duration-150">
          {/* Presets de Cidades */}
          <div>
            <div className="text-[11px] font-medium text-zinc-400 mb-1 flex items-center justify-between">
              <span>Cidades Rápidas</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {GEO_PRESETS.map((preset) => {
                const isSelected =
                  Math.abs(lat - preset.lat) < 0.001 && Math.abs(lng - preset.lng) < 0.001;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
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

          {/* Coordenadas e GPS */}
          <div>
            <div className="flex items-center gap-1.5">
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
                className="flex-shrink-0 h-[36px] px-3 rounded-xl text-xs font-semibold bg-[#18181b] hover:bg-[#202024] text-zinc-200 border border-[#27272a] flex items-center gap-1.5 transition-all active:scale-95"
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

          {/* Raio e Alvos */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                <span>{isLocalMode ? "Raio de Busca" : "Cobertura"}</span>
                <span className="font-mono text-zinc-200 font-semibold">
                  {isLocalMode ? `${radiusKm}km` : "Global"}
                </span>
              </div>
              {isLocalMode ? (
                <div className="grid grid-cols-4 gap-1">
                  {[25, 50, 100, 200].map((r) => (
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
              ) : (
                <div className="py-1 px-2 rounded-lg text-[11px] bg-[#18181b] border border-[#27272a] text-zinc-400 text-center flex items-center justify-center gap-1 font-mono">
                  <Globe className="w-3 h-3 text-zinc-500" />
                  <span>Todos continentes</span>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                <span>Limite de Alvos</span>
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
        </form>
      )}

      {/* 4. Botão de Disparo Primário - Ergonômico de 44px para o polegar */}
      <div>
        <button
          type="button"
          onClick={onExecuteScan}
          disabled={isLoading}
          className={`w-full h-11 rounded-xl text-xs font-bold tracking-wide flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
            isLoading
              ? "bg-zinc-800 text-zinc-400 border border-[#27272a] cursor-wait"
              : hasModeChanged
              ? "bg-zinc-100 hover:bg-white text-zinc-950 shadow-md ring-2 ring-zinc-400/30"
              : "bg-zinc-100 hover:bg-white text-zinc-950 shadow-sm"
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
              <span>Varrendo satélites mundiais...</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4 text-zinc-900" />
              <span>
                {hasModeChanged
                  ? `Buscar ${modeLabels[huntMode].title}`
                  : `Atualizar ${modeLabels[huntMode].title}`}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
