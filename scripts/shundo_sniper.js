/**
 * SHUNDO SNIPER SENTINEL - DAEMON DE ALERTA NOTURNO PARA LO
 * Alvo: Yamask (562) 100% IV Shiny para conta 489652495004
 * Dispara alarme no celular via Ntfy (fura DND com prioridade máxima e som de sirene)
 * Emite som sonoro no PC Windows
 */

const { exec } = require("child_process");

const POGO_TOKENS = [
  process.env.POGO_JWT_TOKEN || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYjRjZGU2Zi0wNzY3LTRiZTEtOTMwMC0wZGU3ZDAyNmZjNmQifQ.hKQkkTgmkvfMbR_uYaOBbHfTSSTh7_8cVF5h2OHm70I",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYzg3ZTQzYS1lY2YzLTRiYjEtOGRjNy1jODQ1NzkzOWQ2NDQifQ._IwwJskpBxvlR9T1YZKx2R6PmW8-5ocRYMFVxTNj0zk"
];

const BASE_API_URL = "https://coordinates-api.pokemongopro.com";
const TRAINER_CODE = process.env.POGO_TRAINER_CODE || "489652495004";
const NTFY_TOPIC = process.env.NTFY_TOPIC || "lo-shundo-yamask";
const TARGET_POKEMON_ID = 562; // Yamask (Normal e Galarian)
const TARGET_POKEMON_NAME = "Yamask";
const POLL_INTERVAL_MS = 25000; // 25 segundos

const alertedEncounters = new Set();
let tokenIdx = 0;

function getHeaders() {
  const token = POGO_TOKENS[tokenIdx % POGO_TOKENS.length];
  tokenIdx++;
  const ip = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254 + 1)}`;
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    "X-Forwarded-For": `${ip}, 127.0.0.1`,
    "Client-IP": ip,
    "X-Real-IP": ip,
    "CF-Connecting-IP": ip,
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15"
  };
}

// Toca sirene no Windows PC
function triggerPcAlarm() {
  const psCommand = `powershell -Command "[console]::beep(1200, 400); Start-Sleep -Milliseconds 100; [console]::beep(1500, 600); Start-Sleep -Milliseconds 100; [console]::beep(1800, 800)"`;
  exec(psCommand, (err) => {
    if (err) console.error("[PC-ALARM] Falha ao tocar som no PC:", err.message);
  });
}

// Dispara notificação urgente no celular
async function sendMobileAlarm(match, exactCoords) {
  const coordsStr = exactCoords || "Aguardando coordenadas exatas";
  const mapsUrl = exactCoords ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(exactCoords)}` : "https://pokemongopro.com";
  
  const title = `[ALERTA CRITICO] SHUNDO ${match.pokemon_name.toUpperCase()} 100% IV!`;
  const message = `SPAWN DETECTADO!\nEspecie: ${match.pokemon_name} (${match.form || "Normal"})\nNivel: ${match.level} | CP: ${match.cp}\nLocal: ${match.location}\nCoords: ${coordsStr}\nDespawn: ${match.despawn_at}`;

  console.log("\n=======================================================");
  console.log(`>>> DISPARANDO ALARME NO CELULAR DE LO (TOPICO: ${NTFY_TOPIC}) <<<`);
  console.log("=======================================================\n");

  try {
    const actions = [
      {
        action: "view",
        label: "Abrir no Mapa",
        url: mapsUrl
      }
    ];

    if (exactCoords) {
      actions.push({
        action: "copy",
        label: "Copiar Coordenadas",
        value: exactCoords
      });
    }

    const payload = {
      topic: NTFY_TOPIC,
      title: title,
      message: message,
      priority: 5,
      tags: ["skull", "warning", "sparkles"],
      sound: "sirens",
      actions: actions
    };

    const res = await fetch("https://ntfy.sh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.log("[NTFY] Notificacao enviada com sucesso para o celular!");
    } else {
      console.error("[NTFY] Erro ao enviar notificacao HTTP status:", res.status);
    }
  } catch (e) {
    console.error("[NTFY] Falha de conexao com o servidor de push:", e.message);
  }

  // Toca alarme no PC em loop curto
  triggerPcAlarm();
}

