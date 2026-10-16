import { NextRequest, NextResponse } from "next/server";
import {
  BASE_API_URL,
  DEFAULT_POGO_TOKEN,
  DEFAULT_TRAINER_CODE,
  POGO_TOKENS,
  calculateDistanceKm
} from "@/lib/constants";
import { PokemonSpawn, RadarHuntMode } from "@/types/pokemon";

export const maxDuration = 30;

// Cache em memória no servidor (dura 20 segundos) para proteger o usuário de tomar 429 se clicar rápido
interface CachedResult {
  timestamp: number;
  data: any;
}
const searchCache = new Map<string, CachedResult>();

function getRandomSpoofedHeaders(authToken: string) {
  const ip = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254 + 1)}`;
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${authToken}`,
    "X-Forwarded-For": `${ip}, 127.0.0.1`,
    "Client-IP": ip,
    "X-Real-IP": ip,
    "CF-Connecting-IP": ip,
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15"
  };
}

// 8 fatias balanceadas multi-eixo (Níveis + Despawn + CP) distribuídas entre os 2 tokens do pool
interface SliceConfig {
  min: number;
  max: number;
  sort?: string;
}

const BALANCED_SLICES: SliceConfig[] = [
  { min: 1, max: 8, sort: "DSP" },
  { min: 9, max: 15, sort: "DSP" },
  { min: 16, max: 22, sort: "DSP" },
  { min: 23, max: 28, sort: "DSP" },
  { min: 29, max: 32, sort: "DSP" },
  { min: 33, max: 35, sort: "DSP" },
  { min: 15, max: 35, sort: "CP" }, // Injeta os maiores CPs do mundo
  { min: 1, max: 20, sort: "CP" }
];

