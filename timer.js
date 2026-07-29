export function formatTime(milliseconds) {
  const totalSeconds = milliseconds / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const centiseconds = Math.floor((milliseconds % 1000) / 10);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(
    centiseconds
  ).padStart(2, "0")}`;
}

export class GameTimer {
  constructor() {
    this.reset();
  }

  start() {
    this.startTime = performance.now();
    this.elapsedBeforeStart = 0;
    this.running = true;
  }

  stop() {
    if (!this.running) return this.elapsedBeforeStart;

    this.elapsedBeforeStart = this.getElapsed();
    this.running = false;
    return this.elapsedBeforeStart;
  }

  reset() {
    this.startTime = 0;
    this.elapsedBeforeStart = 0;
    this.running = false;
  }

  getElapsed() {
    if (!this.running) return this.elapsedBeforeStart;
    return this.elapsedBeforeStart + performance.now() - this.startTime;
  }
}
