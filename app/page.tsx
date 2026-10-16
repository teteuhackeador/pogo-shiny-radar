"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "@/components/Header";
import { ControlPanel } from "@/components/ControlPanel";
import { FilterBar, SpeciesCountItem } from "@/components/FilterBar";
import { ShinyCard } from "@/components/ShinyCard";
import { SniperModal } from "@/components/SniperModal";
import {
  PokemonSpawn,
  IvFilterOption,
  SortOption,
  RadarHuntMode,
  HuntResponse
} from "@/types/pokemon";
import { calculateDistanceKm, DEFAULT_TRAINER_CODE } from "@/lib/constants";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function Home() {
  // Coordenadas Centrais Iniciais (Mississauga / Ontário)
  const [lat, setLat] = useState<number>(43.5442968);
  const [lng, setLng] = useState<number>(-79.7399437);
  const [radiusKm, setRadiusKm] = useState<number>(50);
  const [targetCount, setTargetCount] = useState<number>(100);
  const [huntMode, setHuntMode] = useState<RadarHuntMode>("hundo_global");
  const [scannedHuntMode, setScannedHuntMode] = useState<RadarHuntMode>("hundo_global");

  // Estados de Busca e Dados
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [allPokemons, setAllPokemons] = useState<PokemonSpawn[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Persistência em LocalStorage
  const [capturedIds, setCapturedIds] = useState<Set<string>>(new Set());
  const [revealedCoordsMap, setRevealedCoordsMap] = useState<Record<string, string>>({});
  const [hideCaptured, setHideCaptured] = useState<boolean>(false);
  const [hiddenSpecies, setHiddenSpecies] = useState<Set<string>>(new Set());

  // Rate limit de reveal
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // Filtros de UI
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [ivFilter, setIvFilter] = useState<IvFilterOption>("all");
  const [sortOption, setSortOption] = useState<SortOption>("distance");
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Modal do Shundo Sniper & Alarme
  const [isSniperModalOpen, setIsSniperModalOpen] = useState<boolean>(false);

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

      const savedHiddenSpecies = localStorage.getItem("pogo_hidden_species");
      if (savedHiddenSpecies) {
        const parsed = JSON.parse(savedHiddenSpecies);
        if (Array.isArray(parsed)) {
          setHiddenSpecies(new Set(parsed));
        }
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

  // Alternar ocultação de espécie específica (ex: Cacnea)
  const toggleHideSpecies = useCallback((speciesName: string) => {
    setHiddenSpecies((prev) => {
      const next = new Set(prev);
      if (next.has(speciesName)) {
        next.delete(speciesName);
        showToast(`Exibindo ${speciesName} novamente.`);
      } else {
        next.add(speciesName);
        showToast(`${speciesName} ocultado do radar.`);
      }
      try {
        localStorage.setItem("pogo_hidden_species", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, [showToast]);

  // Limpar todas as espécies ocultadas
  const clearHiddenSpecies = useCallback(() => {
    setHiddenSpecies(new Set());
    try {
      localStorage.removeItem("pogo_hidden_species");
    } catch {}
    showToast("Todas as espécies foram reexibidas.");
  }, [showToast]);

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

  // Execução do Scanner de Shinys via /api/hunt com suporte a override imediato
  const handleExecuteScan = async (overrideParams?: {
    mode?: RadarHuntMode;
    overrideLat?: number;
    overrideLng?: number;
    overrideRadius?: number;
  }) => {
    const activeMode = overrideParams?.mode || huntMode;
    const activeLat = overrideParams?.overrideLat ?? lat;
    const activeLng = overrideParams?.overrideLng ?? lng;
    const activeRadius = overrideParams?.overrideRadius ?? radiusKm;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      localStorage.setItem("pogo_last_coords", JSON.stringify({ lat: activeLat, lng: activeLng }));
    } catch {}

    try {
      const res = await fetch("/api/hunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: activeLat,
          lng: activeLng,
          radiusKm: activeRadius,
          targetCount,
          huntMode: activeMode,
          shinyAccount: DEFAULT_TRAINER_CODE,
          hiddenSpecies: Array.from(hiddenSpecies)
        })
      });

      const data: HuntResponse = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Erro ao consultar radar.");
        setIsLoading(false);
        return;
      }

      const results: PokemonSpawn[] = data.results || [];
      const now = Date.now();

      setScannedHuntMode(activeMode);

      setAllPokemons((prev) => {
        // Se o modo ativo for diferente do modo escaneado anteriormente, substitui por lista limpa
        if (activeMode !== scannedHuntMode) {
          return results;
        }
        // No mesmo modo, funde os novos achados com os spawns ativos anteriores (Living Pool)
        const spawnMap = new Map<string, PokemonSpawn>();
        prev.forEach((p) => {
          if (!p.despawn_at || new Date(p.despawn_at).getTime() > now) {
            spawnMap.set(p.encounter_id, p);
          }
        });
        results.forEach((p) => spawnMap.set(p.encounter_id, p));
        return Array.from(spawnMap.values());
      });

      const totalLoaded = results.length;
      let countMsg = `${totalLoaded} alvos carregados.`;
      if (activeMode === "hundo_global") {
        const shundosFound = results.filter((s) => s.shiny).length;
        countMsg = `${totalLoaded} Hundos 100% IV no radar (${shundosFound} Shundos pro seu código!)`;
      } else if (activeMode === "shiny_global") {
        countMsg = `${totalLoaded} Shinies ativos confirmados pra sua conta no mundo!`;
      } else if (activeMode === "shundo_local") {
        countMsg = `${totalLoaded} Shundo(s) (15/15/15) no raio de ${activeRadius}km!`;
      } else if (activeMode === "shundo_global") {
        countMsg = `${totalLoaded} Shundo(s) (15/15/15) confirmados no mundo!`;
      } else if (activeMode === "local_shiny") {
        countMsg = `${totalLoaded} Shinies detectados no raio de ${activeRadius}km!`;
      }
      showToast(countMsg);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de rede ao conectar com o radar.");
    } finally {
      setIsLoading(false);
    }
  };

  // Disparo manual do scan pelo botão ou inicialização
  const handleHuntModeChange = (newMode: RadarHuntMode) => {
    setHuntMode(newMode);
    // NÃO dispara busca automática ao trocar de categoria, respeitando a escolha do usuário
  };

  // Disparo automático inicial apenas uma vez ao abrir o radar
  useEffect(() => {
    handleExecuteScan({ mode: "hundo_global" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Contagem de cada espécie disponível nos resultados brutos da busca
  const availableSpeciesList: SpeciesCountItem[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of allPokemons) {
      counts.set(p.pokemon_name, (counts.get(p.pokemon_name) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allPokemons]);

  // Filtragem e Ordenação
  const filteredPokemons = useMemo(() => {
    return allPokemons
      .filter((p) => {
        const isCap = capturedIds.has(p.encounter_id);

        // Se o modo NÃO for 100% IV Global (hundo_global), exige que seja shiny!
        if (scannedHuntMode !== "hundo_global" && !p.shiny) return false;

        // Ocultar automaticamente os que já sumiram / expiraram
        if (p.despawn_at && currentTime > 0) {
          const despawnMs = new Date(p.despawn_at).getTime();
          if (despawnMs <= currentTime) return false;
        }

        // Filtro de Espécies Ocultadas pelo Usuário (ex: Cacnea)
        if (hiddenSpecies.has(p.pokemon_name)) return false;

        // Filtro Ocultar Pegos
        if (hideCaptured && isCap) return false;

        // Filtro por Busca
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = p.pokemon_name.toLowerCase().includes(q);
          const matchLoc = p.location?.toLowerCase().includes(q);
          if (!matchName && !matchLoc) return false;
        }

        // Se o modo for Shundo (local ou global): estritamente 100% IV (15/15/15) + Shiny!
        if (scannedHuntMode === "shundo_local" || scannedHuntMode === "shundo_global") {
          if (!p.shiny || p.iv_percent !== 100 || p.raw_iv !== "15/15/15") return false;
        }

        // Se o modo for 100% IV Global: exige 100% IV
        if (scannedHuntMode === "hundo_global") {
          if (p.iv_percent !== 100) return false;
        }

        // Filtro por IV nos modos de busca de shiny (local_shiny e shiny_global)
        if (scannedHuntMode === "local_shiny" || scannedHuntMode === "shiny_global") {
          if (ivFilter === "50" && p.iv_percent < 50) return false;
          if (ivFilter === "80" && p.iv_percent < 80) return false;
          if (ivFilter === "90" && p.iv_percent < 90) return false;
          if (ivFilter === "100" && (p.iv_percent !== 100 || p.raw_iv !== "15/15/15")) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Shundos (15/15/15 + Shiny) sempre no topo
        const aIsShundo = a.shiny && a.iv_percent === 100 && a.raw_iv === "15/15/15";
        const bIsShundo = b.shiny && b.iv_percent === 100 && b.raw_iv === "15/15/15";
        if (aIsShundo && !bIsShundo) return -1;
        if (!aIsShundo && bIsShundo) return 1;

        if (sortOption === "distance") {
          const getDist = (p: PokemonSpawn): number => {
            const rev = revealedCoordsMap[p.encounter_id] || p.exact_coords;
            if (rev) {
              const [cLat, cLng] = rev.split(",").map(Number);
              if (!isNaN(cLat) && !isNaN(cLng)) {
                return calculateDistanceKm(lat, lng, cLat, cLng);
              }
            }
            if (p.apx_lat != null && p.apx_long != null) {
              return calculateDistanceKm(lat, lng, p.apx_lat, p.apx_long);
            }
            if (p.distance_km != null) {
              return p.distance_km;
            }
            return 9999;
          };

          return getDist(a) - getDist(b);
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
  }, [allPokemons, capturedIds, hiddenSpecies, hideCaptured, searchQuery, ivFilter, sortOption, currentTime, revealedCoordsMap, lat, lng, scannedHuntMode]);

  const capturedCount = useMemo(() => {
    return allPokemons.filter((p) => capturedIds.has(p.encounter_id)).length;
  }, [allPokemons, capturedIds]);

  const availableCount = allPokemons.length - capturedCount;

  return (
    <main className="w-full max-w-lg mx-auto px-3 sm:px-4 py-3 min-h-screen pb-16">
      {/* Cabeçalho */}
      <Header
        cooldownSeconds={cooldownSeconds}
        totalFound={allPokemons.length}
        onOpenSniper={() => setIsSniperModalOpen(true)}
      />

      {/* Painel Tático de Controle e Modos */}
      <ControlPanel
        lat={lat}
        lng={lng}
        radiusKm={radiusKm}
        targetCount={targetCount}
        isLoading={isLoading}
        huntMode={huntMode}
        scannedHuntMode={scannedHuntMode}
        onCoordinatesChange={(newLat, newLng) => {
          setLat(newLat);
          setLng(newLng);
        }}
        onRadiusChange={(r) => setRadiusKm(r)}
        onTargetCountChange={(c) => setTargetCount(c)}
        onHuntModeChange={handleHuntModeChange}
        onExecuteScan={() => handleExecuteScan()}
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
          {/* Barra de Filtros com Gerenciador de Espécies */}
          <FilterBar
            hideCaptured={hideCaptured}
            totalCount={allPokemons.length}
            availableCount={availableCount}
            capturedCount={capturedCount}
            searchQuery={searchQuery}
            ivFilter={ivFilter}
            sortOption={sortOption}
            hiddenSpecies={hiddenSpecies}
            availableSpeciesList={availableSpeciesList}
            onToggleHideCaptured={toggleHideCaptured}
            onSearchChange={setSearchQuery}
            onIvFilterChange={setIvFilter}
            onSortOptionChange={setSortOption}
            onToggleHideSpecies={toggleHideSpecies}
            onClearHiddenSpecies={clearHiddenSpecies}
            onClearCaptured={handleClearCaptured}
          />

          {/* Lista de Cards Compactos */}
          {filteredPokemons.length === 0 ? (
            <div className="py-8 text-center rounded-2xl border border-[#27272a] bg-[#121214] p-4 text-xs text-zinc-400">
              Nenhum Pokémon corresponde aos filtros ou espécies ativas.
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
                  onHideSpecies={toggleHideSpecies}
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

      {/* Modal Shundo Sniper & Alarme Noturno */}
      <SniperModal
        isOpen={isSniperModalOpen}
        onClose={() => setIsSniperModalOpen(false)}
        trainerCode={DEFAULT_TRAINER_CODE}
      />
    </main>
  );
}
