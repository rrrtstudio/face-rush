import * as THREE from "three";

export const CUBE_SIZE = 3;
export const TARGET_ROUNDS = 3;
export const TURN_DURATION_MS = 200;

export const COLOR_DEFINITIONS = {
  white: { label: "WHITE", hex: 0xf7f7ef },
  yellow: { label: "YELLOW", hex: 0xffd94a },
  green: { label: "GREEN", hex: 0x19bf7a },
  blue: { label: "BLUE", hex: 0x2f69ff },
  red: { label: "RED", hex: 0xf04d58 },
  orange: { label: "ORANGE", hex: 0xff8a2a },
};

export const FACE_DEFINITIONS = {
  up: {
    key: "up",
    axis: "y",
    sign: 1,
    colorName: "white",
    normal: new THREE.Vector3(0, 1, 0),
  },
  down: {
    key: "down",
    axis: "y",
    sign: -1,
    colorName: "yellow",
    normal: new THREE.Vector3(0, -1, 0),
  },
  front: {
    key: "front",
    axis: "z",
    sign: 1,
    colorName: "green",
    normal: new THREE.Vector3(0, 0, 1),
  },
  back: {
    key: "back",
    axis: "z",
    sign: -1,
    colorName: "blue",
    normal: new THREE.Vector3(0, 0, -1),
  },
  right: {
    key: "right",
    axis: "x",
    sign: 1,
    colorName: "red",
    normal: new THREE.Vector3(1, 0, 0),
  },
  left: {
    key: "left",
    axis: "x",
    sign: -1,
    colorName: "orange",
    normal: new THREE.Vector3(-1, 0, 0),
  },
};

export const FACE_ORDER = ["up", "down", "front", "back", "right", "left"];

export const AXIS_VECTORS = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

const HALF_STEPS = [-1, 0, 1];
const CUBIE_SIZE = 0.98;
const STICKER_SIZE = 0.78;
const STICKER_OFFSET = CUBIE_SIZE / 2 + 0.006;
const EPSILON = 0.001;

const basePlaneNormal = new THREE.Vector3(0, 0, 1);

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function roundToGrid(value) {
  return Math.round(value);
}

function vectorFromGrid(position) {
  return new THREE.Vector3(position.x, position.y, position.z);
}

function rotateGridPosition(position, axis, direction) {
  const rotated = vectorFromGrid(position).applyAxisAngle(
    AXIS_VECTORS[axis],
    direction * Math.PI * 0.5
  );

  return new THREE.Vector3(
    roundToGrid(rotated.x),
    roundToGrid(rotated.y),
    roundToGrid(rotated.z)
  );
}

function createBodyMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x111411,
    roughness: 0.6,
    metalness: 0.08,
  });
}

function createStickerMaterial(colorName) {
  return new THREE.MeshStandardMaterial({
    color: COLOR_DEFINITIONS[colorName].hex,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.36,
    metalness: 0.04,
  });
}

export class RubiksCube {
  constructor({ onMoveStart, onMoveComplete } = {}) {
    this.group = new THREE.Group();
    this.group.name = "FaceRushCube";
    this.spacing = 1.08;
    this.cubies = [];
    this.stickerMeshes = [];
    this.bodyGeometry = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);
    this.stickerGeometry = new THREE.PlaneGeometry(STICKER_SIZE, STICKER_SIZE);
    this.bodyMaterial = createBodyMaterial();
    this.activeMove = null;
    this.onMoveStart = onMoveStart;
    this.onMoveComplete = onMoveComplete;

