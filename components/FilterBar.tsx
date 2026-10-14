"use client";

import React from "react";
import { TabOption, IvFilterOption, SortOption } from "@/types/pokemon";
import {
  Search,
  Filter,
  ArrowUpDown,
  Sparkles,
  CheckCircle,
  Eye,
  Trash2
} from "lucide-react";

interface FilterBarProps {
  currentTab: TabOption;
  totalCount: number;
  availableCount: number;
  capturedCount: number;
  searchQuery: string;
  ivFilter: IvFilterOption;
  sortOption: SortOption;
  onTabChange: (tab: TabOption) => void;
  onSearchChange: (query: string) => void;
  onIvFilterChange: (iv: IvFilterOption) => void;
  onSortOptionChange: (sort: SortOption) => void;
  onClearCaptured: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  currentTab,
  totalCount,
  availableCount,
  capturedCount,
  searchQuery,
  ivFilter,
  sortOption,
  onTabChange,
  onSearchChange,
  onIvFilterChange,
  onSortOptionChange,
  onClearCaptured
}) => {
  return (
    <div className="bg-[#090b14]/80 border border-slate-800/80 rounded-2xl p-3 sm:p-4 backdrop-blur-md shadow-lg">
      {/* Abas Superiores de Visualização */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onTabChange("all")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "all"
                ? "bg-gradient-to-r from-amber-500/20 to-purple-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Todos ({totalCount})</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange("available")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "available"
                ? "bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Pendentes ({availableCount})</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange("captured")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === "captured"
                ? "bg-emerald-600/30 text-emerald-200 border border-emerald-500/50 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Capturados ({capturedCount})</span>
          </button>
        </div>

        {capturedCount > 0 && (
          <button
            type="button"
            onClick={onClearCaptured}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-rose-400 transition-colors ml-auto"
            title="Zerar lista de capturados salvos"
          >
            <Trash2 className="w-3 h-3" />
            <span>Resetar Capturados</span>
          </button>
        )}
      </div>

      {/* Linha de Filtros: Busca, IV e Ordenação */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
        {/* Campo de Busca por Nome */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filtrar por nome (ex: Charizard)..."
            className="w-full bg-slate-950/80 border border-slate-800 focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-400 outline-none transition-all"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
        </div>

        {/* Filtro de IV Mínimo */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <select
            value={ivFilter}
            onChange={(e) => onIvFilterChange(e.target.value as IvFilterOption)}
            className="w-full bg-slate-950/80 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none transition-all cursor-pointer font-medium"
          >
            <option value="all">Filtro IV: Qualquer IV</option>
            <option value="50">IV Mínimo: 50%+</option>
            <option value="80">IV Mínimo: 80%+ (Ótimo)</option>
            <option value="90">IV Mínimo: 90%+ (Quase Perfeito)</option>
            <option value="100">👑 Apenas 100% (SHUNDO)</option>
          </select>
        </div>

        {/* Ordenação */}
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <select
            value={sortOption}
            onChange={(e) => onSortOptionChange(e.target.value as SortOption)}
            className="w-full bg-slate-950/80 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none transition-all cursor-pointer font-medium"
          >
            <option value="despawn">⏳ Vai sumir primeiro</option>
            <option value="iv_desc">💎 Maior IV primeiro</option>
            <option value="cp_desc">⚔️ Maior CP primeiro</option>
            <option value="level_desc">🛡️ Maior Nível primeiro</option>
          </select>
        </div>
      </div>
    </div>
  );
};
