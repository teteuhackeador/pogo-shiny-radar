export interface PokemonSpawn {
  encounter_id: string;
  pokemon_id: number;
  pokemon_name: string;
  form: string | null;
  costume_id: number | null;
  costume: string | null;
  cp: number;
  level: number;
  location: string;
  raw_iv: string; // e.g. "15/15/15"
  iv_percent: number;
  gender: 'Male' | 'Female' | 'Genderless' | string;
  size: string;
  weather_boosted: boolean;
  weather_id: number;
  fast_move: string;
  charge_move: string;
  despawn_at: string; // ISO 8601
  despawn_verified: boolean;
  reveal_code: string;
  distance_km?: number | null;
  pvp?: any;
  shiny: boolean;
  background: boolean;
  // Campos enriquecidos pelo cliente / radar:
  exact_coords?: string | null; // "lat,lng" quando revelado
  is_captured?: boolean;
}

export interface HuntRequestPayload {
  lat: number;
  lng: number;
  radiusKm?: number;
  targetCount?: number;
  shinyAccount?: string;
  token?: string;
}

export interface HuntResponse {
  success: boolean;
  count: number;
  rounds: number;
  results: PokemonSpawn[];
  cachedReveals?: Record<string, string>;
  error?: string;
}

export interface RevealRequestPayload {
  reveal_code: string;
  encounter_id?: string;
  token?: string;
}

export interface RevealResponse {
  success: boolean;
  coords?: string;
  error?: 'rate_limited' | 'invalid_code' | 'api_error' | string;
  retry_after?: number;
  message?: string;
}

export type SortOption = 'despawn' | 'distance' | 'iv_desc' | 'cp_desc' | 'level_desc';
export type IvFilterOption = 'all' | '50' | '80' | '90' | '100';
export type TabOption = 'all' | 'available' | 'captured';
