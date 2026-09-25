import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIFFICULTIES,
  THEMES,
  boardLine,
  flip,
  makeRng,
  newGame,
  shuffled,
} from "../src/core.ts";

test("deck has exactly `pairs` matching pairs, shuffled deterministically", () => {
  const a = newGame({ difficulty: DIFFICULTIES[0], theme: "fruits", playerNames: ["p1"], seed: 5 });
  const b = newGame({ difficulty: DIFFICULTIES[0], theme: "fruits", playerNames: ["p1"], seed: 5 });
  assert.equal(a.cards.length, 12);
  assert.deepEqual(
    a.cards.map((c) => c.id),
    b.cards.map((c) => c.id),
  );
  const counts = new Map<string, number>();
  for (const card of a.cards) {
    counts.set(card.symbol, (counts.get(card.symbol) ?? 0) + 1);
  }
  assert.equal(counts.size, DIFFICULTIES[0].pairs);
  for (const count of counts.values()) assert.equal(count, 2, "each symbol twice");
});

test("different seeds shuffle differently (overwhelming probability)", () => {
  const a = newGame({ difficulty: DIFFICULTIES[1], theme: "space", playerNames: ["x"], seed: 1 });
  const b = newGame({ difficulty: DIFFICULTIES[1], theme: "space", playerNames: ["x"], seed: 2 });
  assert.notDeepEqual(
    a.cards.map((c) => c.id),
    b.cards.map((c) => c.id),
  );
});

test("single flip: stays face up, no turn change", () => {
  const game = newGame({ difficulty: DIFFICULTIES[0], theme: "fruits", playerNames: ["a"], seed: 3 });
  const result = flip(game, 0);
  assert.equal(result, "flipped");
  assert.equal(game.flipped.length, 1);
  assert.equal(game.turn, 0);
  assert.equal(game.moves, 0, "no attempt until two cards are up");
});

test("matching pair keeps the turn and scores", () => {
  const game = newGame({ difficulty: DIFFICULTIES[0], theme: "fruits", playerNames: ["a"], seed: 3 });
  // find a pair by symbol
  const [first, second] = [0, 1].map(() => 0);
  void first;
  void second;
  const pairIds: number[] = [];
  const seen = new Map<string, number>();
  for (const card of game.cards) {
    if (seen.has(card.symbol)) {
      pairIds.push(seen.get(card.symbol) as number, card.id);
      break;
    }
    seen.set(card.symbol, card.id);
  }
  const positions = pairIds.map((id) => game.cards.findIndex((c) => c.id === id));
  flip(game, positions[0] as number);
  const result = flip(game, positions[1] as number);
  assert.equal(result, "matched");
  assert.equal(game.players[0].pairs, 1);
  assert.equal(game.turn, 0, "match keeps the turn");
  assert.equal(game.moves, 1);
  assert.ok(boardLine(game).includes("◆"));
});

test("mismatch passes the turn and flips back", () => {
  const game = newGame({
    difficulty: DIFFICULTIES[0],
    theme: "fruits",
    playerNames: ["p1", "p2"],
    seed: 3,
  });
  // find two cards with different symbols
  let firstPos = 0;
  let secondPos = -1;
  for (let i = 1; i < game.cards.length; i++) {
    if (game.cards[i]?.symbol !== game.cards[firstPos]?.symbol) {
      secondPos = i;
      break;
    }
  }
  flip(game, firstPos);
  const result = flip(game, secondPos as number);
  assert.equal(result, "mismatch");
  assert.equal(game.turn, 1, "turn passes to player 2");
  assert.equal(game.flipped.length, 0, "cards flipped back");
  assert.ok(!game.cards[firstPos]?.matched);
});

test("two-player alternation until a match, then streak", () => {
  const game = newGame({
    difficulty: DIFFICULTIES[0],
    theme: "fruits",
    playerNames: ["p1", "p2"],
    seed: 11,
  });
  const turnLog: number[] = [];
  const seen = new Map<number, string>(); // position -> symbol
  const unknown: number[] = game.cards.map((_, i) => i);
  let guard = 0;
  while (game.phase === "playing" && guard++ < 500) {
    // known complete pair?
    let pair: [number, number] | null = null;
    const bySymbol = new Map<string, number[]>();
    for (const [pos, sym] of seen) {
      if (game.cards[pos]?.matched) continue;
      const list = bySymbol.get(sym) ?? [];
      list.push(pos);
      bySymbol.set(sym, list);
    }
    for (const [, positions] of bySymbol) {
      if (positions.length === 2) {
        pair = positions as [number, number];
        break;
      }
    }
    if (pair) {
      flip(game, pair[0]);
      flip(game, pair[1]);
      for (const pos of pair) seen.delete(pos);
      continue;
    }
    // flip the next unknown card; if its partner is known, flip it too
    const next = unknown.shift();
    if (next === undefined) break;
    const card = game.cards[next] as (typeof game.cards)[number];
    flip(game, next);
    const partnerPos = [...seen.entries()].find(([, sym]) => sym === card.symbol);
    if (partnerPos) {
      flip(game, partnerPos[0]);
      seen.delete(partnerPos[0]);
      seen.delete(next);
    } else {
      seen.set(next, card.symbol);
      // flip another unknown card (mismatch, but we learn two symbols)
      const next2 = unknown.shift();
      if (next2 === undefined) continue;
      const card2 = game.cards[next2] as (typeof game.cards)[number];
      flip(game, next2);
      seen.set(next2, card2.symbol);
    }
    turnLog.push(game.turn);
  }
  assert.equal(game.phase, "won");
  assert.ok(turnLog.length > 0);
  // winner consistency: player with most pairs wins (or -1 draw)
  const best = Math.max(...game.players.map((p) => p.pairs));
  const topCount = game.players.filter((p) => p.pairs === best).length;
  if (topCount === 1) {
    assert.equal(game.winner, game.players.findIndex((p) => p.pairs === best));
  } else {
    assert.equal(game.winner, -1);
  }
});

test("flips are ignored after the game and on matched/duplicate cards", () => {
  const game = newGame({ difficulty: DIFFICULTIES[0], theme: "fruits", playerNames: ["a"], seed: 9 });
  flip(game, 0);
  const again = flip(game, 0);
  assert.equal(again, "ignored", "already face-up card");
  game.phase = "won";
  assert.equal(flip(game, 5), "ignored", "game over");
});

test("all difficulties and themes produce complete decks", () => {
  for (const diff of DIFFICULTIES) {
    for (const theme of Object.keys(THEMES) as (keyof typeof THEMES)[]) {
      const game = newGame({
        difficulty: diff,
        theme,
        playerNames: ["solo"],
        seed: 77,
      });
      assert.equal(game.cards.length, diff.pairs * 2);
      assert.equal(game.totalPairs, diff.pairs);
    }
  }
});

test("shuffled utility is a permutation", () => {
  const items = [1, 2, 3, 4, 5];
  const out = shuffled(items, makeRng(9));
  assert.deepEqual([...out].sort(), items);
  assert.deepEqual(items, [1, 2, 3, 4, 5], "input untouched");
});