    this.resetSolved();
  }

  get isAnimating() {
    return Boolean(this.activeMove);
  }

  resetSolved() {
    this.activeMove = null;
    this.cubies.length = 0;
    this.stickerMeshes.length = 0;
    this.group.clear();

    for (const x of HALF_STEPS) {
      for (const y of HALF_STEPS) {
        for (const z of HALF_STEPS) {
          this.cubies.push(this.createCubie(new THREE.Vector3(x, y, z)));
        }
      }
    }
  }

  createCubie(position) {
    const cubie = {
      position: position.clone(),
      group: new THREE.Group(),
      stickers: [],
    };

    cubie.group.name = `cubie-${position.x}-${position.y}-${position.z}`;
    cubie.group.position.copy(position).multiplyScalar(this.spacing);
    cubie.group.userData.cubie = cubie;

    const body = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData.cubie = cubie;
    cubie.group.add(body);

    for (const faceKey of FACE_ORDER) {
      const face = FACE_DEFINITIONS[faceKey];
      if (position[face.axis] !== face.sign) continue;

      const sticker = this.createSticker(face, cubie);
      cubie.stickers.push(sticker);
      cubie.group.add(sticker.mesh);
      this.stickerMeshes.push(sticker.mesh);
    }

    this.group.add(cubie.group);
    return cubie;
  }

  createSticker(face, cubie) {
    const mesh = new THREE.Mesh(
      this.stickerGeometry,
      createStickerMaterial(face.colorName)
    );

    mesh.name = `sticker-${face.key}`;
    mesh.position.copy(face.normal).multiplyScalar(STICKER_OFFSET);
    mesh.quaternion.setFromUnitVectors(basePlaneNormal, face.normal);
    mesh.userData.sticker = true;
    mesh.userData.colorName = face.colorName;
    mesh.userData.solvedFace = face.key;
    mesh.userData.localNormal = face.normal.clone();
    mesh.userData.cubie = cubie;
    mesh.renderOrder = 1;

    return {
      mesh,
      colorName: face.colorName,
      solvedFace: face.key,
      localNormal: face.normal.clone(),
    };
  }

  getInteractiveObjects() {
    return this.stickerMeshes;
  }

  getLayerCubies(axis, layer) {
    return this.cubies.filter((cubie) => cubie.position[axis] === layer);
  }

  rotateLayer(axis, layer, direction, options = {}) {
    if (this.activeMove) return false;

    const selected = this.getLayerCubies(axis, layer);
    if (selected.length === 0) return false;

    const pivot = new THREE.Group();
    pivot.name = `turn-${axis}${layer}`;
    this.group.add(pivot);

    for (const cubie of selected) {
      pivot.attach(cubie.group);
    }

    this.activeMove = {
      axis,
      layer,
      direction: Math.sign(direction) || 1,
      duration: options.duration ?? TURN_DURATION_MS,
      elapsed: 0,
      pivot,
      selected,
      previousAngle: 0,
      targetAngle: (Math.sign(direction) || 1) * Math.PI * 0.5,
      source: options.source ?? "player",
    };

    if (this.activeMove.source === "player") {
      this.onMoveStart?.({
        axis: this.activeMove.axis,
        layer: this.activeMove.layer,
        direction: this.activeMove.direction,
      });
    }

    return true;
  }

  applyMoveInstant({ axis, layer, direction }) {
    if (this.activeMove) return false;

    const selected = this.getLayerCubies(axis, layer);
    const angle = Math.sign(direction) * Math.PI * 0.5;
    const rotation = new THREE.Quaternion().setFromAxisAngle(AXIS_VECTORS[axis], angle);

    for (const cubie of selected) {
      cubie.position = rotateGridPosition(cubie.position, axis, Math.sign(direction));
      cubie.group.position.applyQuaternion(rotation);
      cubie.group.quaternion.premultiply(rotation).normalize();
      this.snapCubie(cubie);
    }

    return true;
  }

  update(deltaMs) {
    if (!this.activeMove) return;

    const move = this.activeMove;
    move.elapsed += deltaMs;

    const progress = Math.min(1, move.elapsed / move.duration);
    const angle = move.targetAngle * easeOutCubic(progress);
    move.pivot.rotation[move.axis] = angle;

    if (progress >= 1 - EPSILON) {
      this.finishActiveMove();
    }
  }

  finishActiveMove() {
    const move = this.activeMove;
    if (!move) return;

    move.pivot.rotation[move.axis] = move.targetAngle;
    move.pivot.updateMatrixWorld(true);

    for (const cubie of move.selected) {
      this.group.attach(cubie.group);
      cubie.position = rotateGridPosition(cubie.position, move.axis, move.direction);
      this.snapCubie(cubie);
    }

    this.group.remove(move.pivot);
    this.activeMove = null;

    if (move.source === "player") {
      this.onMoveComplete?.({
        axis: move.axis,
        layer: move.layer,
        direction: move.direction,
      });
    }
  }

  snapCubie(cubie) {
    cubie.group.position
      .set(cubie.position.x, cubie.position.y, cubie.position.z)
      .multiplyScalar(this.spacing);
    cubie.group.quaternion.normalize();
    cubie.group.updateMatrixWorld(true);
  }

  getFaceStickers(faceKey) {
    const face = FACE_DEFINITIONS[faceKey];
    const stickers = [];

    for (const cubie of this.cubies) {
      if (cubie.position[face.axis] !== face.sign) continue;

      for (const sticker of cubie.stickers) {
        const normal = sticker.localNormal.clone().applyQuaternion(cubie.group.quaternion);

        if (normal.dot(face.normal) > 0.98) {
          stickers.push({
            mesh: sticker.mesh,
            cubie,
            colorName: sticker.colorName,
            faceKey,
          });
        }
      }
    }

    return stickers;
  }

  getFaceCenter(faceKey) {
    const face = FACE_DEFINITIONS[faceKey];
    return face.normal.clone().multiplyScalar(this.spacing * 1.7);
  }

  dispose() {
    this.bodyGeometry.dispose();
    this.stickerGeometry.dispose();
    this.bodyMaterial.dispose();

    for (const mesh of this.stickerMeshes) {
      mesh.material.dispose();
    }
  }
}
