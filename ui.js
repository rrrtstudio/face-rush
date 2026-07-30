import { formatTime } from "./timer.js";
import {
  BEST_TIME_STORAGE_KEY,
  MASTER_MESSAGES,
  RANK_THRESHOLDS,
  VIBRATION_SETTINGS,
  WHITE_FIXED_MODE,
} from "./config.js";

const PREVIEW_SHEET_SNAP_DISTANCE = 34;

export function getRank(totalSeconds) {
  return RANK_THRESHOLDS.find((entry) => totalSeconds <= entry.maxSeconds).rank;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readBestTime() {
  try {
    const saved = window.localStorage.getItem(BEST_TIME_STORAGE_KEY);
    const milliseconds = Number(saved);
    return Number.isFinite(milliseconds) && milliseconds > 0 ? milliseconds : null;
  } catch {
    return null;
  }
}

function writeBestTime(milliseconds) {
  try {
    window.localStorage.setItem(BEST_TIME_STORAGE_KEY, String(milliseconds));
  } catch {
    // Best time is a local convenience only; gameplay should continue even if
    // browser storage is unavailable.
  }
}

function randomMasterMessage() {
  return MASTER_MESSAGES[Math.floor(Math.random() * MASTER_MESSAGES.length)];
}

export class GameUI {
  constructor({ totalRounds }) {
    this.totalRounds = totalRounds;
    this.timeDisplay = document.querySelector("#timeDisplay");
    this.clearDisplay = document.querySelector("#clearDisplay");
    this.clearBanner = document.querySelector("#clearBanner");
    this.startOverlay = document.querySelector("#startOverlay");
    this.overlayStartButton = document.querySelector("#overlayStartButton");
    this.resultOverlay = document.querySelector("#resultOverlay");
    this.totalTime = document.querySelector("#totalTime");
    this.bestTime = document.querySelector("#bestTime");
    this.rankDisplay = document.querySelector("#rankDisplay");
    this.recordDisplay = document.querySelector("#recordDisplay");
    this.masterMessage = document.querySelector("#masterMessage");
    this.targetChip = document.querySelector("#targetChip");
    this.targetColorLabel = document.querySelector("#targetColorLabel");
    this.whiteFixedToggle = document.querySelector("#whiteFixedToggle");
    this.previewToggle = document.querySelector("#previewToggle");
    this.vibrationToggle = document.querySelector("#vibrationToggle");
    this.subViewGrid = document.querySelector("#subViewGrid");
    this.previewSheetHandle = document.querySelector("#previewSheetHandle");
    this.gameStage = document.querySelector(".game-stage");
    this.startButton = document.querySelector("#startButton");
    this.resetButton = document.querySelector("#resetButton");
    this.previewSheetExpanded = false;
    this.previewSheetDrag = null;
    this.ignorePreviewSheetClick = false;
    this.onPreviewLayoutChange = () => {};

    this.whiteFixedToggle.checked = WHITE_FIXED_MODE.defaultEnabled;
    this.previewToggle.checked = false;
    this.vibrationToggle.checked = VIBRATION_SETTINGS.defaultEnabled;
    this.bindPreviewSheetHandle();
    this.setPreviewVisible(false);
  }

  bindActions({ onStart, onReset, onPreviewChange = () => {}, onVibrationChange = () => {} }) {
    this.onPreviewLayoutChange = onPreviewChange;
    this.startButton.addEventListener("click", onStart);
    this.overlayStartButton.addEventListener("click", onStart);
    this.resetButton.addEventListener("click", onReset);
    this.previewToggle.addEventListener("change", () => {
      const visible = this.previewToggle.checked;
      this.setPreviewVisible(visible);
      onPreviewChange(visible);
    });
    this.vibrationToggle.addEventListener("change", () => {
      onVibrationChange(this.vibrationToggle.checked);
    });
  }

  setReady() {
    this.setTime(0);
    this.setClearCount(0);
    this.hideClear();
    this.hideResult();
    this.showStartOverlay();
    this.startButton.disabled = false;
    this.startButton.textContent = "START";
  }

  setRunning() {
    this.hideResult();
    this.hideClear();
    this.hideStartOverlay();
    this.startButton.disabled = true;
    this.startButton.textContent = "START";
  }

  setTime(milliseconds) {
    this.timeDisplay.textContent = formatTime(milliseconds);
  }

  setClearCount(count) {
    this.clearDisplay.textContent = `${count} / ${this.totalRounds}`;
  }

  setTargetColor(colorName, colorDefinition) {
    const label = colorDefinition.label;
    const hex = `#${colorDefinition.hex.toString(16).padStart(6, "0")}`;

    this.targetColorLabel.textContent = label;
    this.targetChip.style.backgroundColor = hex;
    this.targetChip.style.boxShadow =
      colorName === "white" ? "0 0 18px rgba(255, 255, 255, 0.32)" : `0 0 18px ${hex}66`;
  }

  isWhiteFixed() {
    return this.whiteFixedToggle.checked;
  }

  isPreviewVisible() {
    return this.previewToggle.checked;
  }

  isVibrationEnabled() {
    return this.vibrationToggle.checked;
  }

  setPreviewVisible(visible) {
    this.subViewGrid.hidden = !visible;
    this.gameStage.classList.toggle("previews-hidden", !visible);
    this.gameStage.classList.toggle("preview-sheet-enabled", visible);

    this.subViewGrid.style.transform = "";
    this.previewSheetDrag = null;
    this.gameStage.classList.remove("preview-sheet-dragging");
    this.setPreviewSheetExpanded(false, { notify: false });
  }

  bindPreviewSheetHandle() {
    this.previewSheetHandle.addEventListener("click", (event) => {
      event.preventDefault();

      if (this.ignorePreviewSheetClick || !this.isPreviewVisible()) {
        this.ignorePreviewSheetClick = false;
        return;
      }

      this.setPreviewSheetExpanded(!this.previewSheetExpanded);
    });

    this.previewSheetHandle.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!this.isPreviewVisible()) return;

      event.preventDefault();
      event.stopPropagation();

      const metrics = this.getPreviewSheetMetrics();
      this.previewSheetDrag = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startOffset: this.previewSheetExpanded ? 0 : metrics.maxOffset,
        currentOffset: this.previewSheetExpanded ? 0 : metrics.maxOffset,
        maxOffset: metrics.maxOffset,
        moved: false,
      };

      this.gameStage.classList.add("preview-sheet-dragging");
      this.previewSheetHandle.setPointerCapture(event.pointerId);
    });

    this.previewSheetHandle.addEventListener("pointermove", (event) => {
      const drag = this.previewSheetDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;

      event.preventDefault();
      event.stopPropagation();

      const deltaY = event.clientY - drag.startY;
      drag.moved ||= Math.abs(deltaY) > 3;
      drag.currentOffset = clamp(drag.startOffset + deltaY, 0, drag.maxOffset);
      this.subViewGrid.style.transform = `translateY(${drag.currentOffset}px)`;
    });

    this.previewSheetHandle.addEventListener("pointerup", (event) => {
      this.finishPreviewSheetDrag(event);
    });

    this.previewSheetHandle.addEventListener("pointercancel", (event) => {
      this.finishPreviewSheetDrag(event);
    });
  }

  getPreviewSheetMetrics() {
    const panelHeight = this.subViewGrid.getBoundingClientRect().height;
    const handleHeight = this.previewSheetHandle.getBoundingClientRect().height || 36;
    return {
      maxOffset: Math.max(0, panelHeight - handleHeight),
    };
  }

  finishPreviewSheetDrag(event) {
    const drag = this.previewSheetDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    if (this.previewSheetHandle.hasPointerCapture(event.pointerId)) {
      this.previewSheetHandle.releasePointerCapture(event.pointerId);
    }

    const deltaY = event.clientY - drag.startY;
    const passedSnapDistance = Math.abs(deltaY) >= PREVIEW_SHEET_SNAP_DISTANCE;
    const shouldExpand = passedSnapDistance
      ? deltaY < 0
      : drag.currentOffset < drag.maxOffset * 0.55;

    this.subViewGrid.style.transform = "";
    this.previewSheetDrag = null;
    this.gameStage.classList.remove("preview-sheet-dragging");
    this.setPreviewSheetExpanded(shouldExpand);

    if (drag.moved) {
      this.ignorePreviewSheetClick = true;
      window.setTimeout(() => {
        this.ignorePreviewSheetClick = false;
      }, 180);
    }
  }

  setPreviewSheetExpanded(expanded, { notify = true } = {}) {
    this.previewSheetExpanded = Boolean(expanded);
    this.gameStage.classList.toggle("preview-sheet-expanded", this.previewSheetExpanded);
    this.previewSheetHandle.setAttribute("aria-expanded", String(this.previewSheetExpanded));
    this.previewSheetHandle.setAttribute(
      "aria-label",
      this.previewSheetExpanded ? "Collapse cube preview" : "Expand cube preview"
    );

    if (notify && this.isPreviewVisible()) {
      this.onPreviewLayoutChange(true);
    }
  }

  showClear(count) {
    this.clearBanner.textContent = `${count} / ${this.totalRounds} CLEAR!`;
    this.clearBanner.hidden = false;
  }

  hideClear() {
    this.clearBanner.hidden = true;
  }

  showResult(milliseconds) {
    const totalSeconds = milliseconds / 1000;
    const rank = getRank(totalSeconds);
    const previousBest = readBestTime();
    const isNewRecord = !previousBest || milliseconds < previousBest;
    const bestMilliseconds = isNewRecord ? milliseconds : previousBest;

    if (isNewRecord) {
      writeBestTime(milliseconds);
    }

    this.totalTime.textContent = formatTime(milliseconds);
    this.bestTime.textContent = formatTime(bestMilliseconds);
    this.rankDisplay.textContent = rank;
    this.recordDisplay.hidden = !isNewRecord;
    this.masterMessage.textContent = rank === "MASTER" ? randomMasterMessage() : "";
    this.masterMessage.hidden = rank !== "MASTER";
    this.hideStartOverlay();
    this.resultOverlay.hidden = false;
    this.startButton.disabled = false;
    this.startButton.textContent = "TRY AGAIN";
  }

  hideResult() {
    this.resultOverlay.hidden = true;
    this.recordDisplay.hidden = true;
    this.masterMessage.hidden = true;
  }

  showStartOverlay() {
    this.startOverlay.hidden = false;
    this.overlayStartButton.disabled = false;
  }

  hideStartOverlay() {
    this.startOverlay.hidden = true;
    this.overlayStartButton.disabled = true;
  }
}
