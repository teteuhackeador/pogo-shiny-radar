"use client";

import React, { useState } from "react";
import { IvFilterOption, SortOption } from "@/types/pokemon";
import {
  Search,
  Trash2,
  CheckSquare,
  Square,
  EyeOff,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  Layers
} from "lucide-react";

export interface SpeciesCountItem {
  name: string;
  count: number;
}

interface FilterBarProps {
  hideCaptured: boolean;
  totalCount: number;
  availableCount: number;
  capturedCount: number;
  searchQuery: string;
  ivFilter: IvFilterOption;
  sortOption: SortOption;
  hiddenSpecies: Set<string>;
  availableSpeciesList: SpeciesCountItem[];
  onToggleHideCaptured: () => void;
  onSearchChange: (query: string) => void;
  onIvFilterChange: (iv: IvFilterOption) => void;
  onSortOptionChange: (sort: SortOption) => void;
  onToggleHideSpecies: (name: string) => void;
  onClearHiddenSpecies: () => void;
  onClearCaptured: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  hideCaptured,
  totalCount,
  availableCount,
  capturedCount,
  searchQuery,
  ivFilter,
  sortOption,
  hiddenSpecies,
  availableSpeciesList,
  onToggleHideCaptured,
  onSearchChange,
  onIvFilterChange,
  onSortOptionChange,
  onToggleHideSpecies,
  onClearHiddenSpecies,
  onClearCaptured
}) => {
  const [showSpeciesManager, setShowSpeciesManager] = useState<boolean>(false);

  return (
    <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-3 sm:p-3.5 space-y-2.5 text-zinc-100">
      {/* Linha Superior: Busca por Nome */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por Pokémon..."
          className="w-full bg-[#18181b] border border-[#27272a] focus:border-zinc-500 rounded-xl pl-8 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none transition-colors"
        />
        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5 pointer-events-none" />
      </div>

      {/* Linha Central: Filtros de IV e Ordenação */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <select
            value={ivFilter}
            onChange={(e) => onIvFilterChange(e.target.value as IvFilterOption)}
            className="w-full bg-[#18181b] border border-[#27272a] focus:border-zinc-500 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 outline-none cursor-pointer"
          >
            <option value="all">IV: Qualquer</option>
            <option value="50">IV: 50%+</option>
            <option value="80">IV: 80%+</option>
            <option value="90">IV: 90%+</option>
            <option value="100">IV: 100% (Shundo)</option>
          </select>
        </div>

        <div>
          <select
            value={sortOption}
            onChange={(e) => onSortOptionChange(e.target.value as SortOption)}
            className="w-full bg-[#18181b] border border-[#27272a] focus:border-zinc-500 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 outline-none cursor-pointer"
          >
            <option value="distance">Ordem: Mais Perto (Distância)</option>
            <option value="despawn">Ordem: Despawn</option>
            <option value="iv_desc">Ordem: Maior IV</option>
            <option value="cp_desc">Ordem: Maior CP</option>
            <option value="level_desc">Ordem: Maior Nível</option>
          </select>
        </div>
      </div>

      {/* Chips de Espécies Ocultas Ativas */}
      {hiddenSpecies.size > 0 && (
        <div className="pt-2 border-t border-[#27272a]">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="flex items-center gap-1 text-rose-300 font-medium">
              <EyeOff className="w-3 h-3 text-rose-400" />
              <span>Ocultos ({hiddenSpecies.size})</span>
            </span>
            <button
              type="button"
              onClick={onClearHiddenSpecies}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Reexibir tudo
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
            {Array.from(hiddenSpecies).map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => onToggleHideSpecies(sp)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-rose-950/30 text-rose-300 border border-rose-900/50 hover:bg-rose-900/40 transition-colors"
                title={`Clique para reexibir ${sp}`}
              >
                <span>{sp}</span>
                <X className="w-3 h-3 text-rose-400 hover:text-white" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gerenciador Expansível de Todas as Espécies da Varredura */}
      {showSpeciesManager && availableSpeciesList.length > 0 && (
        <div className="pt-2 border-t border-[#27272a] space-y-1.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>Toque em uma espécie para ocultar/exibir:</span>
            <span className="font-mono text-zinc-300">{availableSpeciesList.length} espécies</span>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto no-scrollbar p-1 rounded-xl bg-[#0e0e11] border border-[#27272a]">
            {availableSpeciesList.map((item) => {
              const isHidden = hiddenSpecies.has(item.name);
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => onToggleHideSpecies(item.name)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    isHidden
                      ? "bg-rose-950/40 text-rose-400 line-through border border-rose-900/50 opacity-60"
                      : "bg-[#18181b] text-zinc-300 hover:text-white border border-[#27272a]"
                  }`}
                  title={isHidden ? `Reexibir ${item.name}` : `Ocultar todos os ${item.name}`}
                >
                  {isHidden ? (
                    <EyeOff className="w-3 h-3 text-rose-400" />
                  ) : (
                    <Eye className="w-3 h-3 text-zinc-500" />
                  )}
                  <span>{item.name}</span>
                  <span className="font-mono text-[10px] text-zinc-500">({item.count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Linha Inferior: Toggle "Ocultar pegos", Botão Espécies e Contador */}
      <div className="flex items-center justify-between pt-1 border-t border-[#27272a] text-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleHideCaptured}
            className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors py-0.5"
          >
            {hideCaptured ? (
              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Square className="w-3.5 h-3.5 text-zinc-500" />
            )}
            <span>Ocultar pegos</span>
            {capturedCount > 0 && (
              <span className="text-[11px] font-mono text-zinc-500">
                ({capturedCount})
              </span>
            )}
          </button>

          {/* Botão para abrir o seletor de espécies */}
          {availableSpeciesList.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSpeciesManager((prev) => !prev)}
              className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border transition-colors ${
                showSpeciesManager || hiddenSpecies.size > 0
                  ? "bg-[#1c1c20] text-zinc-200 border-zinc-600"
                  : "bg-transparent text-zinc-400 hover:text-zinc-200 border-transparent hover:border-[#27272a]"
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Espécies</span>
              {showSpeciesManager ? (
                <ChevronUp className="w-3 h-3 text-zinc-400" />
              ) : (
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {capturedCount > 0 && (
            <button
              type="button"
              onClick={onClearCaptured}
              className="text-[11px] text-zinc-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
              title="Limpar histórico de capturas"
            >
              <Trash2 className="w-3 h-3" />
              <span>Limpar</span>
            </button>
          )}

          <span className="text-[11px] font-mono text-zinc-400">
            {hideCaptured ? availableCount : totalCount} alvos
          </span>
        </div>
      </div>
    </div>
  );
};
