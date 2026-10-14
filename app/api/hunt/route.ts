import { NextRequest, NextResponse } from "next/server";
import {
  BASE_API_URL,
  DEFAULT_POGO_TOKEN,
  DEFAULT_TRAINER_CODE,
  calculateDistanceKm
} from "@/lib/constants";
import { PokemonSpawn } from "@/types/pokemon";

export const maxDuration = 30; // Suporte a Vercel serverless functions estendidas

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lat = parseFloat(body.lat);
    const lng = parseFloat(body.lng);
    const radiusKm = parseFloat(body.radiusKm || 50);
    const targetCount = Math.min(parseInt(body.targetCount || 40, 10), 100);
    const trainerCode = body.shinyAccount || DEFAULT_TRAINER_CODE;
    const authToken = body.token || DEFAULT_POGO_TOKEN;

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { success: false, error: "Coordenadas 'lat' e 'lng' são obrigatórias e devem ser números." },
        { status: 400 }
      );
    }

    const allShinys = new Map<string, PokemonSpawn>();
    const now = Date.now();
    let totalQueries = 0;

    // =========================================================================
    // PASSO 1: /map/lookup para obter todas as coordenadas aproximadas (apx_lat/lng)
    // Permite calcular a distância exata coordenada-com-coordenada para até 100 alvos
    // sem rate limit de /reveal!
    // =========================================================================
    try {
      const deltaLat = radiusKm / 111.0;
      const deltaLng = radiusKm / (111.0 * Math.max(0.1, Math.cos((lat * Math.PI) / 180.0)));

      const mapPayload = {
        mode: "pokemon",
        n_lat: lat + deltaLat,
        s_lat: lat - deltaLat,
        w_lng: lng - deltaLng,
        e_lng: lng + deltaLng,
        filters: {
          shiny_only: true,
          shiny_account: trainerCode,
          sort: "DIST"
        },
        num_results: 100
      };

      totalQueries++;
      const mapRes = await fetch(`${BASE_API_URL}/map/lookup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify(mapPayload)
      });

      if (mapRes.ok) {
        const mapData = await mapRes.json();
        const mapResults = mapData.results || [];

        for (const p of mapResults) {
          // Descartar spawns expirados
          if (p.despawn_at_ms && p.despawn_at_ms <= now) continue;

          const dist = (p.apx_lat != null && p.apx_long != null)
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
            exact_coords: null // Revelado com precisão milimétrica via /reveal ao clicar no botão
          });
        }
      }
    } catch (mapErr) {
      console.warn("Aviso: /map/lookup falhou ou indisponível, seguindo para /search:", mapErr);
    }

    // =========================================================================
    // PASSO 2: Enriquecimento via /search (DIST e DSP) para obter nomes de cidades e moves
    // =========================================================================
    const searchSorts = ["DIST", "DSP"];
    for (const sSort of searchSorts) {
      if (allShinys.size >= targetCount && sSort !== "DIST") break;

      try {
        totalQueries++;
        const sRes = await fetch(`${BASE_API_URL}/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`
          },
          body: JSON.stringify({
            shiny_only: true,
            shiny_account: trainerCode,
            center_lat: lat,
            center_lng: lng,
            radius_km: radiusKm,
            sort: sSort,
            blacklist_pokemon_ids: []
          })
        });

        if (sRes.ok) {
          const sData = await sRes.json();
          const sResults: PokemonSpawn[] = sData.results || [];

          for (const p of sResults) {
            if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) continue;

            if (allShinys.has(p.encounter_id)) {
              const existing = allShinys.get(p.encounter_id)!;
              if (p.location) existing.location = p.location;
              if (p.fast_move) existing.fast_move = p.fast_move;
              if (p.charge_move) existing.charge_move = p.charge_move;
              if (p.despawn_at) existing.despawn_at = p.despawn_at;
            } else {
              // Se não estava no map/lookup, calcula distância caso haja coordenadas aproximadas
              const dist = (p.apx_lat != null && p.apx_long != null)
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
        console.warn("Aviso: /search falhou na passada:", sErr);
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    // Ordenação coordenada-a-coordenada rigorosa por distância ascendente
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
  const targetCount = parseInt(searchParams.get("targetCount") || "40", 10);

  const fakeReq = new NextRequest(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, radiusKm, targetCount })
  });

  return POST(fakeReq);
}
