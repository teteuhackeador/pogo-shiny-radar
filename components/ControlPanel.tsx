"use client";

import React, { useState } from "react";
import { GEO_PRESETS, GeoPreset } from "@/lib/constants";
import {
  Navigation,
  Crosshair,
  Sliders,
  Sparkles,
  MapPin,
  Loader2,
  RefreshCw,
  Compass,
  Zap
} from "lucide-react";

interface ControlPanelProps {
  lat: number;
  lng: number;
  radiusKm: number;
  targetCount: number;
  isLoading: boolean;
  onCoordinatesChange: (lat: number, lng: number) => void;
  onRadiusChange: (radius: number) => void;
  onTargetCountChange: (count: number) => void;
  onExecuteScan: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  lat,
  lng,
  radiusKm,
  targetCount,
  isLoading,
  onCoordinatesChange,
  onRadiusChange,
  onTargetCountChange,
  onExecuteScan
}) => {
  const [latInput, setLatInput] = useState<string>(lat.toString());
  const [lngInput, setLngInput] = useState<string>(lng.toString());
  const [isGettingGps, setIsGettingGps] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Manipulação de GPS do Navegador / Smartphone
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocalização não suportada neste dispositivo.");
      return;
    }

    setIsGettingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = parseFloat(position.coords.latitude.toFixed(7));
        const userLng = parseFloat(position.coords.longitude.toFixed(7));
        setLatInput(userLat.toString());
        setLngInput(userLng.toString());
        onCoordinatesChange(userLat, userLng);
        setIsGettingGps(false);
      },
      (error) => {
        setIsGettingGps(false);
        setGpsError("Permissão de GPS negada ou sinal indisponível.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleApplyPreset = (preset: GeoPreset) => {
    setLatInput(preset.lat.toString());
    setLngInput(preset.lng.toString());
    onCoordinatesChange(preset.lat, preset.lng);
  };

  const handleManualCoordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = parseFloat(latInput);
    const parsedLng = parseFloat(lngInput);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      onCoordinatesChange(parsedLat, parsedLng);
    }
  };

  return (
    <div className="bg-[#090b14]/90 border border-slate-800/80 rounded-3xl p-4 sm:p-5 backdrop-blur-xl shadow-2xl shadow-black/60">
      {/* Linha Superior: Presets Rápidos */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            Hotspots Recomendados
          </span>
          <span className="text-[11px] text-slate-400">Clique para teleportar</span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin no-scrollbar">
          {GEO_PRESETS.map((preset) => {
            const isSelected =
              Math.abs(lat - preset.lat) < 0.001 && Math.abs(lng - preset.lng) < 0.001;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-gradient-to-r from-amber-500/20 to-purple-500/20 border-amber-500/60 text-amber-300 shadow-sm"
                    : "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800"
                } border`}
              >
                <span>{preset.badge}</span>
                <span className="font-semibold">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Formulário de Coordenadas */}
      <form onSubmit={handleManualCoordSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">
            Latitude Central
          </label>
          <div className="relative">
            <input
              type="text"
              value={latInput}
              onChange={(e) => {
                setLatInput(e.target.value);
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) onCoordinatesChange(val, lng);
              }}
              placeholder="ex: 43.5442968"
              className="w-full bg-slate-950/80 border border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-400 outline-none transition-all"
            />
            <Crosshair className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">
            Longitude Central
          </label>
          <div className="relative">
            <input
              type="text"
              value={lngInput}
              onChange={(e) => {
                setLngInput(e.target.value);
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) onCoordinatesChange(lat, val);
              }}
              placeholder="ex: -79.7399437"
              className="w-full bg-slate-950/80 border border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-400 outline-none transition-all"
            />
            <Crosshair className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
          </div>
        </div>
      </form>

      {/* Botão de Localização do Smartphone / GPS */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isGettingGps}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900/90 hover:bg-slate-800 text-purple-300 border border-purple-500/30 transition-all active:scale-95 shadow-sm"
        >
          {isGettingGps ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
          ) : (
            <Navigation className="w-3.5 h-3.5 text-purple-400" />
          )}
          <span>{isGettingGps ? "Triangulando GPS..." : "📍 Usar Meu GPS Atual"}</span>
        </button>

        {gpsError && (
          <span className="text-[11px] text-rose-400 font-medium">{gpsError}</span>
        )}
      </div>

      {/* Sliders / Opções de Raio e Meta de Shinys */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800/80">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-slate-300">
              Raio de Varredura
            </span>
            <span className="text-xs font-mono font-bold text-amber-400">
              {radiusKm} km
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[15, 30, 60, 100].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRadiusChange(r)}
                className={`py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  radiusKm === r
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                    : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200"
                }`}
              >
                {r}km
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-slate-300">
              Meta de Shinys (Blacklist)
            </span>
            <span className="text-xs font-mono font-bold text-purple-400">
              {targetCount} alvos
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[10, 20, 35, 50].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onTargetCountChange(c)}
                className={`py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  targetCount === c
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/50"
                    : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Botão de Disparo do Scanner */}
      <div className="mt-5">
        <button
          type="button"
          onClick={onExecuteScan}
          disabled={isLoading}
          className={`w-full py-3.5 px-6 rounded-2xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-xl active:scale-[0.99] ${
            isLoading
              ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-wait"
              : "bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white shadow-purple-900/30 border border-amber-400/30 hover:shadow-purple-700/50"
          }`}
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
              <span>Varrendo Satélites & Desviando Limites...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300 animate-bounce" />
              <span>Escanear Shinys no Raio ({radiusKm}km)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
