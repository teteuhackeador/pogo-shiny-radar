import { NextRequest, NextResponse } from "next/server";
import {
  BASE_API_URL,
  DEFAULT_POGO_TOKEN,
  DEFAULT_TRAINER_CODE,
  POGO_TOKENS,
  calculateDistanceKm
} from "@/lib/constants";
import { PokemonSpawn, RadarHuntMode } from "@/types/pokemon";

export const maxDuration = 30; // Suporte a Vercel serverless functions estendidas

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
    // MODO 1: SHUNDO GLOBAL (SHUNDOS CONFIRMADOS NO TOPO + 100% IV HUNDOS MUNDIAIS)
    // =========================================================================
    if (mode === "shundo_global") {
      // 1. Shundos Confirmados para a conta do usuário (100% IV + Shiny verificado)
      const sortTypes = ["DSP", "IV"];
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
              sort: sortType
            })
          });

          if (res.ok) {
            const data = await res.json();
            for (const p of (data.results || [])) {
              if (p.iv_percent !== 100 && p.raw_iv !== "15/15/15") continue;
              if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;
              if (hiddenSpecies.includes(p.pokemon_name)) continue;

              allShinys.set(p.encounter_id, {
                ...p,
                shiny: true, // Shundo confirmado para o usuário
                exact_coords: null,
                distance_km: null
              });
            }
          }
        } catch (e) {
          console.warn("Aviso no /search Shundo Confirmado:", e);
        }
      }

      // 2. Feeds Mundiais de 100% IV Hundos (milhares de 100% IV disponíveis no mundo)
      const feedEndpoints = [
        "/feeds/regional-100iv",
        "/feeds/rare-100iv",
        "/feeds/high-cp-100iv"
      ];

      for (const feedUrl of feedEndpoints) {
        totalQueries++;
        const token = POGO_TOKENS[totalQueries % POGO_TOKENS.length] || DEFAULT_POGO_TOKEN;
        try {
          const feedRes = await fetch(`${BASE_API_URL}${feedUrl}`, {
            headers: getRandomSpoofedHeaders(token)
          });

          if (feedRes.ok) {
            const feedData = await feedRes.json();
            for (const p of (feedData.results || [])) {
              if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;
              if (hiddenSpecies.includes(p.pokemon_name)) continue;

              if (!allShinys.has(p.encounter_id)) {
                allShinys.set(p.encounter_id, {
                  ...p,
                  shiny: false, // Hundo 100% IV (cabe ao treinador fazer Shiny Check)
                  raw_iv: "15/15/15",
                  iv_percent: 100,
                  exact_coords: null,
                  distance_km: null
                });
              }
            }
          }
        } catch {}
      }

      // 3. Busca Global Recursiva de 100% IV Hundos
      let blacklist: number[] = [];
      for (let r = 0; r < 3; r++) {
        totalQueries++;
        const token = POGO_TOKENS[totalQueries % POGO_TOKENS.length] || DEFAULT_POGO_TOKEN;
        try {
          const res = await fetch(`${BASE_API_URL}/search`, {
            method: "POST",
            headers: getRandomSpoofedHeaders(token),
            body: JSON.stringify({
              iv_mode: "percent",
              iv_percent_min: 100,
              sort: "DSP",
              blacklist_pokemon_ids: blacklist
            })
          });

          if (!res.ok) break;
          const data = await res.json();
          const results: any[] = data.results || [];
          if (results.length === 0) break;

          for (const p of results) {
            if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;
            if (hiddenSpecies.includes(p.pokemon_name)) continue;

            if (p.pokemon_id && !blacklist.includes(p.pokemon_id)) {
              blacklist.push(p.pokemon_id);
            }

            if (!allShinys.has(p.encounter_id)) {
              allShinys.set(p.encounter_id, {
                ...p,
                shiny: false,
                raw_iv: "15/15/15",
                iv_percent: 100,
                exact_coords: null,
                distance_km: null
              });
            }
          }
        } catch {
          break;
        }
      }

      // Ordenação: Shundos Confirmados (shiny: true) SEMPRE no topo com destaque, seguidos por Hundos 100% IV
      const finalList = Array.from(allShinys.values())
        .sort((a, b) => {
          if (a.shiny && !b.shiny) return -1;
          if (!a.shiny && b.shiny) return 1;
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
    // COORDENADAS OBRIGATÓRIAS PARA OS MODOS LOCAIS (shundo_local e local_shiny)
    // =========================================================================
    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { success: false, error: "Coordenadas 'lat' e 'lng' são obrigatórias para buscas em torno de um local." },
        { status: 400 }
      );
    }

    // =========================================================================
    // MODO 2: SHUNDO LOCAL (SHUNDOS CONFIRMADOS NO RAIO + 100% IVs E ALTO IV DA REGIÃO)
    // =========================================================================
    if (mode === "shundo_local") {
      // 1. Shundos Confirmados no Raio
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
            if (p.iv_percent !== 100 && p.raw_iv !== "15/15/15") continue;
            if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;
            if (hiddenSpecies.includes(p.pokemon_name)) continue;

            const dist =
              p.apx_lat != null && p.apx_long != null
                ? calculateDistanceKm(lat, lng, p.apx_lat, p.apx_long)
                : p.distance_km ?? null;

            allShinys.set(p.encounter_id, {
              ...p,
              shiny: true, // Shundo confirmado para o usuário no raio!
              exact_coords: null,
              distance_km: dist
            });
          }
        }
      } catch (err) {
        console.warn("Aviso no /search Shundo Local:", err);
      }

      // 2. 100% IV Hundos no Raio (para fazer Shiny Check local sem tomar softban)
      try {
        totalQueries++;
        const token = POGO_TOKENS[1 % POGO_TOKENS.length] || DEFAULT_POGO_TOKEN;
        const res = await fetch(`${BASE_API_URL}/search`, {
          method: "POST",
          headers: getRandomSpoofedHeaders(token),
          body: JSON.stringify({
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
            if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;
            if (hiddenSpecies.includes(p.pokemon_name)) continue;

            if (!allShinys.has(p.encounter_id)) {
              const dist =
                p.apx_lat != null && p.apx_long != null
                  ? calculateDistanceKm(lat, lng, p.apx_lat, p.apx_long)
                  : p.distance_km ?? null;

              allShinys.set(p.encounter_id, {
                ...p,
                shiny: false,
                raw_iv: "15/15/15",
                iv_percent: 100,
                exact_coords: null,
                distance_km: dist
              });
            }
          }
        }
      } catch (err) {
        console.warn("Aviso no /search 100% IV local:", err);
      }

      // 3. Shinys de Alto IV (90%+) no Raio para enriquecer o farm local
      try {
        totalQueries++;
        const token = POGO_TOKENS[2 % POGO_TOKENS.length] || DEFAULT_POGO_TOKEN;
        const res = await fetch(`${BASE_API_URL}/search`, {
          method: "POST",
          headers: getRandomSpoofedHeaders(token),
          body: JSON.stringify({
            shiny_only: true,
            shiny_account: trainerCode,
            iv_mode: "percent",
            iv_percent_min: 90,
            center_lat: lat,
            center_lng: lng,
            radius_km: radiusKm,
            sort: "IV"
          })
        });

        if (res.ok) {
          const data = await res.json();
          for (const p of (data.results || [])) {
            if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;
            if (hiddenSpecies.includes(p.pokemon_name)) continue;

            if (!allShinys.has(p.encounter_id)) {
              const dist =
                p.apx_lat != null && p.apx_long != null
                  ? calculateDistanceKm(lat, lng, p.apx_lat, p.apx_long)
                  : p.distance_km ?? null;

              allShinys.set(p.encounter_id, {
                ...p,
                shiny: true, // Brilha para o usuário!
                exact_coords: null,
                distance_km: dist
              });
            }
          }
        }
      } catch (err) {
        console.warn("Aviso no /search 90%+ shiny local:", err);
      }

      // 4. Varredura no /map/lookup da área local com ordenação por IV
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
      } catch (mapErr) {
        console.warn("Aviso no /map/lookup Shundo Local:", mapErr);
      }

      // Ordenação: Shundos Confirmados (shiny: true && iv: 100) primeiro, depois 100% IV Hundos, depois mais próximos
      const finalList = Array.from(allShinys.values())
        .sort((a, b) => {
          const aIsShundo = a.shiny && a.iv_percent === 100;
          const bIsShundo = b.shiny && b.iv_percent === 100;
          if (aIsShundo && !bIsShundo) return -1;
          if (!aIsShundo && bIsShundo) return 1;

          const aIsHundo = a.iv_percent === 100;
          const bIsHundo = b.iv_percent === 100;
          if (aIsHundo && !bIsHundo) return -1;
          if (!aIsHundo && bIsHundo) return 1;

          return (a.distance_km ?? 9999) - (b.distance_km ?? 9999);
        })
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
