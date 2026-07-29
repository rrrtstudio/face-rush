import { formatTime } from "./timer.js";
import {
  BEST_TIME_STORAGE_KEY,
  MASTER_MESSAGES,
  RANK_THRESHOLDS,
  WHITE_FIXED_MODE,
} from "./config.js";

export function getRank(totalSeconds) {
  return RANK_THRESHOLDS.find((entry) => totalSeconds <= entry.maxSeconds).rank;
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
    this.resultOverlay = document.querySelector("#resultOverlay");
    this.totalTime = document.querySelector("#totalTime");
    this.bestTime = document.querySelector("#bestTime");
    this.rankDisplay = document.querySelector("#rankDisplay");
    this.recordDisplay = document.querySelector("#recordDisplay");
    this.masterMessage = document.querySelector("#masterMessage");
    this.targetChip = document.querySelector("#targetChip");
    this.targetColorLabel = document.querySelector("#targetColorLabel");
    this.whiteFixedToggle = document.querySelector("#whiteFixedToggle");
    this.startButton = document.querySelector("#startButton");
    this.resetButton = document.querySelector("#resetButton");

    this.whiteFixedToggle.checked = WHITE_FIXED_MODE.defaultEnabled;
  }

  bindActions({ onStart, onReset }) {
    this.startButton.addEventListener("click", onStart);
    this.resetButton.addEventListener("click", onReset);
  }

  setReady() {
    this.setTime(0);
    this.setClearCount(0);
    this.hideClear();
    this.hideResult();
    this.startButton.disabled = false;
    this.startButton.textContent = "START";
  }

  setRunning() {
    this.hideResult();
    this.hideClear();
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
    this.resultOverlay.hidden = false;
    this.startButton.disabled = false;
    this.startButton.textContent = "TRY AGAIN";
  }

  hideResult() {
    this.resultOverlay.hidden = true;
    this.recordDisplay.hidden = true;
    this.masterMessage.hidden = true;
  }
}
