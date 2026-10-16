"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Crosshair,
  Bell,
  Volume2,
  VolumeX,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  X,
  Sparkles,
  ExternalLink,
  Crown
} from "lucide-react";
import { DEFAULT_TRAINER_CODE } from "@/lib/constants";

interface SniperModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainerCode: string;
}

export const SniperModal: React.FC<SniperModalProps> = ({
  isOpen,
  onClose,
  trainerCode
}) => {
  const [ntfyTopic, setNtfyTopic] = useState("lo-shundo-yamask");
  const [pokemonId, setPokemonId] = useState("562"); // 562 = Yamask
  const [pokemonName, setPokemonName] = useState("Yamask");
  const [requireShiny, setRequireShiny] = useState(true);
  const [isWatching, setIsWatching] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [lastScanResult, setLastScanResult] = useState<any>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const watchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Inicializa tópico do localStorage se existir
  useEffect(() => {
    const savedTopic = localStorage.getItem("pogo_ntfy_topic");
    if (savedTopic) setNtfyTopic(savedTopic);
  }, []);

  const handleTopicChange = (val: string) => {
    const clean = val.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
    setNtfyTopic(clean);
    localStorage.setItem("pogo_ntfy_topic", clean);
  };

  // Sirene WebAudio no navegador
  const playWebAudioSiren = () => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.3);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.6);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {}
  };

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString("pt-BR");
    setLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 30)]);
  };

  // Disparo de teste para o celular
  const handleTestAlarm = async () => {
    setTestStatus("Enviando disparo de teste para o celular...");
    playWebAudioSiren();

    try {
      const res = await fetch("/api/sniper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          ntfyTopic,
          pokemonName
        })
      });

      const data = await res.json();
      if (data.success) {
        setTestStatus("Disparo enviado! Verifique o app ntfy no seu celular.");
        addLog(`Disparo de teste enviado com som de sirene para o topico: ${ntfyTopic}`);
      } else {
        setTestStatus("Erro ao conectar com ntfy.sh.");
        addLog(`Falha no envio de teste.`);
      }
    } catch {
      setTestStatus("Erro de rede ao enviar teste.");
      addLog(`Erro de rede no teste.`);
    }

    setTimeout(() => setTestStatus(null), 7000);
  };

  // Ciclo de escaneamento do sniper
  const performCheck = async () => {
    try {
      addLog(`Consultando rede global por ${pokemonName} 100% IV...`);
      const res = await fetch("/api/sniper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "scan",
          ntfyTopic,
          shinyAccount: trainerCode || DEFAULT_TRAINER_CODE,
          pokemonId: parseInt(pokemonId, 10),
          pokemonName,
          requireShiny
        })
      });

      const data = await res.json();
      setLastScanResult(data);

      if (data.success) {
        const hundos = data.raw_hundo_count || 0;
        const shundos = data.matches_found || 0;

        if (shundos > 0) {
          playWebAudioSiren();
          addLog(`CRITICO: ${shundos} SHUNDO(S) ENCONTRADOS! Alarme enviado para o celular!`);
        } else if (hundos > 0) {
          addLog(`${hundos} Hundo(s) 100% detectados no mundo, porem nenhum Shiny para a conta.`);
        } else {
          addLog(`Nenhum spawn 100% IV ativo no instante.`);
        }
      } else {
        addLog(`Aviso da API: ${data.error || "Tentando novamente no proximo ciclo."}`);
      }
    } catch (err: any) {
      addLog(`Erro na requisicao: ${err.message}`);
    }
  };

  // Toggle do vigia contínuo
  const toggleWatcher = () => {
    if (isWatching) {
      if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
      setIsWatching(false);
      addLog("Sentinela interrompida.");
    } else {
      setIsWatching(true);
      addLog(`Sentinela ativada para ${pokemonName} Shundo! Varreduras a cada 30 segundos.`);
      performCheck();
      watchIntervalRef.current = setInterval(performCheck, 30000);
    }
  };

  useEffect(() => {
    return () => {
      if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Header Tático */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                Shundo Sniper & Despertador Noturno
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                  VIP BYPASS
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Vigia autônomo 24/7 com notificação de emergência no celular
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo de Configurações */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          
          {/* Instruções do Alarme no Celular */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-200 font-medium">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                Como Acordar no Celular (Passo Único Grátis)
              </div>
              <a
                href="https://ntfy.sh"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-zinc-400 hover:text-emerald-400 flex items-center gap-1"
              >
                ntfy.sh <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              1. Instale o aplicativo <strong>ntfy</strong> na Google Play Store (Android) ou App Store (iOS).<br />
              2. No app, clique no <strong>+</strong> e inscreva-se no tópico abaixo.<br />
              3. Nas configurações do app no celular, certifique-se de que notificações de emergência têm permissão para tocar alarme sonoro.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <div className="flex-1">
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">
                  SEU TÓPICO SECRETO NTFY
                </label>
                <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-xs text-emerald-400">
                  <span className="text-zinc-600 mr-1">ntfy.sh/</span>
                  <input
                    type="text"
                    value={ntfyTopic}
                    onChange={(e) => handleTopicChange(e.target.value)}
                    className="bg-transparent border-none outline-none text-emerald-400 w-full"
                    placeholder="ex: lo-shundo-yamask"
                  />
                </div>
              </div>

              <div className="sm:self-end">
                <button
                  onClick={handleTestAlarm}
                  className="w-full sm:w-auto px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg font-medium text-xs flex items-center justify-center gap-2 border border-zinc-700 transition-all active:scale-95"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-400" />
                  Testar Alarme no Celular
                </button>
              </div>
            </div>

            {testStatus && (
              <div className="text-xs font-mono text-amber-300 bg-amber-950/40 border border-amber-900/60 p-2.5 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                {testStatus}
              </div>
            )}
          </div>

          {/* Configuração do Alvo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 space-y-2">
              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                Espécie Alvo
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pokemonName}
                  onChange={(e) => setPokemonName(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 w-full focus:outline-none focus:border-zinc-700 font-mono"
                  placeholder="Nome do Pokemon"
                />
                <input
                  type="number"
                  value={pokemonId}
                  onChange={(e) => setPokemonId(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 w-24 focus:outline-none focus:border-zinc-700 font-mono text-center"
                  placeholder="ID (562)"
                />
              </div>
              <p className="text-[11px] text-zinc-500 font-mono">
                Pokedex #562 cobre Yamask Normal e Galarian
              </p>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 space-y-3">
              <div className="text-xs font-medium text-zinc-300">Critério de Disparo</div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={requireShiny}
                    onChange={(e) => setRequireShiny(e.target.checked)}
                    className="rounded bg-zinc-950 border-zinc-800 text-amber-500 focus:ring-0"
                  />
                  <span>Apenas Shundo (100% IV + Shiny garantido para sua conta)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                    className="rounded bg-zinc-950 border-zinc-800 text-amber-500 focus:ring-0"
                  />
                  <span>Tocar sirene sonora no navegador se a aba estiver aberta</span>
                </label>
              </div>
            </div>
          </div>

          {/* Controle da Sentinela */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl">
            <div>
              <div className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isWatching ? "bg-emerald-400 animate-ping" : "bg-zinc-600"
                  }`}
                />
                Status: {isWatching ? "SENTINELA ATIVA (VIGIANDO)" : "INATIVO"}
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">
                {isWatching
                  ? "Varredura contínua de 30s ativa. Deixe esta aba aberta ou use o daemon de terminal."
                  : "Clique em Iniciar para ativar o vigia automático."}
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={performCheck}
                disabled={isWatching}
                className="flex-1 sm:flex-none px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium border border-zinc-700 disabled:opacity-50"
              >
                Checagem Única
              </button>
              <button
                onClick={toggleWatcher}
                className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  isWatching
                    ? "bg-rose-600 hover:bg-rose-500 text-white"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {isWatching ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Parar Sentinela
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Iniciar Sentinela
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Terminal de Logs */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex justify-between">
              <span>Console de Telemetria</span>
              <span>{logs.length} eventos</span>
            </div>
            <div className="h-32 bg-black/90 border border-zinc-800 rounded-xl p-3 font-mono text-[11px] text-zinc-300 overflow-y-auto space-y-1 select-text">
              {logs.length === 0 ? (
                <div className="text-zinc-600">Aguardando início das operações...</div>
              ) : (
                logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={
                      log.includes("CRITICO")
                        ? "text-amber-400 font-bold"
                        : log.includes("Hundo")
                        ? "text-emerald-400"
                        : "text-zinc-400"
                    }
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Rodapé Tático */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between text-xs text-zinc-500 font-mono">
          <div>CONTA: {trainerCode || DEFAULT_TRAINER_CODE}</div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