// Helper para fetch com timeout e rotação de token
async function executeSearchWithRetry(payload: any, tokenIndex: number): Promise<{ results: any[]; rateLimited?: boolean; retryAfter?: number }> {
  const tokensToTry = [
    POGO_TOKENS[tokenIndex % POGO_TOKENS.length],
    POGO_TOKENS[(tokenIndex + 1) % POGO_TOKENS.length]
  ];

  for (const token of tokensToTry) {
    try {
      const res = await fetch(`${BASE_API_URL}/search`, {
        method: "POST",
        headers: getRandomSpoofedHeaders(token),
        signal: AbortSignal.timeout(9000),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        return { results: data.results || [] };
      }

      if (res.status === 429) {
        let retrySec = 15;
        try {
          const errData = await res.json();
          if (errData?.detail?.retry_after) {
            retrySec = parseInt(errData.detail.retry_after, 10);
          }
        } catch {}
        // Tenta o próximo token do pool
        continue;
      }
    } catch {
      continue;
    }
  }

  return { results: [], rateLimited: true, retryAfter: 15 };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lat = parseFloat(body.lat);
    const lng = parseFloat(body.lng);
    const radiusKm = parseFloat(body.radiusKm || 50);
    const targetCount = Math.min(parseInt(body.targetCount || 100, 10), 150);
    const trainerCode = body.shinyAccount || DEFAULT_TRAINER_CODE;
    const hiddenSpecies: string[] = Array.isArray(body.hiddenSpecies) ? body.hiddenSpecies : [];

    let mode: RadarHuntMode = body.huntMode || "hundo_global";
    if (body.isGlobal || body.shundoGlobal) {
      mode = "shundo_global";
    } else if (body.shundoOnly) {
      mode = "shundo_local";
    }

    // Chave de cache para evitar rajadas repetidas no mesmo modo
    const cacheKey = `${mode}_${trainerCode}_${isNaN(lat) ? "global" : `${lat.toFixed(2)}_${lng.toFixed(2)}`}`;
    const now = Date.now();
    const cached = searchCache.get(cacheKey);
    if (cached && now - cached.timestamp < 15000) {
      return NextResponse.json({
        ...cached.data,
        cached: true
      });
    }

    const allSpawns = new Map<string, PokemonSpawn>();
    let rateLimitHit = false;
    let maxRetryAfter = 0;

    // =========================================================================
    // MODO 1: 100% IV GLOBAL (HUNDOS MUNDIAIS COM SHUNDOS NO TOPO)
    // =========================================================================
    if (mode === "hundo_global") {
      const slicePromises = BALANCED_SLICES.map(async (slice, idx) => {
        if (idx > 0) {
          await new Promise((r) => setTimeout(r, idx * 120));
        }
        const payload = {
          shiny_only: false,
          shiny_account: trainerCode,
          level_min: slice.min,
          level_max: slice.max,
          iv_mode: "percent",
          iv_percent_min: 100,
          iv_percent_max: 100,
          sort: slice.sort || "DSP"
        };
        return executeSearchWithRetry(payload, idx);
      });

      const sliceResults = await Promise.all(slicePromises);

      for (const res of sliceResults) {
        if (res.rateLimited) {
          rateLimitHit = true;
          if (res.retryAfter) maxRetryAfter = Math.max(maxRetryAfter, res.retryAfter);
        }
        for (const p of res.results) {
          if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;
          if (hiddenSpecies.includes(p.pokemon_name)) continue;

          const dist =
            p.apx_lat != null && p.apx_long != null && !isNaN(lat) && !isNaN(lng)
              ? calculateDistanceKm(lat, lng, p.apx_lat, p.apx_long)
              : p.distance_km ?? null;

          allSpawns.set(p.encounter_id, {
            ...p,
            raw_iv: p.raw_iv || "15/15/15",
            iv_percent: 100,
            exact_coords: null,
            distance_km: dist
          });
        }
      }

      // Shundos (shiny: true) no topo absoluto! Seguidos por distância ou CP
      const finalList = Array.from(allSpawns.values())
        .sort((a, b) => {
          if (a.shiny && !b.shiny) return -1;
          if (!a.shiny && b.shiny) return 1;
          if (a.distance_km != null && b.distance_km != null) {
            return a.distance_km - b.distance_km;
          }
          return (b.cp || 0) - (a.cp || 0);
        })
        .slice(0, targetCount);

      const responsePayload = {
        success: true,
        count: finalList.length,
        mode: "hundo_global",
        rate_limited: rateLimitHit,
        retry_after: maxRetryAfter > 0 ? maxRetryAfter : undefined,
        results: finalList
      };

      if (finalList.length > 0) {
        searchCache.set(cacheKey, { timestamp: now, data: responsePayload });
      }

      return NextResponse.json(responsePayload);
    }

    // =========================================================================
    // MODO 2: SHUNDO GLOBAL (ESTRITAMENTE SHUNDOS REAIS 100% IV + SHINY NO MUNDO)
    // =========================================================================
    if (mode === "shundo_global") {
      const slicePromises = BALANCED_SLICES.map(async (slice, idx) => {
        if (idx > 0) {
          await new Promise((r) => setTimeout(r, idx * 120));
        }
        const payload = {
          shiny_only: true,
          shiny_account: trainerCode,
          level_min: slice.min,
          level_max: slice.max,
          iv_mode: "percent",
          iv_percent_min: 100,
          iv_percent_max: 100,
          sort: slice.sort || "DSP"
        };
        return executeSearchWithRetry(payload, idx);
      });

      const sliceResults = await Promise.all(slicePromises);

      for (const res of sliceResults) {
        if (res.rateLimited) {
          rateLimitHit = true;
          if (res.retryAfter) maxRetryAfter = Math.max(maxRetryAfter, res.retryAfter);
        }
        for (const p of res.results) {
          if (!p.shiny || p.iv_percent !== 100) continue;
          if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;
          if (hiddenSpecies.includes(p.pokemon_name)) continue;

          const dist =
            p.apx_lat != null && p.apx_long != null && !isNaN(lat) && !isNaN(lng)
              ? calculateDistanceKm(lat, lng, p.apx_lat, p.apx_long)
              : p.distance_km ?? null;

          allSpawns.set(p.encounter_id, {
            ...p,
            shiny: true,
            raw_iv: "15/15/15",
            iv_percent: 100,
            exact_coords: null,
            distance_km: dist
          });
        }
      }

      const finalList = Array.from(allSpawns.values())
        .sort((a, b) => {
          if (a.distance_km != null && b.distance_km != null) {
            return a.distance_km - b.distance_km;
          }
          return (b.cp || 0) - (a.cp || 0);
        })
        .slice(0, targetCount);

      const responsePayload = {
        success: true,
        count: finalList.length,
        mode: "shundo_global",
        rate_limited: rateLimitHit,
        retry_after: maxRetryAfter > 0 ? maxRetryAfter : undefined,
        results: finalList
      };

      if (finalList.length > 0) {
        searchCache.set(cacheKey, { timestamp: now, data: responsePayload });
      }

      return NextResponse.json(responsePayload);
    }

    // =========================================================================
    // MODO 3: TODOS OS SHINIES GLOBAIS DA CONTA (SHINIES ATIVOS NO MUNDO)
    // =========================================================================
    if (mode === "shiny_global") {
      const slicePromises = BALANCED_SLICES.map(async (slice, idx) => {
        if (idx > 0) {
          await new Promise((r) => setTimeout(r, idx * 120));
        }
        const payload = {
          shiny_only: true,
          shiny_account: trainerCode,
          level_min: slice.min,
          level_max: slice.max,
          sort: slice.sort || "DSP"
        };
        return executeSearchWithRetry(payload, idx);
      });

      const sliceResults = await Promise.all(slicePromises);

      for (const res of sliceResults) {
        if (res.rateLimited) {
          rateLimitHit = true;
          if (res.retryAfter) maxRetryAfter = Math.max(maxRetryAfter, res.retryAfter);
        }
        for (const p of res.results) {
          if (!p.shiny) continue;
          if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;
          if (hiddenSpecies.includes(p.pokemon_name)) continue;

          const dist =
            p.apx_lat != null && p.apx_long != null && !isNaN(lat) && !isNaN(lng)
              ? calculateDistanceKm(lat, lng, p.apx_lat, p.apx_long)
              : p.distance_km ?? null;

          allSpawns.set(p.encounter_id, {
            ...p,
            shiny: true,
            exact_coords: null,
            distance_km: dist
          });
        }
      }

      // Ordenar por IV decrescente
      const finalList = Array.from(allSpawns.values())
        .sort((a, b) => {
          if ((b.iv_percent || 0) !== (a.iv_percent || 0)) {
            return (b.iv_percent || 0) - (a.iv_percent || 0);
          }
          return (b.cp || 0) - (a.cp || 0);
        })
        .slice(0, targetCount);

      const responsePayload = {
        success: true,
        count: finalList.length,
        mode: "shiny_global",
        rate_limited: rateLimitHit,
        retry_after: maxRetryAfter > 0 ? maxRetryAfter : undefined,
        results: finalList
      };

      if (finalList.length > 0) {
        searchCache.set(cacheKey, { timestamp: now, data: responsePayload });
      }

      return NextResponse.json(responsePayload);
    }

    // =========================================================================
    // VALIDAÇÃO DE COORDENADAS PARA MODOS LOCAIS (NO RAIO)
    // =========================================================================
    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { success: false, error: "Coordenadas 'lat' e 'lng' são obrigatórias para buscas no raio." },
        { status: 400 }
      );
    }

    // =========================================================================
    // MODO 4: SHUNDO LOCAL (NO RAIO COM MAP LOOKUP + SEARCH HÍBRIDO)
    // =========================================================================
    if (mode === "shundo_local") {
      const deltaLat = radiusKm / 111.0;
      const deltaLng = radiusKm / (111.0 * Math.max(0.1, Math.cos((lat * Math.PI) / 180.0)));

      // 1. Map Lookup na Bounding Box do Raio
      const mapPayload = {
        mode: "pokemon",
        n_lat: lat + deltaLat,
        s_lat: lat - deltaLat,
        w_lng: lng - deltaLng,
        e_lng: lng + deltaLng,
        filters: {
          shiny_only: true,
          shiny_account: trainerCode,
          iv_mode: "percent",
          iv_percent_min: 100,
          iv_percent_max: 100,
          sort: "IV"
        }
      };

      try {
        const token = POGO_TOKENS[0];
        const res = await fetch(`${BASE_API_URL}/map/lookup`, {
          method: "POST",
          headers: getRandomSpoofedHeaders(token),
          signal: AbortSignal.timeout(9000),
          body: JSON.stringify(mapPayload)
        });

        if (res.ok) {
          const data = await res.json();
          for (const p of data.results || []) {
            if (!p.shiny || p.iv_percent !== 100) continue;
            if (p.despawn_at_ms && p.despawn_at_ms <= now) continue;
            if (hiddenSpecies.includes(p.pokemon_name)) continue;

            const pLat = p.apx_lat ?? null;
            const pLng = p.apx_long ?? null;
            const dist = pLat != null && pLng != null ? calculateDistanceKm(lat, lng, pLat, pLng) : null;
            if (dist != null && dist > radiusKm * 1.15) continue;

            allSpawns.set(p.encounter_id, {
              ...p,
              despawn_at: p.despawn_at_ms ? new Date(p.despawn_at_ms).toISOString() : p.despawn_at,
              shiny: true,
              raw_iv: "15/15/15",
              iv_percent: 100,
              exact_coords: null,
              distance_km: dist
            });
          }
        }
      } catch {}

      // 2. Search Complementar por Distância
      try {
        const searchPayload = {
          shiny_only: true,
          shiny_account: trainerCode,
          iv_mode: "percent",
          iv_percent_min: 100,
          iv_percent_max: 100,
          center_lat: lat,
          center_lng: lng,
          radius_km: radiusKm,
          sort: "DIST"
        };
        const sRes = await executeSearchWithRetry(searchPayload, 1);
        for (const p of sRes.results || []) {
          if (!p.shiny || p.iv_percent !== 100) continue;
          if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;
          if (hiddenSpecies.includes(p.pokemon_name)) continue;

          const dist = p.apx_lat != null && p.apx_long != null ? calculateDistanceKm(lat, lng, p.apx_lat, p.apx_long) : p.distance_km ?? null;

          allSpawns.set(p.encounter_id, {
            ...p,
            shiny: true,
            raw_iv: "15/15/15",
            iv_percent: 100,
            exact_coords: null,
            distance_km: dist
          });
        }
      } catch {}

      const finalList = Array.from(allSpawns.values())
        .sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999))
        .slice(0, targetCount);

      return NextResponse.json({
        success: true,
        count: finalList.length,
        mode: "shundo_local",
        rate_limited: rateLimitHit,
        results: finalList
      });
    }

    // =========================================================================
    // MODO 5: SHINYS NO RAIO LOCAL (MAP LOOKUP DE ALTA DENSIDADE: ATÉ 100+ SHINIES)
    // =========================================================================
    const deltaLat = radiusKm / 111.0;
    const deltaLng = radiusKm / (111.0 * Math.max(0.1, Math.cos((lat * Math.PI) / 180.0)));

    // 1. Consulta Principal no /map/lookup (Traz até 100 Shinies de uma vez só!)
    try {
      const mapPayload = {
        mode: "pokemon",
        n_lat: lat + deltaLat,
        s_lat: lat - deltaLat,
        w_lng: lng - deltaLng,
        e_lng: lng + deltaLng,
        filters: {
          shiny_only: true,
          shiny_account: trainerCode,
          sort: "IV"
        }
      };

      const token = POGO_TOKENS[0];
      const res = await fetch(`${BASE_API_URL}/map/lookup`, {
        method: "POST",
        headers: getRandomSpoofedHeaders(token),
        signal: AbortSignal.timeout(9000),
        body: JSON.stringify(mapPayload)
      });

      if (res.ok) {
        const data = await res.json();
        for (const p of data.results || []) {
          if (!p.shiny) continue;
          if (p.despawn_at_ms && p.despawn_at_ms <= now) continue;
          if (hiddenSpecies.includes(p.pokemon_name)) continue;

          const pLat = p.apx_lat ?? null;
          const pLng = p.apx_long ?? null;
          const dist = pLat != null && pLng != null ? calculateDistanceKm(lat, lng, pLat, pLng) : null;
          if (dist != null && dist > radiusKm * 1.15) continue;

          allSpawns.set(p.encounter_id, {
            ...p,
            despawn_at: p.despawn_at_ms ? new Date(p.despawn_at_ms).toISOString() : p.despawn_at,
            shiny: true,
            exact_coords: null,
            distance_km: dist
          });
        }
      }
    } catch (err: any) {
      console.warn("Aviso no /map/lookup local_shiny:", err);
    }

    // 2. Consulta Complementar no /search por Distância para pegar spawns de borda
    try {
      const searchPayload = {
        shiny_only: true,
        shiny_account: trainerCode,
        center_lat: lat,
        center_lng: lng,
        radius_km: radiusKm,
        sort: "DIST"
      };
      const sRes = await executeSearchWithRetry(searchPayload, 1);
      for (const p of sRes.results || []) {
        if (!p.shiny) continue;
        if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;
        if (hiddenSpecies.includes(p.pokemon_name)) continue;

        const dist = p.apx_lat != null && p.apx_long != null ? calculateDistanceKm(lat, lng, p.apx_lat, p.apx_long) : p.distance_km ?? null;

        allSpawns.set(p.encounter_id, {
          ...p,
          shiny: true,
          exact_coords: null,
          distance_km: dist
        });
      }
    } catch {}

    const finalList = Array.from(allSpawns.values())
      .filter((p) => {
        if (!p.shiny) return false;
        if (!p.despawn_at) return true;
        return new Date(p.despawn_at).getTime() > now;
      })
      .sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999))
      .slice(0, targetCount);

    return NextResponse.json({
      success: true,
      count: finalList.length,
      mode: "local_shiny",
      rate_limited: rateLimitHit,
      retry_after: maxRetryAfter > 0 ? maxRetryAfter : undefined,
      results: finalList
    });
  } catch (error: any) {
    console.error("Erro crítico em /api/hunt:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro interno ao processar a busca de Pokémons."
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") || "43.5442968");
  const lng = parseFloat(searchParams.get("lng") || "-79.7399437");
  const radiusKm = parseFloat(searchParams.get("radiusKm") || "50");
  const targetCount = parseInt(searchParams.get("targetCount") || "100", 10);
  const mode = (searchParams.get("mode") as RadarHuntMode) || "hundo_global";

  const fakeReq = new NextRequest(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, radiusKm, targetCount, huntMode: mode })
  });

  return POST(fakeReq);
}