// Revela coordenadas exatas
async function revealCoordinates(revealCode) {
  for (let i = 0; i < POGO_TOKENS.length; i++) {
    try {
      const res = await fetch(`${BASE_API_URL}/reveal/${encodeURIComponent(revealCode)}`, {
        method: "GET",
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.coords) return data.coords;
      }
    } catch {}
  }
  return null;
}

// Varredura de Yamask
async function checkYamaskSpawns() {
  const timestamp = new Date().toLocaleTimeString("pt-BR");
  process.stdout.write(`[${timestamp}] [SENTINELA] Varrendo o globo em busca de ${TARGET_POKEMON_NAME} 100% IV... `);

  const payload = {
    pokemon_ids: [TARGET_POKEMON_ID],
    shiny_account: TRAINER_CODE,
    iv_mode: "percent",
    iv_percent_min: 100,
    iv_percent_max: 100,
    shiny_only: false
  };

  try {
    const res = await fetch(`${BASE_API_URL}/search`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      if (res.status === 429) {
        console.log("Rate limited (429). Aguardando proximo ciclo.");
      } else {
        console.log(`Erro HTTP ${res.status}`);
      }
      return;
    }

    const data = await res.json();
    const results = data.results || [];
    const now = Date.now();

    const activeHundos = results.filter(p => !p.despawn_at || new Date(p.despawn_at).getTime() > now);

    if (activeHundos.length === 0) {
      console.log(`Zero Hundos ativos no momento.`);
      return;
    }

    console.log(`Encontrados ${activeHundos.length} Hundo(s) 100% IV!`);

    for (const hundo of activeHundos) {
      const isShinyForLo = hundo.shiny === true;
      const formTag = hundo.form ? `[${hundo.form}]` : "[Normal]";
      console.log(`  -> ${hundo.pokemon_name} ${formTag} Lvl ${hundo.level} CP ${hundo.cp} em ${hundo.location} | Shiny LO: ${isShinyForLo ? "SIM (SHUNDO!)" : "Nao"}`);

      if (isShinyForLo) {
        if (!alertedEncounters.has(hundo.encounter_id)) {
          alertedEncounters.add(hundo.encounter_id);
          console.log("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
          console.log(`!!! SHUNDO CONFIRMADO PARA A CONTA DO LO: ${TRAINER_CODE} !!!`);
          console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n");

          let exactCoords = null;
          if (hundo.reveal_code) {
            console.log("[REVEAL] Decodificando coordenadas exatas no servidor...");
            exactCoords = await revealCoordinates(hundo.reveal_code);
            console.log(`[REVEAL] Coordenadas exatas obtidas: ${exactCoords}`);
          }

          await sendMobileAlarm(hundo, exactCoords);
        }
      }
    }
  } catch (err) {
    console.log(`Falha na varredura: ${err.message}`);
  }
}

// Inicializacao
console.log("==================================================================");
console.log("         SHUNDO SNIPER DAEMON - VIGIA NOTURNO LO v1.0             ");
console.log("==================================================================");
console.log(`* Conta Treinador:   ${TRAINER_CODE}`);
console.log(`* Alvo Primario:     ${TARGET_POKEMON_NAME} (ID: ${TARGET_POKEMON_ID})`);
console.log(`* Condicao Alerta:   100% IV + SHINY GARANTIDO (SHUNDO)`);
console.log(`* Canal Push Celular: https://ntfy.sh/${NTFY_TOPIC}`);
console.log(`* Intervalo:         ${POLL_INTERVAL_MS / 1000}s`);
console.log("==================================================================\n");

checkYamaskSpawns();
setInterval(checkYamaskSpawns, POLL_INTERVAL_MS);
