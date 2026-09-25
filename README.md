# memory-match

Unicode memory-match game — emoji themes, difficulty levels, hot-seat
two-player mode. Single-file offline HTML, zero npm dependencies
(build uses Node's native TypeScript stripping).

```text
$ npm test          # 9 core tests (Node)
$ npm run build     # -> dist/index.html (~10 KB)
```

## Features

- **Themes** — fruits 🍎🍌, space 🚀🌙, animals 🐶🦊, playing cards
  (unicode glyphs, no asset files).
- **Difficulties** — easy 6 pairs, medium 8, hard 10.
- **Two-player hot seat** — matches keep the turn, mismatches pass it;
  the scoreboard shows whose move it is and declares the winner (or a
  fair draw when pairs are split).
- **Deterministic seeds** in the core (`makeRng` xorshift), so tests
  replay exact shuffles.

## Development

```console
$ npm test
$ npm run build
```

## License

MIT — see [LICENSE](LICENSE).
