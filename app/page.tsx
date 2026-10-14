"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "@/components/Header";
import { ControlPanel } from "@/components/ControlPanel";
import { FilterBar } from "@/components/FilterBar";
import { ShinyCard } from "@/components/ShinyCard";
import {
  PokemonSpawn,
  TabOption,
  IvFilterOption,
  SortOption,
  HuntResponse
} from "@/types/pokemon";
import { Sparkles, Radar, AlertTriangle, Trophy, CheckCircle, RefreshCw } from "lucide-react";

export default function Home() {
  // Coordenadas Centrais Iniciais (Ontário / Mississauga do Mestre)
  const [lat, setLat] = useState<number>(43.5442968);
  const [lng, setLng] = useState<number>(-79.7399437);
  const [radiusKm, setRadiusKm] = useState<number>(50);
  const [targetCount, setTargetCount] = useState<number>(30);

  // Estados de Busca e Dados
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [allPokemons, setAllPokemons] = useState<PokemonSpawn[]>([]);
  const [roundsExecuted, setRoundsExecuted] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Persistência em LocalStorage
  const [capturedIds, setCapturedIds] = useState<Set<string>>(new Set());
  const [revealedCoordsMap, setRevealedCoordsMap] = useState<Record<string, string>>({});

  // Rate limit de reveal
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // Filtros de UI
  const [currentTab, setCurrentTab] = useState<TabOption>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [ivFilter, setIvFilter] = useState<IvFilterOption>("all");
  const [sortOption, setSortOption] = useState<SortOption>("despawn");

  // Carrega preferências e capturados salvos no celular ao iniciar
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
    } catch (e) {
      console.warn("Falha ao recuperar dados do localStorage:", e);
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

  // Salvar no localStorage sempre que os capturados mudarem
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
      } catch (e) {}
      return next;
    });
  }, []);

  // Salvar revelação de coordenadas
  const handleRevealSuccess = useCallback((encounterId: string, coords: string) => {
    setRevealedCoordsMap((prev) => {
      const next = { ...prev, [encounterId]: coords };
      try {
        localStorage.setItem("pogo_revealed_coords", JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  // Limpar lista de capturados
  const handleClearCaptured = useCallback(() => {
    if (confirm("Deseja realmente resetar o status de todos os pokémons capturados?")) {
      setCapturedIds(new Set());
      try {
        localStorage.removeItem("pogo_captured_ids");
      } catch (e) {}
    }
  }, []);

  // Execução do Scanner de Shinys via /api/hunt
  const handleExecuteScan = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    // Salva as últimas coordenadas utilizadas
    try {
      localStorage.setItem("pogo_last_coords", JSON.stringify({ lat, lng }));
    } catch (e) {}

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
        setErrorMessage(data.error || "Erro ao consultar radar de satélites.");
        setIsLoading(false);
        return;
      }

      setAllPokemons(data.results || []);
      setRoundsExecuted(data.rounds || 1);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de rede ao conectar com o servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  // Filtragem e Ordenação Reativa
  const filteredPokemons = useMemo(() => {
    return allPokemons
      .filter((p) => {
        const isCap = capturedIds.has(p.encounter_id);

        // Filtro por Tab
        if (currentTab === "available" && isCap) return false;
        if (currentTab === "captured" && !isCap) return false;

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
  }, [allPokemons, capturedIds, currentTab, searchQuery, ivFilter, sortOption]);

  const capturedCount = useMemo(() => {
    return allPokemons.filter((p) => capturedIds.has(p.encounter_id)).length;
  }, [allPokemons, capturedIds]);

  const availableCount = allPokemons.length - capturedCount;

  return (
    <main className="min-h-screen bg-[#05060a] text-slate-100 px-3 py-4 sm:px-6 sm:py-8 max-w-7xl mx-auto selection:bg-purple-600 selection:text-white">
      {/* Cabeçalho */}
      <Header cooldownSeconds={cooldownSeconds} totalFound={allPokemons.length} />

      {/* Painel de Controle de GPS e Raio */}
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

      {/* Mensagem de Erro se houver */}
      {errorMessage && (
        <div className="mt-4 p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Área de Resultados */}
      {allPokemons.length > 0 && (
        <div className="mt-6 space-y-4">
          {/* Barra de Filtros e Abas */}
          <FilterBar
            currentTab={currentTab}
            totalCount={allPokemons.length}
            availableCount={availableCount}
            capturedCount={capturedCount}
            searchQuery={searchQuery}
            ivFilter={ivFilter}
            sortOption={sortOption}
            onTabChange={setCurrentTab}
            onSearchChange={setSearchQuery}
            onIvFilterChange={setIvFilter}
            onSortOptionChange={setSortOption}
            onClearCaptured={handleClearCaptured}
          />

          {/* Resumo do Scan */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Exibindo <strong>{filteredPokemons.length}</strong> de{" "}
              <strong>{allPokemons.length}</strong> shinys encontrados ({roundsExecuted} ciclos
              de blacklist)
            </span>
            <span className="font-mono text-[11px] text-amber-400/80">
              Raio: {radiusKm}km
            </span>
          </div>

          {/* Grid de Cards */}
          {filteredPokemons.length === 0 ? (
            <div className="py-12 text-center rounded-3xl border border-slate-800/80 bg-slate-950/40 p-6">
              <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">
                Nenhum shiny corresponde aos filtros selecionados
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Tente ajustar o IV mínimo, limpar a busca ou mudar para a aba &apos;Todos&apos;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
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
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Estado Vazio Inicial */}
      {allPokemons.length === 0 && !isLoading && !errorMessage && (
        <div className="mt-8 py-16 px-6 text-center rounded-3xl border border-slate-800/60 bg-gradient-to-b from-slate-950/60 to-[#07080f]/80 backdrop-blur-md">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500/20 via-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-950/30">
            <Radar className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight">
            Pronto para Iniciar a Varredura de Shinys
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mt-2 leading-relaxed">
            Selecione uma localização no mapa, utilize seu GPS ou escolha Toronto/Zaragoza,
            e clique no botão <strong>Escanear Shinys</strong> para romper o limite padrão e
            listar dezenas de alvos em tempo real.
          </p>
        </div>
      )}
    </main>
  );
}
