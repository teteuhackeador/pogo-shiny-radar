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
    const targetCount = Math.min(parseInt(body.targetCount || 30, 10), 60);
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
    let distRankCounter = 1;

    // Estratégia Multi-Pass Inteligente:
    // O site Pogocoordinates só permite filtrar por espécie (blacklist_pokemon_ids).
    // Se usássemos apenas uma busca com blacklist, cada espécie só apareceria UMA VEZ
    // (o que limitava artificialmente o resultado a ~20-22 alvos, que é o número de espécies diferentes no raio).
    // Ao alternar os métodos de ordenação do backend da API (DIST, DSP, IV, CP), conseguimos
    // capturar múltiplas instâncias da mesma espécie (ex: 4 Ponytas, 5 Cacneas, etc.) e contornar esse teto!
    const sortPasses = [
      { sort: "DIST", maxRounds: 3 },
      { sort: "DSP", maxRounds: 3 },
      { sort: "IV", maxRounds: 2 },
      { sort: "CP", maxRounds: 2 }
    ];

    for (const pass of sortPasses) {
      if (allShinys.size >= targetCount) break;

      const passBlacklist: number[] = [];

      for (let round = 1; round <= pass.maxRounds; round++) {
        if (allShinys.size >= targetCount) break;

        const searchPayload = {
          shiny_only: true,
          shiny_account: trainerCode,
          center_lat: lat,
          center_lng: lng,
          radius_km: radiusKm,
          sort: pass.sort,
          blacklist_pokemon_ids: passBlacklist,
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

        totalQueries++;
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
          // Descartar imediatamente spawns que já expiraram no servidor
          if (p.despawn_at) {
            const despawnMs = new Date(p.despawn_at).getTime();
            if (despawnMs <= now) continue;
          }

          if (!allShinys.has(p.encounter_id)) {
            allShinys.set(p.encounter_id, {
              ...p,
              shiny: true,
              exact_coords: null,
              distance_rank: pass.sort === "DIST" ? distRankCounter++ : 999
            });
            newInThisRound++;
          }

          if (!passBlacklist.includes(p.pokemon_id)) {
            passBlacklist.push(p.pokemon_id);
          }
        }

        if (newInThisRound === 0) {
          break;
        }

        // Delay de 250ms para evitar rate-limit de burst na API
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    const finalList = Array.from(allShinys.values()).slice(0, targetCount);

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
  const targetCount = parseInt(searchParams.get("targetCount") || "30", 10);

  const fakeReq = new NextRequest(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, radiusKm, targetCount })
  });

  return POST(fakeReq);
}
