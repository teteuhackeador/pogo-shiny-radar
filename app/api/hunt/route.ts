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

// Fatiamento por faixas de nível para bypass do teto de 10 da API
const LEVEL_SLICES = [
  { min: 1, max: 5 },
  { min: 6, max: 10 },
  { min: 11, max: 15 },
  { min: 16, max: 20 },
  { min: 21, max: 25 },
  { min: 26, max: 28 },
  { min: 29, max: 31 },
  { min: 32, max: 35 }
];

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

    const allSpawns = new Map<string, PokemonSpawn>();
    const now = Date.now();
    let totalQueries = 0;

    // =========================================================================
    // MODO 1: 100% IV GLOBAL (TODOS OS 100% IV NO MUNDO, SHUNDOS NO TOPO)
    // =========================================================================
    if (mode === "hundo_global") {
      const slicePromises = LEVEL_SLICES.map(async (slice, idx) => {
        totalQueries++;
        const token = POGO_TOKENS[idx % POGO_TOKENS.length] || DEFAULT_POGO_TOKEN;

        try {
          const res = await fetch(`${BASE_API_URL}/search`, {
            method: "POST",
            headers: getRandomSpoofedHeaders(token),
            signal: AbortSignal.timeout(6000),
            body: JSON.stringify({
              shiny_only: false,
              shiny_account: trainerCode,
              level_min: slice.min,
              level_max: slice.max,
              iv_mode: "percent",
              iv_percent_min: 100,
              iv_percent_max: 100,
              sort: "DSP"
            })
          });

          if (!res.ok) return [];
          const data = await res.json();
          return data.results || [];
        } catch {
          return [];
        }
      });

      const sliceResults = await Promise.all(slicePromises);

      for (const batch of sliceResults) {
        for (const p of batch) {
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

      return NextResponse.json({
        success: true,
        count: finalList.length,
        rounds: totalQueries,
        mode: "hundo_global",
        results: finalList
      });
    }

    // =========================================================================
    // MODO 2: SHUNDO GLOBAL (ESTRITAMENTE SHUNDOS REAIS 100% IV + SHINY NO MUNDO)
    // =========================================================================
    if (mode === "shundo_global") {
      const slicePromises = LEVEL_SLICES.map(async (slice, idx) => {
        totalQueries++;
        const token = POGO_TOKENS[idx % POGO_TOKENS.length] || DEFAULT_POGO_TOKEN;

        try {
          const res = await fetch(`${BASE_API_URL}/search`, {
            method: "POST",
            headers: getRandomSpoofedHeaders(token),
            signal: AbortSignal.timeout(6000),
            body: JSON.stringify({
              shiny_only: true,
              shiny_account: trainerCode,
              level_min: slice.min,
              level_max: slice.max,
              iv_mode: "percent",
              iv_percent_min: 100,
              iv_percent_max: 100,
              sort: "DSP"
            })
          });

          if (!res.ok) return [];
          const data = await res.json();
          return data.results || [];
        } catch {
          return [];
        }
      });

      const sliceResults = await Promise.all(slicePromises);

      for (const batch of sliceResults) {
        for (const p of batch) {
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

      return NextResponse.json({
        success: true,
        count: finalList.length,
        rounds: totalQueries,
        mode: "shundo_global",
        results: finalList
      });
    }

    // =========================================================================
    // MODO 3: TODOS OS SHINIES GLOBAIS DA CONTA (50-80+ SHINIES NO PLANETA)
    // =========================================================================
    if (mode === "shiny_global") {
      const slicePromises = LEVEL_SLICES.map(async (slice, idx) => {
        totalQueries++;
        const token = POGO_TOKENS[idx % POGO_TOKENS.length] || DEFAULT_POGO_TOKEN;

        try {
          const res = await fetch(`${BASE_API_URL}/search`, {
            method: "POST",
            headers: getRandomSpoofedHeaders(token),
            signal: AbortSignal.timeout(6000),
            body: JSON.stringify({
              shiny_only: true,
              shiny_account: trainerCode,
              level_min: slice.min,
              level_max: slice.max,
              sort: "DSP"
            })
          });

          if (!res.ok) return [];
          const data = await res.json();
          return data.results || [];
        } catch {
          return [];
        }
      });

      const sliceResults = await Promise.all(slicePromises);

      for (const batch of sliceResults) {
        for (const p of batch) {
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

      // Ordenar por IV decrescente (melhores primeiros) e depois CP
      const finalList = Array.from(allSpawns.values())
        .sort((a, b) => {
          if ((b.iv_percent || 0) !== (a.iv_percent || 0)) {
            return (b.iv_percent || 0) - (a.iv_percent || 0);
          }
          return (b.cp || 0) - (a.cp || 0);
        })
        .slice(0, targetCount);

      return NextResponse.json({
        success: true,
        count: finalList.length,
        rounds: totalQueries,
        mode: "shiny_global",
        results: finalList
      });
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
    // MODO 4: SHUNDO LOCAL (SHUNDOS REAIS NO RAIO VIA MULTI-SLICE PARALELO)
    // =========================================================================
    if (mode === "shundo_local") {
      const slicePromises = LEVEL_SLICES.map(async (slice, idx) => {
        totalQueries++;
        const token = POGO_TOKENS[idx % POGO_TOKENS.length] || DEFAULT_POGO_TOKEN;

        try {
          const res = await fetch(`${BASE_API_URL}/search`, {
            method: "POST",
            headers: getRandomSpoofedHeaders(token),
            signal: AbortSignal.timeout(6000),
            body: JSON.stringify({
              shiny_only: true,
              shiny_account: trainerCode,
              level_min: slice.min,
              level_max: slice.max,
              iv_mode: "percent",
              iv_percent_min: 100,
              iv_percent_max: 100,
              center_lat: lat,
              center_lng: lng,
              radius_km: radiusKm,
              sort: "DIST"
            })
          });

          if (!res.ok) return [];
          const data = await res.json();
          return data.results || [];
        } catch {
          return [];
        }
      });

      const sliceResults = await Promise.all(slicePromises);

      for (const batch of sliceResults) {
        for (const p of batch) {
          if (!p.shiny || p.iv_percent !== 100) continue;
          if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;
          if (hiddenSpecies.includes(p.pokemon_name)) continue;

          const dist =
            p.apx_lat != null && p.apx_long != null
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
        .sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999))
        .slice(0, targetCount);

      return NextResponse.json({
        success: true,
        count: finalList.length,
        rounds: totalQueries,
        mode: "shundo_local",
        results: finalList
      });
    }

    // =========================================================================
    // MODO 5: SHINYS NO RAIO LOCAL (TODOS OS SHINYS NO RAIO VIA MULTI-SLICE)
    // =========================================================================
    const slicePromises = LEVEL_SLICES.map(async (slice, idx) => {
      totalQueries++;
      const token = POGO_TOKENS[idx % POGO_TOKENS.length] || DEFAULT_POGO_TOKEN;

      try {
        const res = await fetch(`${BASE_API_URL}/search`, {
          method: "POST",
          headers: getRandomSpoofedHeaders(token),
          signal: AbortSignal.timeout(6000),
          body: JSON.stringify({
            shiny_only: true,
            shiny_account: trainerCode,
            level_min: slice.min,
            level_max: slice.max,
            center_lat: lat,
            center_lng: lng,
            radius_km: radiusKm,
            sort: "DIST"
          })
        });

        if (!res.ok) return [];
        const data = await res.json();
        return data.results || [];
      } catch {
        return [];
      }
    });

    const sliceResults = await Promise.all(slicePromises);

    for (const batch of sliceResults) {
      for (const p of batch) {
        if (!p.shiny) continue;
        if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;
        if (hiddenSpecies.includes(p.pokemon_name)) continue;

        const dist =
          p.apx_lat != null && p.apx_long != null
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
      rounds: totalQueries,
      mode: "local_shiny",
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
