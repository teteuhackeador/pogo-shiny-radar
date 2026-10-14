import { NextRequest, NextResponse } from "next/server";
import { BASE_API_URL, DEFAULT_POGO_TOKEN, DEFAULT_TRAINER_CODE } from "@/lib/constants";
import { PokemonSpawn } from "@/types/pokemon";

export const maxDuration = 30; // Suporte a Vercel serverless functions estendidas

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lat = parseFloat(body.lat);
    const lng = parseFloat(body.lng);
    const radiusKm = parseFloat(body.radiusKm || 50);
    const targetCount = Math.min(parseInt(body.targetCount || 30, 10), 100);
    const trainerCode = body.shinyAccount || DEFAULT_TRAINER_CODE;
    const authToken = body.token || DEFAULT_POGO_TOKEN;

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { success: false, error: "Coordenadas 'lat' e 'lng' são obrigatórias e devem ser números." },
        { status: 400 }
      );
    }

    const allShinys = new Map<string, PokemonSpawn>();
    const blacklistPokemonIds: number[] = [];

    // =========================================================================
    // ETAPA 1: O BYPASS DE OURO VIA /map/lookup
    // Coleta até 100 pokémons com COORDENADAS EXATAS REVELADAS (apx_lat, apx_long)
    // Sem passar pelo limitador de /reveal e sem risco de HTTP 429!
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
          sort: "IV"
        },
        num_results: 100
      };

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
          const coords = p.apx_lat && p.apx_long ? `${p.apx_lat},${p.apx_long}` : null;
          const despawnIso = p.despawn_at_ms ? new Date(p.despawn_at_ms).toISOString() : new Date(Date.now() + 15 * 60 * 1000).toISOString();

          allShinys.set(p.encounter_id, {
            encounter_id: p.encounter_id,
            pokemon_id: p.pokemon_id,
            pokemon_name: p.pokemon_name,
            form: p.form || null,
            costume_id: null,
            costume: p.costume || null,
            cp: p.cp || 0,
            level: p.level || 0,
            location: p.location || `Coords: ${p.apx_lat?.toFixed(4)}, ${p.apx_long?.toFixed(4)}`,
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
            exact_coords: coords // COORDENADA JÁ REVELADA E PRONTA!
          });

          if (!blacklistPokemonIds.includes(p.pokemon_id)) {
            blacklistPokemonIds.push(p.pokemon_id);
          }
        }
      }
    } catch (mapErr) {
      console.warn("Aviso: /map/lookup falhou ou indisponível, seguindo para /search:", mapErr);
    }

    // =========================================================================
    // ETAPA 2: COMPLEMENTO VIA /search COM BLACKLIST RECURSIVA
    // Varridura de espécies adicionais para alcançar o targetCount
    // =========================================================================
    let round = 1;
    const maxRounds = 6;

    while (allShinys.size < targetCount && round <= maxRounds) {
      const searchPayload = {
        shiny_only: true,
        shiny_account: trainerCode,
        center_lat: lat,
        center_lng: lng,
        radius_km: radiusKm,
        sort: "DIST",
        blacklist_pokemon_ids: blacklistPokemonIds,
        background_only: false,
        pvp_mode: false,
        pokemon_ids: [],
        species_forms: [],
        location: null,
        cp_min: null,
        cp_max: null,
        level_min: null,
        level_max: null,
        iv_mode: "percent",
        iv_percent_min: null,
        iv_percent_max: null,
        sizes: [],
        forms: [],
        gender: null,
        boosted: null,
        weather_id: null,
        min_ttl: null,
        blacklist_species_forms: [],
        blacklist_forms: []
      };

      const res = await fetch(`${BASE_API_URL}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify(searchPayload)
      });

      if (!res.ok) {
        break;
      }

      const data = await res.json();
      const results: PokemonSpawn[] = data.results || [];

      if (results.length === 0) {
        break;
      }

      let newInThisRound = 0;
      for (const p of results) {
        if (!allShinys.has(p.encounter_id)) {
          allShinys.set(p.encounter_id, {
            ...p,
            shiny: true
          });
          newInThisRound++;
        } else {
          // Se já tínhamos pelo map/lookup, enriquecemos com dados textuais de location e moves!
          const existing = allShinys.get(p.encounter_id)!;
          if (p.location) existing.location = p.location;
          if (p.fast_move) existing.fast_move = p.fast_move;
          if (p.charge_move) existing.charge_move = p.charge_move;
        }

        if (!blacklistPokemonIds.includes(p.pokemon_id)) {
          blacklistPokemonIds.push(p.pokemon_id);
        }
      }

      if (newInThisRound === 0) {
        break;
      }

      round++;
      if (allShinys.size < targetCount && round <= maxRounds) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    const finalList = Array.from(allShinys.values()).slice(0, targetCount);

    return NextResponse.json({
      success: true,
      count: finalList.length,
      rounds: round - 1,
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
  const targetCount = parseInt(searchParams.get("targetCount") || "30", 10);

  const fakeReq = new NextRequest(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, radiusKm, targetCount })
  });

  return POST(fakeReq);
}
