// Gameplay knobs collected here so playtest tuning does not require touching
// the game loop or UI wiring.
export const TARGET_COLOR_NAMES = ["white", "yellow", "red", "orange", "green", "blue"];

export const WHITE_FIXED_MODE = {
  defaultEnabled: false,
  colorName: "white",
};

export const RANK_THRESHOLDS = [
  { rank: "MASTER", maxSeconds: 5 * 60 },
  { rank: "S", maxSeconds: 10 * 60 },
  { rank: "A", maxSeconds: 15 * 60 },
  { rank: "B", maxSeconds: 20 * 60 },
  { rank: "C", maxSeconds: 30 * 60 },
  { rank: "D", maxSeconds: Infinity },
];

export const MASTER_MESSAGES = [
  "You mastered Face Rush.",
  "Nothing can stop you now.",
  "The cube obeys you.",
  "Beyond S Rank.",
  "Legendary Performance!",
];

export const BEST_TIME_STORAGE_KEY = "faceRush.bestTimeMs";

export function chooseTargetColor({ fixedWhite, random = Math.random } = {}) {
  if (fixedWhite) return WHITE_FIXED_MODE.colorName;

  return TARGET_COLOR_NAMES[Math.floor(random() * TARGET_COLOR_NAMES.length)];
}
