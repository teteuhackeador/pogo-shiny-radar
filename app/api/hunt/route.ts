import { NextRequest, NextResponse } from "next/server";
import {
  BASE_API_URL,
  DEFAULT_POGO_TOKEN,
  DEFAULT_TRAINER_CODE,
  POGO_TOKENS,
  calculateDistanceKm
} from "@/lib/constants";
import { PokemonSpawn } from "@/types/pokemon";

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
    const isGlobal = !!body.isGlobal || !!body.shundoGlobal;
    const shundoOnly = !!body.shundoOnly || !!body.shundoGlobal;
    const hiddenSpecies: string[] = Array.isArray(body.hiddenSpecies) ? body.hiddenSpecies : [];

    const allShinys = new Map<string, PokemonSpawn>();
    const now = Date.now();
    let totalQueries = 0;

    // =========================================================================
    // MODO ESPECIAL: SHUNDO GLOBAL / ÁREA INFINITA (100% IV Mundial)
    // =========================================================================
    if (isGlobal || shundoOnly) {
      const blacklistIds: number[] = [];
      const maxRounds = 8; // Até 8 rodadas x 10 resultados = até 80 Shundos diferentes

      for (let round = 0; round < maxRounds && allShinys.size < targetCount; round++) {
        totalQueries++;
        const currentToken = POGO_TOKENS[round % POGO_TOKENS.length] || DEFAULT_POGO_TOKEN;

        try {
          const res = await fetch(`${BASE_API_URL}/search`, {
            method: "POST",
            headers: getRandomSpoofedHeaders(currentToken),
            body: JSON.stringify({
              shiny_only: true,
              shiny_account: trainerCode,
              iv_mode: "percent",
              iv_percent_min: 100,
              raw_iv_atk: 15,
              raw_iv_def: 15,
              raw_iv_sta: 15,
              sort: "DSP",
              blacklist_pokemon_ids: blacklistIds
            })
          });

          if (!res.ok) {
            console.warn(`Aviso /search Shundo Global [Rodada ${round + 1}]: HTTP ${res.status}`);
            break;
          }

          const data = await res.json();
          const results: any[] = data.results || [];
          if (results.length === 0) break;

          let foundShundoThisRound = 0;

          for (const p of results) {
            // Trava estrita de SHUNDO: descarta terminantemente qualquer Pokémon abaixo de 100% (ex: 97.8%)
            const isTrueShundo = p.iv_percent === 100 || p.raw_iv === "15/15/15";
            if (!isTrueShundo) continue;

            // Descartar expirados
            if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;

            // Alimenta a blacklist para a próxima rodada trazer espécies novas
            if (p.pokemon_id && !blacklistIds.includes(p.pokemon_id)) {
              blacklistIds.push(p.pokemon_id);
            }

            // Se o usuário ocultou essa espécie, não adiciona aos resultados da tela
            if (hiddenSpecies.includes(p.pokemon_name)) continue;

            if (allShinys.has(p.encounter_id)) continue;

            foundShundoThisRound++;

            // Se coordenadas de referência foram passadas, calcula a distância até o país/cidade
            const dist =
              p.apx_lat != null && p.apx_long != null && !isNaN(lat) && !isNaN(lng)
                ? calculateDistanceKm(lat, lng, p.apx_lat, p.apx_long)
                : null;

            allShinys.set(p.encounter_id, {
              ...p,
              shiny: true,
              exact_coords: null,
              distance_km: dist
            });
          }

          // Se a API não retornou nenhum 100% puro nesta rodada, encerra o ciclo
          if (foundShundoThisRound === 0) break;
        } catch (err) {
          console.warn(`Erro na rodada ${round + 1} de Shundo Global:`, err);
          break;
        }
      }

      const finalList = Array.from(allShinys.values())
        .filter((p) => {
          if (!p.despawn_at) return true;
          return new Date(p.despawn_at).getTime() > now;
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
    // MODO LOCAL: Coordenadas Obrigatórias
    // =========================================================================
    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { success: false, error: "Coordenadas 'lat' e 'lng' são obrigatórias para busca local." },
        { status: 400 }
      );
    }

    // =========================================================================
    // ETAPA 1: Varredura em Grade por Bounding Box (5 Quadrantes em Paralelo)
    // Extraído do Relatório de Auditoria (Falha 4): o endpoint /map/lookup aceita
    // bounding boxes sem rate-limiting e entrega até 100 resultados com apx_lat/lng.
    // Ao dividir a área em 5 quadrantes simultâneos, capturamos dezenas de shinys!
    // =========================================================================
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

          if (!res.ok) {
            const errText = await res.text();
            console.warn(`Aviso /map/lookup [${t.name}]: HTTP ${res.status} - ${errText}`);
            return [];
          }
          const data = await res.json();
          return data.results || [];
        } catch (err) {
          console.warn(`Erro na requisição /map/lookup [${t.name}]:`, err);
          return [];
        }
      });

      const tileResults = await Promise.all(tilePromises);

      for (const batch of tileResults) {
        for (const p of batch) {
          if (p.despawn_at_ms && p.despawn_at_ms <= now) continue;
          if (allShinys.has(p.encounter_id)) continue;

          // Se estiver na lista de espécies ocultas pelo usuário, ignora
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
    } catch (tileErr) {
      console.warn("Aviso: Falha na grade de /map/lookup:", tileErr);
    }

    // =========================================================================
    // ETAPA 2: Enriquecimento via /search Local
    // =========================================================================
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
        const sResults: PokemonSpawn[] = sData.results || [];

        for (const p of sResults) {
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
    } catch (sErr) {
      console.warn("Aviso: /search offline ou limitado, mantendo dados do mapa:", sErr);
    }

    // Ordenação matemática e rigorosa por distância ascendente (mais perto primeiro)
    const finalList = Array.from(allShinys.values())
      .filter((p) => {
        if (!p.despawn_at) return true;
        return new Date(p.despawn_at).getTime() > now;
      })
      .sort((a, b) => {
        const distA = a.distance_km ?? 9999;
        const distB = b.distance_km ?? 9999;
        return distA - distB;
      })
      .slice(0, targetCount);

    return NextResponse.json({
      success: true,
      count: finalList.length,
      rounds: totalQueries,
      mode: "local",
      results: finalList
    });
  } catch (error: any) {
    console.error("Erro interno no /api/hunt:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno no servidor ao caçar shinys." },
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
  const isGlobal = searchParams.get("global") === "true";
  const shundoOnly = searchParams.get("shundo") === "true";

  const fakeReq = new NextRequest(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, radiusKm, targetCount, isGlobal, shundoOnly })
  });

  return POST(fakeReq);
}
