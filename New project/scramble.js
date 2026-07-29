const AXES = ["x", "y", "z"];
const LAYERS = [-1, 0, 1];
const DIRECTIONS = [-1, 1];

export const SCRAMBLE_CONFIG = {
  minMoves: 20,
  maxMoves: 30,
};

function randomItem(items, random) {
  return items[Math.floor(random() * items.length)];
}

export function createScramble(config = {}, random = Math.random) {
  const minMoves = config.minMoves ?? SCRAMBLE_CONFIG.minMoves;
  const maxMoves = config.maxMoves ?? SCRAMBLE_CONFIG.maxMoves;
  const length = minMoves + Math.floor(random() * (maxMoves - minMoves + 1));
  const moves = [];

  while (moves.length < length) {
    const move = {
      axis: randomItem(AXES, random),
      layer: randomItem(LAYERS, random),
      direction: randomItem(DIRECTIONS, random),
    };

    const previous = moves[moves.length - 1];
    const repeatsSameSlice =
      previous && previous.axis === move.axis && previous.layer === move.layer;

    if (repeatsSameSlice) continue;
    moves.push(move);
  }

  return moves;
}

export function applyScramble(cube, moves) {
  for (const move of moves) {
    cube.applyMoveInstant(move);
  }
}

export function moveToNotation({ axis, layer, direction }) {
  const layerLabel = layer === 0 ? "M" : layer > 0 ? "+" : "-";
  return `${axis.toUpperCase()}${layerLabel}${direction < 0 ? "'" : ""}`;
}
