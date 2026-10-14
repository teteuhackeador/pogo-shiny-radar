"use client";

import React from "react";
import { IvFilterOption, SortOption } from "@/types/pokemon";
import { Search, Trash2, CheckSquare, Square } from "lucide-react";

interface FilterBarProps {
  hideCaptured: boolean;
  totalCount: number;
  availableCount: number;
  capturedCount: number;
  searchQuery: string;
  ivFilter: IvFilterOption;
  sortOption: SortOption;
  onToggleHideCaptured: () => void;
  onSearchChange: (query: string) => void;
  onIvFilterChange: (iv: IvFilterOption) => void;
  onSortOptionChange: (sort: SortOption) => void;
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
  onToggleHideCaptured,
  onSearchChange,
  onIvFilterChange,
  onSortOptionChange,
  onClearCaptured
}) => {
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
            <option value="despawn">Ordem: Despawn</option>
            <option value="iv_desc">Ordem: Maior IV</option>
            <option value="cp_desc">Ordem: Maior CP</option>
            <option value="level_desc">Ordem: Maior Nível</option>
          </select>
        </div>
      </div>

      {/* Linha Inferior: Toggle "Ocultar pegos" e Contador */}
      <div className="flex items-center justify-between pt-1 border-t border-[#27272a] text-xs">
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
