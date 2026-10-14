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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lat = parseFloat(body.lat);
    const lng = parseFloat(body.lng);
    const radiusKm = parseFloat(body.radiusKm || 50);
    const targetCount = Math.min(parseInt(body.targetCount || 100, 10), 150);
    const trainerCode = body.shinyAccount || DEFAULT_TRAINER_CODE;
    const hiddenSpecies: string[] = Array.isArray(body.hiddenSpecies) ? body.hiddenSpecies : [];

    let mode: RadarHuntMode = body.huntMode || "local_shiny";
    if (body.isGlobal || body.shundoGlobal) {
      mode = "shundo_global";
    } else if (body.shundoOnly) {
      mode = "shundo_local";
    }

    const allShinys = new Map<string, PokemonSpawn>();
    const now = Date.now();
    let totalQueries = 0;

    // =========================================================================
    // MODO 1: SHUNDO GLOBAL (ESTRITAMENTE SHUNDOS REAIS 100% IV + SHINY NO MUNDO)
    // =========================================================================
    if (mode === "shundo_global") {
      const sortTypes = ["DSP", "IV", "CP", "TIME"];
      let blacklist: number[] = [];

      for (const sortType of sortTypes) {
        totalQueries++;
        const token = POGO_TOKENS[totalQueries % POGO_TOKENS.length] || DEFAULT_POGO_TOKEN;
        try {
          const res = await fetch(`${BASE_API_URL}/search`, {
            method: "POST",
            headers: getRandomSpoofedHeaders(token),
            body: JSON.stringify({
              shiny_only: true,
              shiny_account: trainerCode,
              iv_mode: "percent",
              iv_percent_min: 100,
              sort: sortType,
              blacklist_pokemon_ids: blacklist
            })
          });

          if (res.ok) {
            const data = await res.json();
            for (const p of (data.results || [])) {
              // REGRA DE OURO: APENAS SHINY REAL E EXATAMENTE 15/15/15 (100% IV)
              if (!p.shiny || p.iv_percent !== 100 || p.raw_iv !== "15/15/15") continue;
              if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;
              if (hiddenSpecies.includes(p.pokemon_name)) continue;

              if (p.pokemon_id && !blacklist.includes(p.pokemon_id)) {
                blacklist.push(p.pokemon_id);
              }

              const dist =
                p.apx_lat != null && p.apx_long != null && !isNaN(lat) && !isNaN(lng)
                  ? calculateDistanceKm(lat, lng, p.apx_lat, p.apx_long)
                  : p.distance_km ?? null;

              allShinys.set(p.encounter_id, {
                ...p,
                shiny: true,
                exact_coords: null,
                distance_km: dist
              });
            }
          }
        } catch (e) {
          console.warn("Aviso na busca de Shundo Global:", e);
        }
      }

      const finalList = Array.from(allShinys.values())
        .sort((a, b) => {
          if (a.distance_km != null && b.distance_km != null) {
            return a.distance_km - b.distance_km;
          }
          return 0;
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
    // VALIDAÇÃO DE COORDENADAS PARA MODOS LOCAIS
    // =========================================================================
    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { success: false, error: "Coordenadas 'lat' e 'lng' são obrigatórias para buscas no raio." },
        { status: 400 }
      );
    }

    // =========================================================================
    // MODO 2: SHUNDO LOCAL (ESTRITAMENTE SHUNDOS REAIS 100% IV + SHINY NO RAIO)
    // =========================================================================
    if (mode === "shundo_local") {
      // 1. Consulta Direta via /search
      try {
        totalQueries++;
        const token = POGO_TOKENS[0] || DEFAULT_POGO_TOKEN;
        const res = await fetch(`${BASE_API_URL}/search`, {
          method: "POST",
          headers: getRandomSpoofedHeaders(token),
          body: JSON.stringify({
            shiny_only: true,
            shiny_account: trainerCode,
            iv_mode: "percent",
            iv_percent_min: 100,
            center_lat: lat,
            center_lng: lng,
            radius_km: radiusKm,
            sort: "DIST"
          })
        });

        if (res.ok) {
          const data = await res.json();
          for (const p of (data.results || [])) {
            // REGRA DE OURO: APENAS SHINY REAL E EXATAMENTE 15/15/15 (100% IV)
            if (!p.shiny || p.iv_percent !== 100 || p.raw_iv !== "15/15/15") continue;
            if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;
            if (hiddenSpecies.includes(p.pokemon_name)) continue;

            const dist =
              p.apx_lat != null && p.apx_long != null
                ? calculateDistanceKm(lat, lng, p.apx_lat, p.apx_long)
                : p.distance_km ?? null;

            allShinys.set(p.encounter_id, {
              ...p,
              shiny: true,
              exact_coords: null,
              distance_km: dist
            });
          }
        }
      } catch (err) {
        console.warn("Aviso no /search Shundo Local:", err);
      }

      // 2. Varredura via /map/lookup da área
      try {
        const deltaLat = radiusKm / 111.0;
        const deltaLng = radiusKm / (111.0 * Math.max(0.1, Math.cos((lat * Math.PI) / 180.0)));

        const tiles = [
          { name: "CTR", n: lat + deltaLat / 2, s: lat - deltaLat / 2, w: lng - deltaLng / 2, e: lng + deltaLng / 2 },
          { name: "NE", n: lat + deltaLat, s: lat, w: lng, e: lng + deltaLng },
          { name: "NW", n: lat + deltaLat, s: lat, w: lng - deltaLng, e: lng },
          { name: "SE", n: lat, s: lat - deltaLat, w: lng, e: lng + deltaLng },
          { name: "SW", n: lat, s: lat - deltaLat, w: lng - deltaLng, e: lng }
        ];

        const tilePromises = tiles.map(async (t, idx) => {
          totalQueries++;
          const token = POGO_TOKENS[idx % POGO_TOKENS.length] || DEFAULT_POGO_TOKEN;

          try {
            const res = await fetch(`${BASE_API_URL}/map/lookup`, {
              method: "POST",
              headers: getRandomSpoofedHeaders(token),
              body: JSON.stringify({
                mode: "pokemon",
                n_lat: t.n,
                s_lat: t.s,
                w_lng: t.w,
                e_lng: t.e,
                filters: {
                  shiny_only: true,
                  shiny_account: trainerCode,
                  sort: "IV"
                },
                num_results: 100
              })
            });

            if (!res.ok) return [];
            const data = await res.json();
            return data.results || [];
          } catch {
            return [];
          }
        });

        const tileResults = await Promise.all(tilePromises);

        for (const batch of tileResults) {
          for (const p of batch) {
            // REGRA DE OURO: APENAS SHINY REAL E EXATAMENTE 15/15/15 (100% IV)
            if (!p.shiny || p.iv_percent !== 100 || p.raw_iv !== "15/15/15") continue;
            if (p.despawn_at_ms && p.despawn_at_ms <= now) continue;
            if (allShinys.has(p.encounter_id)) continue;
            if (hiddenSpecies.includes(p.pokemon_name)) continue;

            const dist =
              p.apx_lat != null && p.apx_long != null
                ? calculateDistanceKm(lat, lng, p.apx_lat, p.apx_long)
                : null;

            const despawnIso = p.despawn_at_ms
              ? new Date(p.despawn_at_ms).toISOString()
              : new Date(now + 15 * 60 * 1000).toISOString();

            allShinys.set(p.encounter_id, {
              encounter_id: p.encounter_id,
              pokemon_id: p.pokemon_id,
              pokemon_name: p.pokemon_name,
              form: p.form || null,
              costume_id: null,
              costume: p.costume || null,
              cp: p.cp || 0,
              level: p.level || 0,
              location: p.apx_lat ? `Região (${p.apx_lat.toFixed(3)}, ${p.apx_long.toFixed(3)})` : "Localização informada",
              raw_iv: "15/15/15",
              iv_percent: 100,
              gender: p.gender || "Genderless",
              size: p.size || "M",
              weather_boosted: false,
              weather_id: 0,
              fast_move: "—",
              charge_move: "—",
              despawn_at: despawnIso,
              despawn_verified: !!p.despawn_verified,
              reveal_code: p.reveal_code,
              shiny: true,
              background: false,
              apx_lat: p.apx_lat ?? null,
              apx_long: p.apx_long ?? null,
              distance_km: dist,
              exact_coords: null
            });
          }
        }
      } catch (mapErr) {
        console.warn("Aviso no /map/lookup Shundo Local:", mapErr);
      }

      const finalList = Array.from(allShinys.values())
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
    // MODO 3: RADAR LOCAL DE SHINYS (TODOS OS SHINYS NO RAIO)
    // =========================================================================
    const deltaLat = radiusKm / 111.0;
    const deltaLng = radiusKm / (111.0 * Math.max(0.1, Math.cos((lat * Math.PI) / 180.0)));

    const tiles = [
      { name: "CTR", n: lat + deltaLat / 2, s: lat - deltaLat / 2, w: lng - deltaLng / 2, e: lng + deltaLng / 2 },
      { name: "NE", n: lat + deltaLat, s: lat, w: lng, e: lng + deltaLng },
      { name: "NW", n: lat + deltaLat, s: lat, w: lng - deltaLng, e: lng },
      { name: "SE", n: lat, s: lat - deltaLat, w: lng, e: lng + deltaLng },
      { name: "SW", n: lat, s: lat - deltaLat, w: lng - deltaLng, e: lng }
    ];

    const tilePromises = tiles.map(async (t, idx) => {
      totalQueries++;
      const token = POGO_TOKENS[idx % POGO_TOKENS.length] || DEFAULT_POGO_TOKEN;

      try {
        const res = await fetch(`${BASE_API_URL}/map/lookup`, {
          method: "POST",
          headers: getRandomSpoofedHeaders(token),
          body: JSON.stringify({
            mode: "pokemon",
            n_lat: t.n,
            s_lat: t.s,
            w_lng: t.w,
            e_lng: t.e,
            filters: {
              shiny_only: true,
              shiny_account: trainerCode,
              sort: "IV"
            },
            num_results: 100
          })
        });

        if (!res.ok) return [];
        const data = await res.json();
        return data.results || [];
      } catch {
        return [];
      }
    });

    const tileResults = await Promise.all(tilePromises);

    for (const batch of tileResults) {
      for (const p of batch) {
        // REGRA DE OURO: APENAS SHINY REAL
        if (!p.shiny) continue;
        if (p.despawn_at_ms && p.despawn_at_ms <= now) continue;
        if (allShinys.has(p.encounter_id)) continue;
        if (hiddenSpecies.includes(p.pokemon_name)) continue;

        const dist =
          p.apx_lat != null && p.apx_long != null
            ? calculateDistanceKm(lat, lng, p.apx_lat, p.apx_long)
            : null;

        const despawnIso = p.despawn_at_ms
          ? new Date(p.despawn_at_ms).toISOString()
          : new Date(now + 15 * 60 * 1000).toISOString();

        allShinys.set(p.encounter_id, {
          encounter_id: p.encounter_id,
          pokemon_id: p.pokemon_id,
          pokemon_name: p.pokemon_name,
          form: p.form || null,
          costume_id: null,
          costume: p.costume || null,
          cp: p.cp || 0,
          level: p.level || 0,
          location: p.apx_lat ? `Região (${p.apx_lat.toFixed(3)}, ${p.apx_long.toFixed(3)})` : "Localização informada",
          raw_iv: p.raw_iv || "15/15/15",
          iv_percent: p.iv_percent || 100,
          gender: p.gender || "Genderless",
          size: p.size || "M",
          weather_boosted: false,
          weather_id: 0,
          fast_move: "—",
          charge_move: "—",
          despawn_at: despawnIso,
          despawn_verified: !!p.despawn_verified,
          reveal_code: p.reveal_code,
          shiny: true,
          background: false,
          apx_lat: p.apx_lat ?? null,
          apx_long: p.apx_long ?? null,
          distance_km: dist,
          exact_coords: null
        });
      }
    }

    // Enriquecimento com /search
    try {
      totalQueries++;
      const sToken = POGO_TOKENS[1 % POGO_TOKENS.length] || DEFAULT_POGO_TOKEN;

      const sRes = await fetch(`${BASE_API_URL}/search`, {
        method: "POST",
        headers: getRandomSpoofedHeaders(sToken),
        body: JSON.stringify({
          shiny_only: true,
          shiny_account: trainerCode,
          center_lat: lat,
          center_lng: lng,
          radius_km: radiusKm,
          sort: "DIST",
          blacklist_pokemon_ids: []
        })
      });

      if (sRes.ok) {
        const sData = await sRes.json();
        for (const p of (sData.results || [])) {
          // REGRA DE OURO: APENAS SHINY REAL
          if (!p.shiny) continue;
          if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;
          if (hiddenSpecies.includes(p.pokemon_name)) continue;

          if (allShinys.has(p.encounter_id)) {
            const existing = allShinys.get(p.encounter_id)!;
            if (p.location) existing.location = p.location;
            if (p.fast_move) existing.fast_move = p.fast_move;
            if (p.charge_move) existing.charge_move = p.charge_move;
            if (p.despawn_at) existing.despawn_at = p.despawn_at;
          } else {
            const dist =
              p.apx_lat != null && p.apx_long != null
                ? calculateDistanceKm(lat, lng, p.apx_lat, p.apx_long)
                : null;

            allShinys.set(p.encounter_id, {
              ...p,
              shiny: true,
              exact_coords: null,
              distance_km: dist
            });
          }
        }
      }
    } catch {}

    const finalList = Array.from(allShinys.values())
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
  const mode = searchParams.get("mode") || "local_shiny";

  const fakeReq = new NextRequest(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, radiusKm, targetCount, huntMode: mode })
  });

  return POST(fakeReq);
}
