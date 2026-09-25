/* Pure game logic for the memory-match game: deck building, flip/match
 * state machine, scoring, two-player turns. No DOM here. */

export type Theme = "fruits" | "space" | "animals" | "cards";

export const THEMES: Record<Theme, string[]> = {
  fruits: ["🍎", "🍌", "🍇", "🍒", "🍍", "🥝", "🍑", "🍉", "🥑", "🍋", "🍓", "🫐"],
  space: ["🚀", "🛸", "🌍", "🌙", "⭐", "☄️", "🪐", "☀️", "🔭", "👽", "🛰️", "🌟"],
  animals: ["🐶", "🐱", "🦊", "🐻", "🐼", "🐨", "🦁", "🐮", "🐷", "🐸", "🐵", "🦉"],
  cards: ["🂡", "🂱", "🃁", "🃑", "🂢", "🂲", "🃂", "🃒", "🂪", "🂺", "🂾", "🃞"],
};

export interface Difficulty {
  name: string;
  pairs: number;
}

export const DIFFICULTIES: Difficulty[] = [
  { name: "easy", pairs: 6 },
  { name: "medium", pairs: 8 },
  { name: "hard", pairs: 10 },
];

export interface Card {
  id: number;
  symbol: string;
  flipped: boolean;
  matched: boolean;
}

export interface Player {
  name: string;
  pairs: number;
}

export interface GameState {
  cards: Card[];
  flipped: number[]; // currently face-up unmatched card ids (0..2 of them)
  players: Player[];
  turn: number; // index into players
  moves: number; // total attempts
  matchedPairs: number;
  totalPairs: number;
  phase: "playing" | "won";
  winner: number | null; // index or null; -1 = draw
}

/** Fisher-Yates with an injected rng so tests are deterministic. */
export function shuffled<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

export function makeRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

export interface GameOptions {
  difficulty: Difficulty;
  theme: Theme;
  playerNames: string[]; // 1 or 2 names
  seed?: number;
}

export function newGame(options: GameOptions): GameState {
  const { difficulty, theme, playerNames } = options;
  const symbols = shuffled(THEMES[theme], makeRng((options.seed ?? 1) + 77)).slice(
    0,
    difficulty.pairs,
  );
  const deck = shuffled(
    symbols.flatMap((symbol, kind) => [
      { id: kind * 2, symbol, flipped: false, matched: false },
      { id: kind * 2 + 1, symbol, flipped: false, matched: false },
    ]),
    makeRng((options.seed ?? 1) + 991),
  );
  const players: Player[] = playerNames.map((name) => ({ name, pairs: 0 }));
  return {
    cards: deck,
    flipped: [],
    players: players.length > 0 ? players : [{ name: "player 1", pairs: 0 }],
    turn: 0,
    moves: 0,
    matchedPairs: 0,
    totalPairs: difficulty.pairs,
    phase: "playing",
    winner: null,
  };
}

export type FlipResult = "flipped" | "matched" | "mismatch" | "ignored";

/** Flip the card at `position`. Two face-up unmatched cards resolve
 * immediately: match -> removed + same player continues; mismatch ->
 * flipped back and the turn passes. */
export function flip(game: GameState, position: number): FlipResult {
  if (game.phase !== "playing") return "ignored";
  if (game.flipped.length >= 2) return "ignored";
  const card = game.cards[position];
  if (!card || card.matched || card.flipped) return "ignored";

  card.flipped = true;
  game.flipped.push(position);

  if (game.flipped.length < 2) return "flipped";

  // resolve the pair
  game.moves += 1;
  const first = game.cards[game.flipped[0] as number] as Card;
  const second = game.cards[game.flipped[1] as number] as Card;
  if (first.symbol === second.symbol) {
    first.matched = true;
    second.matched = true;
    first.flipped = false;
    second.flipped = false;
    game.flipped = [];
    game.players[game.turn]!.pairs += 1;
    game.matchedPairs += 1;
    if (game.matchedPairs === game.totalPairs) {
      game.phase = "won";
      finish(game);
    }
    return "matched";
  }
  // mismatch: turn passes, cards flip back
  first.flipped = false;
  second.flipped = false;
  game.flipped = [];
  game.turn = (game.turn + 1) % game.players.length;
  return "mismatch";
}

function finish(game: GameState): void {
  const scores = game.players.map((p) => p.pairs);
  const best = Math.max(...scores);
  const winners = scores.filter((s) => s === best).length;
  game.winner = winners > 1 ? -1 : scores.indexOf(best);
}

/** Flatten the board to a single-line string for headless verification. */
export function boardLine(game: GameState): string {
  return game.cards
    .map((card) => {
      if (card.matched) return "◆";
      if (card.flipped) return card.symbol;
      return "?";
    })
    .join("");
}
