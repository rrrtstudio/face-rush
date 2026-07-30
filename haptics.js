import { VIBRATION_SETTINGS } from "./config.js";

export class Haptics {
  constructor({ enabled = VIBRATION_SETTINGS.defaultEnabled } = {}) {
    this.enabled = enabled;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);

    if (!this.enabled) {
      this.cancel();
    }
  }

  pulse(type) {
    if (!this.canVibrate()) return;

    const duration = VIBRATION_SETTINGS.durationsMs[type];
    if (!duration) return;

    try {
      navigator.vibrate(duration);
    } catch {
      // Some browsers expose the API but still reject vibration requests.
    }
  }

  cancel() {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;

    try {
      navigator.vibrate(0);
    } catch {
      // Cancelling haptics should never affect gameplay.
    }
  }

  canVibrate() {
    if (!this.enabled) return false;
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;

    if (VIBRATION_SETTINGS.mobileOnly) {
      const mediaQuery = VIBRATION_SETTINGS.mobileMediaQuery;
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
      if (!window.matchMedia(mediaQuery).matches) return false;
    }

    return true;
  }
}
