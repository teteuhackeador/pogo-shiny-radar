import { NextRequest, NextResponse } from "next/server";
import { BASE_API_URL, DEFAULT_TRAINER_CODE, POGO_TOKENS } from "@/lib/constants";

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

// Dispara notificação de emergência para o celular do LO via ntfy.sh
export async function sendNtfyAlarm(params: {
  topic: string;
  title: string;
  message: string;
  coords?: string;
  priority?: number;
  sound?: string;
}) {
  const { topic, title, message, coords, priority = 5, sound = "sirens" } = params;
  const cleanTopic = topic.trim() || "lo-shundo-yamask";

  const actions: any[] = [];
  if (coords) {
    actions.push({
      action: "view",
      label: "Abrir Google Maps",
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`
    });
    actions.push({
      action: "copy",
      label: "Copiar Coords",
      value: coords
    });
  }

  const payload: any = {
    topic: cleanTopic,
    title,
    message,
    priority,
    tags: ["skull", "warning", "sparkles"],
    sound
  };

  if (actions.length > 0) {
    payload.actions = actions;
  }

  try {
    const res = await fetch("https://ntfy.sh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, status: res.status };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// Revela coordenadas exatas usando reveal_code
async function revealCoords(revealCode: string): Promise<string | null> {
  for (const token of POGO_TOKENS) {
    try {
      const res = await fetch(`${BASE_API_URL}/reveal/${encodeURIComponent(revealCode)}`, {
        method: "GET",
        headers: getRandomSpoofedHeaders(token),
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.coords) return data.coords;
      }
    } catch {}
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "scan"; // "scan" | "test"
    const topic = body.ntfyTopic || "lo-shundo-yamask";
    const trainerCode = body.shinyAccount || DEFAULT_TRAINER_CODE;
    const targetSpeciesId = body.pokemonId ? parseInt(body.pokemonId, 10) : 562; // 562 = Yamask
    const targetSpeciesName = body.pokemonName || "Yamask";
    const requireShiny = body.requireShiny !== false; // Padrão: estritamente shiny

    // =========================================================================
    // AÇÃO: TESTAR NOTIFICAÇÃO NO CELULAR
    // =========================================================================
    if (action === "test") {
      const testResult = await sendNtfyAlarm({
        topic,
        title: "DISPARO DE TESTE: ALARME DO CELULAR",
        message: `Canal de emergência ativo! Este é o som de teste para acordar você quando o Shundo ${targetSpeciesName} spawnar.`,
        coords: "40.758896,-73.985130",
        priority: 5,
        sound: "sirens"
      });

      return NextResponse.json({
        success: testResult.ok,
        topic,
        details: testResult
      });
    }

    // =========================================================================
    // AÇÃO: ESCANEAR BUSCANDO YAMASK 100% IV
    // =========================================================================
    // PASSO 1: Busca global de Yamask 100% IV com conta neutra (preserva 100% da cota do LO)
    const payload = {
      pokemon_ids: [targetSpeciesId],
      shiny_account: "1000", // Conta neutra/dummy
      iv_mode: "percent",
      iv_percent_min: 100,
      iv_percent_max: 100,
      shiny_only: false
    };

    let apiResults: any[] = [];
    for (const token of POGO_TOKENS) {
      try {
        const res = await fetch(`${BASE_API_URL}/search`, {
          method: "POST",
          headers: getRandomSpoofedHeaders(token),
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          apiResults = data.results || [];
          break;
        }
      } catch {}
    }

    // PASSO 2: Se encontramos algum Yamask 100% IV ativo no mundo, checamos especificamente para a conta do LO
    if (apiResults.length > 0 && trainerCode !== "1000") {
      try {
        const checkRes = await fetch(`${BASE_API_URL}/search`, {
          method: "POST",
          headers: getRandomSpoofedHeaders(POGO_TOKENS[0]),
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            pokemon_ids: [targetSpeciesId],
            shiny_account: trainerCode,
            iv_mode: "percent",
            iv_percent_min: 100,
            iv_percent_max: 100,
            shiny_only: false
          })
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          apiResults = checkData.results || apiResults;
        }
      } catch {}
    }

    const now = Date.now();
    const candidates = apiResults.filter((p) => {
      if (p.despawn_at && new Date(p.despawn_at).getTime() <= now) return false;
      if (requireShiny && !p.shiny) return false;
      return true;
    });

    const enrichedMatches = await Promise.all(
      candidates.map(async (p) => {
        let exactCoords = null;
        if (p.reveal_code) {
          exactCoords = await revealCoords(p.reveal_code);
        }
        return {
          encounter_id: p.encounter_id,
          pokemon_name: p.pokemon_name,
          form: p.form,
          cp: p.cp,
          level: p.level,
          iv_percent: p.iv_percent,
          raw_iv: p.raw_iv || "15/15/15",
          shiny: p.shiny,
          location: p.location,
          despawn_at: p.despawn_at,
          exact_coords: exactCoords,
          reveal_code: p.reveal_code
        };
      })
    );

    // Se encontramos Shundo e foi solicitado alerta
    let alarmSent = false;
    if (enrichedMatches.length > 0) {
      for (const match of enrichedMatches) {
        if (match.shiny || !requireShiny) {
          const coordsStr = match.exact_coords || `${match.location}`;
          await sendNtfyAlarm({
            topic,
            title: `SHUNDO ${match.pokemon_name.toUpperCase()} 100% IV!`,
            message: `Nível: ${match.level} | CP: ${match.cp} | Local: ${match.location}\nCoordenadas: ${coordsStr}\nDespawn: ${match.despawn_at || "Em breve"}`,
            coords: match.exact_coords || undefined,
            priority: 5,
            sound: "sirens"
          });
          alarmSent = true;
        }
      }
    }

    return NextResponse.json({
      success: true,
      matches_found: enrichedMatches.length,
      alarm_triggered: alarmSent,
      topic,
      target: {
        species_id: targetSpeciesId,
        species_name: targetSpeciesName,
        require_shiny: requireShiny,
        trainer_code: trainerCode
      },
      matches: enrichedMatches,
      raw_hundo_count: apiResults.length
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro interno no sniper."
      },
      { status: 500 }
    );
  }
}
