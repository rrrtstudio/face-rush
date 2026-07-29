import { FACE_ORDER } from "./cube.js";

export function findCompletedTargetFace(cube, targetColorName) {
  for (const faceKey of FACE_ORDER) {
    const stickers = cube.getFaceStickers(faceKey);
    const isComplete =
      stickers.length === 9 &&
      stickers.every((sticker) => sticker.colorName === targetColorName);

    if (isComplete) {
      return { faceKey, stickers };
    }
  }

  return null;
}
