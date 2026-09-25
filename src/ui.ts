/* DOM layer: card grid, flip animations, theme/difficulty selectors,
 * two-player scoreboard. */

import {
  DIFFICULTIES,
  THEMES,
  boardLine,
  flip,
  makeRng,
  newGame,
  type Difficulty,
  type GameState,
  type Theme,
} from "./core.ts";

const THEME_KEYS = Object.keys(THEMES) as Theme[];

let game: GameState;
let lockMs = 700;
let lockTimer: ReturnType<typeof setTimeout> | null = null;

function setup(): void {
  const diffSelect = document.getElementById("difficulty") as HTMLSelectElement;
  for (const diff of DIFFICULTIES) {
    const option = document.createElement("option");
    option.value = diff.name;
    option.textContent = `${diff.name} (${diff.pairs} pairs)`;
    diffSelect.appendChild(option);
  }
  diffSelect.value = "medium";

  const themeSelect = document.getElementById("theme") as HTMLSelectElement;
  for (const key of THEME_KEYS) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = key;
    themeSelect.appendChild(option);
  }
  themeSelect.value = "fruits";

  const twoPlayer = document.getElementById("two-player") as HTMLInputElement;
  newRound(diffSelect, themeSelect, twoPlayer);

  const restart = () => newRound(diffSelect, themeSelect, twoPlayer);
  diffSelect.addEventListener("change", restart);
  themeSelect.addEventListener("change", restart);
  twoPlayer.addEventListener("change", restart);
  document.getElementById("new-game")?.addEventListener("click", restart);
}

function newRound(
  diffSelect: HTMLSelectElement,
  themeSelect: HTMLSelectElement,
  twoPlayer: HTMLInputElement,
): void {
  const difficulty = DIFFICULTIES.find((d) => d.name === diffSelect.value) as Difficulty;
  const names = twoPlayer.checked ? ["player 1", "player 2"] : ["solo"];
  game = newGame({
    difficulty,
    theme: themeSelect.value as Theme,
    playerNames: names,
    seed: Math.floor(Math.random() * 2 ** 31),
  });
  const boardEl = document.getElementById("board") as HTMLElement;
  boardEl.style.gridTemplateColumns = `repeat(${Math.ceil(game.cards.length / 4 / 2)}, 1fr)`;
  boardEl.innerHTML = "";
  game.cards.forEach((card, position) => {
    const cellEl = document.createElement("button");
    cellEl.className = "card";
    cellEl.dataset.pos = String(position);
    cellEl.textContent = "?";
    cellEl.addEventListener("click", () => onCard(position));
    boardEl.appendChild(cellEl);
  });
  paint();
}

function onCard(position: number): void {
  if (lockTimer !== null) return; // mismatch pause
  const result = flip(game, position);
  paint();
  if (result === "mismatch") {
    lockTimer = setTimeout(() => {
      lockTimer = null;
      paint();
    }, lockMs);
  }
}

function paint(): void {
  const cells = document.querySelectorAll<HTMLButtonElement>("#board .card");
  cells.forEach((cellEl) => {
    const position = Number(cellEl.dataset.pos);
    const card = game.cards[position];
    if (!card) return;
    if (card.matched) {
      cellEl.textContent = card.symbol;
      cellEl.classList.add("matched");
      cellEl.classList.remove("flipped");
    } else if (card.flipped) {
      cellEl.textContent = card.symbol;
      cellEl.classList.add("flipped");
    } else {
      cellEl.textContent = "?";
      cellEl.classList.remove("flipped", "matched");
    }
  });
  const status = document.getElementById("status") as HTMLElement;
  if (game.phase === "won") {
    const winner =
      game.winner === null
        ? ""
        : game.winner === -1
          ? " — draw!"
          : ` — ${game.players[game.winner]?.name} wins!`;
    status.textContent = `solved in ${game.moves} moves${winner}`;
  } else if (game.players.length === 2) {
    status.textContent = game.players
      .map((p, i) => `${i === game.turn ? "▶ " : ""}${p.name}: ${p.pairs}`)
      .join("  ·  ");
  } else {
    status.textContent = `moves: ${game.moves} · pairs: ${game.matchedPairs}/${game.totalPairs}`;
  }
}

setup();
