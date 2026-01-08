export interface PlayerStats {
  name: string;
  avg_profit: number;
  profits?: number[];
  std_dev?: number;
  confidence_interval?: number;
  win_rate: number;
  total_hands: number;
  total_cost: number;
  avg_cost_per_decision: number;
  avg_reasoning_tokens: number;
  vpip: number;
  pfr: number;
  three_bet: number;
  c_bet: number;
}

export interface Summary {
  timestamp: number;
  total_games: number;
  leaderboard: PlayerStats[];
  aggregated_stacks: Record<string, number[]>;
  enriched_stacks?: Record<string, { mean: number[], low: number[], high: number[], individual?: number[][] }>;
}

export interface Action {
  type: 'street_event' | 'player_action';
  street?: string;
  cards?: string[]; // For street_event
  player?: string;
  action?: string;
  amount?: number;
  chips_added?: number;
  pot_before?: number; // Sometimes missing in street_event
  thought?: string;
  valid?: boolean;
}

export interface HandResult {
  player: string;
  net_gain: number;
  winner: boolean;
}

export interface Hand {
  hand_number: number;
  dealer: string;
  pre_hand_stacks: Record<string, number>;
  hole_cards: Record<string, string[]>;
  board: string[];
  actions: Action[];
  results: HandResult[];
}

export interface GameConfig {
  hands: number;
  start_stack: number;
}

export interface Game {
  game_id: string;
  timestamp: number;
  config: GameConfig;
  players: string[];
  hands: Hand[];
}

export interface EnrichedStackStats {
  mean: number[];
  low: number[];
  high: number[];
  individual?: number[][];
}

export interface PlayerRankStats {
  avg: number;
  stdDev: number;
  ci: number;
}

export interface RunStats {
  profits: Record<string, number[]>;
  stacks: Record<string, EnrichedStackStats>;
  ranks: Record<string, PlayerRankStats>;
  playerStats?: Record<string, { vpip: number; pfr: number; three_bet: number; c_bet: number }>;
}
