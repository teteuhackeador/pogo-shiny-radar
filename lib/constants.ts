export const DEFAULT_POGO_TOKEN =
  process.env.POGO_JWT_TOKEN ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYjRjZGU2Zi0wNzY3LTRiZTEtOTMwMC0wZGU3ZDAyNmZjNmQifQ.hKQkkTgmkvfMbR_uYaOBbHfTSSTh7_8cVF5h2OHm70I";

export const DEFAULT_TRAINER_CODE =
  process.env.POGO_TRAINER_CODE || "489652495004";

export const BASE_API_URL = "https://coordinates-api.pokemongopro.com";

export interface GeoPreset {
  name: string;
  badge: string;
  lat: number;
  lng: number;
  description: string;
}

export const GEO_PRESETS: GeoPreset[] = [
  {
    name: "Toronto / Mississauga",
    badge: "🇨🇦 Home Base",
    lat: 43.5442968,
    lng: -79.7399437,
    description: "Base oficial do Mestre em Ontário"
  },
  {
    name: "Zaragoza",
    badge: "🇪🇸 Mega Spawn",
    lat: 41.661130,
    lng: -0.893540,
    description: "Maior cluster de PokéStops e spawns da Europa"
  },
  {
    name: "Pier 39 (San Francisco)",
    badge: "🇺🇸 Hotspot",
    lat: 37.808600,
    lng: -122.409800,
    description: "Clássico hotspot americano no píer marítimo"
  },
  {
    name: "Parque Ibirapuera (SP)",
    badge: "🇧🇷 Brasil",
    lat: -23.587416,
    lng: -46.657634,
    description: "Principal ninho e centro comunitário de São Paulo"
  },
  {
    name: "Shinjuku (Tóquio)",
    badge: "🇯🇵 Japão",
    lat: 35.690022,
    lng: 139.700344,
    description: "Densidade máxima de lures e raids no Japão"
  },
  {
    name: "Sydney Circular Quay",
    badge: "🇦🇺 Oceania",
    lat: -33.856784,
    lng: 151.215297,
    description: "Ópera de Sydney e orla australiana"
  }
];

/**
 * Retorna a URL do sprite oficial de alta resolução para Pokémons Shiny
 */
export function getPokemonSpriteUrl(pokemonId: number): string {
  // Arte oficial de alta definição com fallback garantido
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${pokemonId}.png`;
}

export function getPokemonFallbackSprite(pokemonId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${pokemonId}.png`;
}

/**
 * Calcula a distância em km entre dois pontos geográficos (Fórmula de Haversine)
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}
