import * as THREE from "three";
import { AXIS_VECTORS, TURN_DURATION_MS } from "./cube.js";

const DRAG_THRESHOLD_PX = 14;
const TOUCH_DRAG_THRESHOLD_PX = 11;
const TRACKBALL_SPEED = 0.0085;
const AXIS_NAMES = ["x", "y", "z"];

function eventPoint(event) {
  return new THREE.Vector2(event.clientX, event.clientY);
}

function dominantAxis(vector) {
  let bestAxis = "x";
  let bestValue = Math.abs(vector.x);

  for (const axis of ["y", "z"]) {
    const value = Math.abs(vector[axis]);
    if (value > bestValue) {
      bestValue = value;
      bestAxis = axis;
    }
  }

  return bestAxis;
}

function roundedCardinal(vector) {
  const axis = dominantAxis(vector);
  const result = new THREE.Vector3();
  result[axis] = Math.sign(vector[axis]) || 1;
  return result;
}

function stopPointerEvent(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

export class CubeControls {
  constructor({
    camera,
    canvas,
    cube,
    inputEnabled = () => true,
    onOrientationChangeComplete = () => {},
  }) {
    this.camera = camera;
    this.canvas = canvas;
    this.cube = cube;
    this.inputEnabled = inputEnabled;
    this.onOrientationChangeComplete = onOrientationChangeComplete;
    this.gesture = null;
    this.locked = null;
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.cameraRight = new THREE.Vector3();
    this.cameraUp = new THREE.Vector3();
    this.worldAxis = new THREE.Vector3();
    this.quaternionX = new THREE.Quaternion();
    this.quaternionY = new THREE.Quaternion();

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);

    canvas.addEventListener("pointerdown", this.onPointerDown, true);
    canvas.addEventListener("pointermove", this.onPointerMove, true);
    canvas.addEventListener("pointerup", this.onPointerUp, true);
    canvas.addEventListener("pointercancel", this.onPointerUp, true);
    canvas.addEventListener("contextmenu", this.onContextMenu);
  }

  update() {
    const nextLocked = !this.inputEnabled() || this.cube.isAnimating;
    if (nextLocked === this.locked) return;

    this.locked = nextLocked;
    this.canvas.classList.toggle("is-input-disabled", nextLocked);
    this.canvas.setAttribute("aria-disabled", String(nextLocked));
  }

  canStartGesture() {
    return this.inputEnabled() && !this.cube.isAnimating;
  }

  canTurnLayer() {
    return this.inputEnabled() && !this.cube.isAnimating;
  }

  onContextMenu(event) {
    event.preventDefault();
  }

  onPointerDown(event) {
    if (!this.canStartGesture() || event.button !== 0) return;

    const start = eventPoint(event);
    const blockHit = this.findBlockHit(event);
    this.canvas.setPointerCapture?.(event.pointerId);

    this.gesture = blockHit
      ? {
          kind: "layer",
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          start,
          hit: blockHit,
          moveStarted: false,
        }
      : {
          kind: "orientation",
          pointerId: event.pointerId,
          previous: start,
          orientationChanged: false,
        };

    stopPointerEvent(event);
  }

  onPointerMove(event) {
    if (!this.isActivePointer(event)) return;

    if (this.gesture.kind === "layer") {
      this.tryStartLayerTurn(eventPoint(event));
    } else {
      this.rotateWholeCube(eventPoint(event));
    }

    stopPointerEvent(event);
  }

  onPointerUp(event) {
    if (!this.isActivePointer(event)) return;

    if (this.gesture.kind === "layer") {
      this.tryStartLayerTurn(eventPoint(event));
    } else if (this.gesture.orientationChanged) {
      this.onOrientationChangeComplete();
    }

    this.finishGesture(event);
    stopPointerEvent(event);
  }

  isActivePointer(event) {
    return this.gesture?.pointerId === event.pointerId;
  }

  findBlockHit(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hits = this.raycaster.intersectObject(this.cube.group, true);
    for (const hit of hits) {
      const cubie = hit.object.userData.cubie;
      if (!cubie) continue;

      const localNormal = this.getHitLocalNormal(hit);
      if (!localNormal) continue;

      return {
        cubie,
        point: hit.point.clone(),
        faceNormal: roundedCardinal(
          localNormal.clone().applyQuaternion(cubie.group.quaternion)
        ),
      };
    }

    return null;
  }

  getHitLocalNormal(hit) {
    if (hit.object.userData.localNormal) {
      return hit.object.userData.localNormal.clone();
    }

    return hit.face?.normal?.clone() ?? null;
  }

  tryStartLayerTurn(current) {
    if (!this.gesture || this.gesture.moveStarted || !this.canTurnLayer()) return;

    const delta = current.clone().sub(this.gesture.start);
    const threshold =
      this.gesture.pointerType === "touch" ? TOUCH_DRAG_THRESHOLD_PX : DRAG_THRESHOLD_PX;

    if (delta.length() < threshold) return;

    const move = this.buildLayerMove(this.gesture.hit, delta, threshold);
    if (!move) return;

    const started = this.cube.rotateLayer(move.axis, move.layer, move.direction, {
      duration: TURN_DURATION_MS,
      source: "player",
    });

    this.gesture.moveStarted = started;
  }

  buildLayerMove(hit, delta, threshold) {
    const tangentAxes = AXIS_NAMES.filter(
      (axis) => Math.abs(hit.faceNormal.dot(AXIS_VECTORS[axis])) < 0.5
    );

    let best = null;
    for (const axis of tangentAxes) {
      const screenDirection = this.projectLocalAxisToScreen(hit.point, AXIS_VECTORS[axis]);
      const dot = delta.dot(screenDirection);

      if (!best || Math.abs(dot) > Math.abs(best.dot)) {
        best = { axis, dot };
      }
    }

    if (!best || Math.abs(best.dot) < threshold * 0.42) return null;

    const tangent = AXIS_VECTORS[best.axis];
    const rotationVector = new THREE.Vector3().crossVectors(hit.faceNormal, tangent);
    const rotationAxis = dominantAxis(rotationVector);
    const rotationSign = Math.sign(rotationVector[rotationAxis]) || 1;
    const dragSign = best.dot >= 0 ? 1 : -1;

    return {
      axis: rotationAxis,
      layer: hit.cubie.position[rotationAxis],
      direction: dragSign * rotationSign,
    };
  }

  projectLocalAxisToScreen(origin, localAxis) {
    const rect = this.canvas.getBoundingClientRect();
    const worldAxis = this.worldAxis.copy(localAxis).applyQuaternion(this.cube.group.quaternion);
    const a = origin.clone().project(this.camera);
    const b = origin.clone().add(worldAxis).project(this.camera);
    const direction = new THREE.Vector2(
      ((b.x - a.x) * rect.width) / 2,
      (-(b.y - a.y) * rect.height) / 2
    );

    return direction.lengthSq() > 0.0001 ? direction.normalize() : direction;
  }

  rotateWholeCube(current) {
    const delta = current.clone().sub(this.gesture.previous);
    if (delta.lengthSq() <= 0.01) return;

    this.cameraRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion).normalize();
    this.cameraUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion).normalize();

    this.quaternionX.setFromAxisAngle(this.cameraUp, delta.x * TRACKBALL_SPEED);
    this.quaternionY.setFromAxisAngle(this.cameraRight, delta.y * TRACKBALL_SPEED);

    this.cube.group.quaternion
      .premultiply(this.quaternionX)
      .premultiply(this.quaternionY)
      .normalize();
    this.cube.group.updateMatrixWorld(true);

    this.gesture.previous = current;
    this.gesture.orientationChanged = true;
  }

  finishGesture(event) {
    this.canvas.releasePointerCapture?.(event.pointerId);
    this.gesture = null;
  }

  dispose() {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown, true);
    this.canvas.removeEventListener("pointermove", this.onPointerMove, true);
    this.canvas.removeEventListener("pointerup", this.onPointerUp, true);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp, true);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
  }
}
