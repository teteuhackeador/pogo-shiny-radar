import { NextRequest, NextResponse } from "next/server";
import { BASE_API_URL, DEFAULT_POGO_TOKEN, POGO_TOKENS } from "@/lib/constants";
import { RevealResponse } from "@/types/pokemon";

// Cache em memória para não consumir cota do Mestre se o mesmo Pokémon for consultado novamente
const serverRevealCache = new Map<string, string>();

function getRandomSpoofedHeaders(authToken: string) {
  const ip = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254 + 1)}`;
  return {
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
    const revealCode = body.reveal_code;
    const encounterId = body.encounter_id;
    const apxLat = body.apx_lat;
    const apxLng = body.apx_long;
    const authToken = body.token || DEFAULT_POGO_TOKEN;

    if (!revealCode || typeof revealCode !== "string") {
      return NextResponse.json(
        { success: false, error: "invalid_code", message: "Código de revelação ausente ou inválido." },
        { status: 400 }
      );
    }

    // Retorna do cache se já foi revelado antes nesta sessão do servidor
    if (serverRevealCache.has(revealCode)) {
      return NextResponse.json({
        success: true,
        coords: serverRevealCache.get(revealCode),
        cached: true
      });
    }

    if (encounterId && serverRevealCache.has(encounterId)) {
      return NextResponse.json({
        success: true,
        coords: serverRevealCache.get(encounterId),
        cached: true
      });
    }

    let finalRes: Response | null = null;
    let maxRetryAfter = 180;
    const tokensToTry = Array.from(new Set([authToken, ...POGO_TOKENS]));

    for (const token of tokensToTry) {
      try {
        const res = await fetch(`${BASE_API_URL}/reveal/${encodeURIComponent(revealCode)}`, {
          method: "GET",
          headers: getRandomSpoofedHeaders(token)
        });

        if (res.ok) {
          finalRes = res;
          break;
        }

        if (res.status === 429) {
          try {
            const errorData = await res.json();
            if (errorData?.detail?.retry_after) {
              maxRetryAfter = parseInt(errorData.detail.retry_after, 10);
            }
          } catch {}
          // Passa para o próximo token do pool
          continue;
        }

        finalRes = res;
        break;
      } catch {
        continue;
      }
    }

    if (!finalRes || !finalRes.ok) {
      // Se todos os tokens atingiram rate limit, entregamos coordenadas aproximadas imediatamente
      if (apxLat != null && apxLng != null) {
        return NextResponse.json({
          success: true,
          coords: `${apxLat},${apxLng}`,
          is_approx: true,
          retry_after: maxRetryAfter,
          message: `Cota de reveals atingida nas contas (${maxRetryAfter}s). Fornecendo coordenadas aproximadas (~100m).`
        });
      }

      const response: RevealResponse = {
        success: false,
        error: "rate_limited",
        retry_after: maxRetryAfter,
        message: `Limite de reveals atingido na API. Libera em ${maxRetryAfter} segundos.`
      };

      return NextResponse.json(response, { status: 429 });
    }

    const res = finalRes;

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        {
          success: false,
          error: "api_error",
          message: `Erro na API externa de revelação (${res.status}): ${errorText}`
        },
        { status: res.status }
      );
    }

    const data = await res.json();
    if (!data.coords) {
      return NextResponse.json(
        { success: false, error: "not_found", message: "Coordenadas não retornadas pela API." },
        { status: 404 }
      );
    }

    // Salva no cache do servidor
    serverRevealCache.set(revealCode, data.coords);
    if (encounterId) {
      serverRevealCache.set(encounterId, data.coords);
    }

    return NextResponse.json({
      success: true,
      coords: data.coords
    });
  } catch (error: any) {
    console.error("Erro interno no /api/reveal:", error);
    return NextResponse.json(
      { success: false, error: "internal_error", message: error.message || "Erro no servidor ao revelar coordenadas." },
      { status: 500 }
    );
  }
}
