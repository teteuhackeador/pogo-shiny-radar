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
    const blacklistPokemonIds: number[] = [];
    let round = 1;
    const maxRounds = 10;

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
        const errorText = await res.text();
        console.error(`Erro na busca externa (Round ${round}): HTTP ${res.status} - ${errorText}`);
        // Se já tivermos alguns shinys encontrados antes do erro, retornamos o lote parcial!
        if (allShinys.size > 0) {
          break;
        }
        return NextResponse.json(
          { success: false, error: `Erro na API externa (${res.status}): ${errorText}` },
          { status: res.status }
        );
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
        }
        if (!blacklistPokemonIds.includes(p.pokemon_id)) {
          blacklistPokemonIds.push(p.pokemon_id);
        }
      }

      if (newInThisRound === 0) {
        // Nenhuma novidade encontrada nessa rodada
        break;
      }

      round++;
      // Pequeno throttle gentil de 250ms para manter a estabilidade da conexão
      if (allShinys.size < targetCount && round <= maxRounds) {
        await new Promise((r) => setTimeout(r, 250));
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
  const targetCount = parseInt(searchParams.get("targetCount") || "20", 10);

  // Redireciona para o handler POST com o payload equivalente
  const fakeReq = new NextRequest(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, radiusKm, targetCount })
  });

  return POST(fakeReq);
}
