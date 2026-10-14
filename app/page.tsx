"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "@/components/Header";
import { ControlPanel } from "@/components/ControlPanel";
import { FilterBar } from "@/components/FilterBar";
import { ShinyCard } from "@/components/ShinyCard";
import {
  PokemonSpawn,
  IvFilterOption,
  SortOption,
  HuntResponse
} from "@/types/pokemon";
import { calculateDistanceKm } from "@/lib/constants";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function Home() {
  // Coordenadas Centrais Iniciais (Mississauga / Ontário)
  const [lat, setLat] = useState<number>(43.5442968);
  const [lng, setLng] = useState<number>(-79.7399437);
  const [radiusKm, setRadiusKm] = useState<number>(50);
  const [targetCount, setTargetCount] = useState<number>(30);

  // Estados de Busca e Dados
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [allPokemons, setAllPokemons] = useState<PokemonSpawn[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Persistência em LocalStorage
  const [capturedIds, setCapturedIds] = useState<Set<string>>(new Set());
  const [revealedCoordsMap, setRevealedCoordsMap] = useState<Record<string, string>>({});
  const [hideCaptured, setHideCaptured] = useState<boolean>(false);

  // Rate limit de reveal
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // Filtros de UI
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [ivFilter, setIvFilter] = useState<IvFilterOption>("all");
  const [sortOption, setSortOption] = useState<SortOption>("distance");
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Ticker a cada 1 segundo para expurgar spawns expirados em tempo real
  useEffect(() => {
    setCurrentTime(Date.now());
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Toast discreto flutuante
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2500);
  }, []);

  // Carrega preferências salvas no smartphone ao iniciar
  useEffect(() => {
    try {
      const savedCaptured = localStorage.getItem("pogo_captured_ids");
      if (savedCaptured) {
        const parsed = JSON.parse(savedCaptured);
        if (Array.isArray(parsed)) {
          setCapturedIds(new Set(parsed));
        }
      }

      const savedReveals = localStorage.getItem("pogo_revealed_coords");
      if (savedReveals) {
        const parsed = JSON.parse(savedReveals);
        if (typeof parsed === "object" && parsed !== null) {
          setRevealedCoordsMap(parsed);
        }
      }

      const savedCoords = localStorage.getItem("pogo_last_coords");
      if (savedCoords) {
        const parsed = JSON.parse(savedCoords);
        if (parsed.lat && parsed.lng) {
          setLat(parsed.lat);
          setLng(parsed.lng);
        }
      }

      const savedHideCaptured = localStorage.getItem("pogo_hide_captured");
      if (savedHideCaptured !== null) {
        setHideCaptured(savedHideCaptured === "true");
      }
    } catch {
      // Ignora erro no localStorage em modo anônimo
    }
  }, []);

  // Temporizador regressivo do Cooldown de Rate Limit
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Alternar status de capturado
  const toggleCaptured = useCallback((encounterId: string) => {
    setCapturedIds((prev) => {
      const next = new Set(prev);
      if (next.has(encounterId)) {
        next.delete(encounterId);
      } else {
        next.add(encounterId);
      }
      try {
        localStorage.setItem("pogo_captured_ids", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  // Alternar toggle "Ocultar pegos"
  const toggleHideCaptured = useCallback(() => {
    setHideCaptured((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("pogo_hide_captured", String(next));
      } catch {}
      return next;
    });
  }, []);

  // Salvar revelação de coordenadas
  const handleRevealSuccess = useCallback(
    (encounterId: string, coords: string) => {
      setRevealedCoordsMap((prev) => {
        const next = { ...prev, [encounterId]: coords };
        try {
          localStorage.setItem("pogo_revealed_coords", JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    []
  );

  // Limpar lista de capturados
  const handleClearCaptured = useCallback(() => {
    if (confirm("Resetar todos os Pokémon marcados como capturados?")) {
      setCapturedIds(new Set());
      try {
        localStorage.removeItem("pogo_captured_ids");
      } catch {}
      showToast("Lista de capturados resetada.");
    }
  }, [showToast]);

  // Execução do Scanner de Shinys via /api/hunt
  const handleExecuteScan = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    // Salva as últimas coordenadas utilizadas
    try {
      localStorage.setItem("pogo_last_coords", JSON.stringify({ lat, lng }));
    } catch {}

    try {
      const res = await fetch("/api/hunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat,
          lng,
          radiusKm,
          targetCount
        })
      });

      const data: HuntResponse = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Erro ao consultar radar.");
        setIsLoading(false);
        return;
      }

      setAllPokemons(data.results || []);
      showToast(`${data.results?.length || 0} shinys encontrados.`);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de rede ao conectar com o radar.");
    } finally {
      setIsLoading(false);
    }
  };

  // Filtragem e Ordenação
  const filteredPokemons = useMemo(() => {
    return allPokemons
      .filter((p) => {
        const isCap = capturedIds.has(p.encounter_id);

        // Ocultar automaticamente os que já sumiram / expiraram
        if (p.despawn_at && currentTime > 0) {
          const despawnMs = new Date(p.despawn_at).getTime();
          if (despawnMs <= currentTime) return false;
        }

        // Filtro Ocultar Pegos
        if (hideCaptured && isCap) return false;

        // Filtro por Busca
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = p.pokemon_name.toLowerCase().includes(q);
          const matchLoc = p.location?.toLowerCase().includes(q);
          if (!matchName && !matchLoc) return false;
        }

        // Filtro por IV
        if (ivFilter === "50" && p.iv_percent < 50) return false;
        if (ivFilter === "80" && p.iv_percent < 80) return false;
        if (ivFilter === "90" && p.iv_percent < 90) return false;
        if (ivFilter === "100" && p.iv_percent < 100) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortOption === "distance") {
          const coordsA = revealedCoordsMap[a.encounter_id] || a.exact_coords;
          const coordsB = revealedCoordsMap[b.encounter_id] || b.exact_coords;
          if (coordsA && coordsB) {
            const [latA, lngA] = coordsA.split(',').map(Number);
            const [latB, lngB] = coordsB.split(',').map(Number);
            const distA = calculateDistanceKm(lat, lng, latA, lngA);
            const distB = calculateDistanceKm(lat, lng, latB, lngB);
            return distA - distB;
          }
          if (coordsA && !coordsB) return -1;
          if (!coordsA && coordsB) return 1;
          const rankA = a.distance_rank ?? 999;
          const rankB = b.distance_rank ?? 999;
          return rankA - rankB;
        }
        if (sortOption === "despawn") {
          const timeA = new Date(a.despawn_at).getTime();
          const timeB = new Date(b.despawn_at).getTime();
          return timeA - timeB;
        }
        if (sortOption === "iv_desc") {
          return b.iv_percent - a.iv_percent;
        }
        if (sortOption === "cp_desc") {
          return b.cp - a.cp;
        }
        if (sortOption === "level_desc") {
          return b.level - a.level;
        }
        return 0;
      });
  }, [allPokemons, capturedIds, hideCaptured, searchQuery, ivFilter, sortOption, currentTime, revealedCoordsMap, lat, lng]);

  const capturedCount = useMemo(() => {
    return allPokemons.filter((p) => capturedIds.has(p.encounter_id)).length;
  }, [allPokemons, capturedIds]);

  const availableCount = allPokemons.length - capturedCount;

  return (
    <main className="w-full max-w-lg mx-auto px-3 sm:px-4 py-3 min-h-screen pb-16">
      {/* Cabeçalho */}
      <Header cooldownSeconds={cooldownSeconds} totalFound={allPokemons.length} />

      {/* Painel de Coordenadas e Scan */}
      <ControlPanel
        lat={lat}
        lng={lng}
        radiusKm={radiusKm}
        targetCount={targetCount}
        isLoading={isLoading}
        onCoordinatesChange={(newLat, newLng) => {
          setLat(newLat);
          setLng(newLng);
        }}
        onRadiusChange={(r) => setRadiusKm(r)}
        onTargetCountChange={(c) => setTargetCount(c)}
        onExecuteScan={handleExecuteScan}
      />

      {/* Mensagem de Erro */}
      {errorMessage && (
        <div className="mt-3 p-3 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Resultados e Filtros */}
      {allPokemons.length > 0 && (
        <div className="mt-4 space-y-3">
          {/* Barra de Filtros */}
          <FilterBar
            hideCaptured={hideCaptured}
            totalCount={allPokemons.length}
            availableCount={availableCount}
            capturedCount={capturedCount}
            searchQuery={searchQuery}
            ivFilter={ivFilter}
            sortOption={sortOption}
            onToggleHideCaptured={toggleHideCaptured}
            onSearchChange={setSearchQuery}
            onIvFilterChange={setIvFilter}
            onSortOptionChange={setSortOption}
            onClearCaptured={handleClearCaptured}
          />

          {/* Lista de Cards Compactos */}
          {filteredPokemons.length === 0 ? (
            <div className="py-8 text-center rounded-2xl border border-[#27272a] bg-[#121214] p-4 text-xs text-zinc-400">
              Nenhum Pokémon corresponde aos filtros ativos.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredPokemons.map((pokemon) => (
                <ShinyCard
                  key={pokemon.encounter_id}
                  pokemon={pokemon}
                  coordsCenter={{ lat, lng }}
                  isCaptured={capturedIds.has(pokemon.encounter_id)}
                  revealedCoords={revealedCoordsMap[pokemon.encounter_id]}
                  onToggleCaptured={toggleCaptured}
                  onRevealSuccess={handleRevealSuccess}
                  onRateLimited={(retry) => setCooldownSeconds(retry)}
                  onToast={showToast}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toast Notifier Flutuante no Rodapé */}
      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#18181b] border border-[#27272a] shadow-xl text-xs text-zinc-100 font-medium animate-in fade-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </main>
  );
}
