import { NextRequest, NextResponse } from "next/server";
import { BASE_API_URL, DEFAULT_POGO_TOKEN } from "@/lib/constants";
import { RevealResponse } from "@/types/pokemon";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const revealCode = body.reveal_code;
    const authToken = body.token || DEFAULT_POGO_TOKEN;

    if (!revealCode || typeof revealCode !== "string") {
      return NextResponse.json(
        { success: false, error: "invalid_code", message: "Código de revelação ausente ou inválido." },
        { status: 400 }
      );
    }

    const res = await fetch(`${BASE_API_URL}/reveal/${encodeURIComponent(revealCode)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${authToken}`
      }
    });

    if (res.status === 429) {
      let retryAfter = 180;
      try {
        const errorData = await res.json();
        if (errorData?.detail?.retry_after) {
          retryAfter = parseInt(errorData.detail.retry_after, 10);
        }
      } catch (e) {
        // Fallback
      }

      const response: RevealResponse = {
        success: false,
        error: "rate_limited",
        retry_after: retryAfter,
        message: `Limite de 10 reveals por ciclo atingido na API. Libera em ${retryAfter} segundos.`
      };

      return NextResponse.json(response, { status: 429 });
    }

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
