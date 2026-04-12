// Generates notification sounds using the Web Audio API — no external files needed.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Short "ding" for new messages */
export function playMessageSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio not available
  }
}

/** Repeating ringtone for incoming calls — returns a stop function */
export function playRingtone(): () => void {
  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function ring() {
    if (stopped) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Two-tone ring pattern (like a phone)
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = "sine";
        const t = now + i * 0.25;
        osc.frequency.setValueAtTime(740, t);
        osc.frequency.setValueAtTime(587, t + 0.1);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
        gain.gain.setValueAtTime(0.2, t + 0.1);
        gain.gain.linearRampToValueAtTime(0, t + 0.2);

        osc.start(t);
        osc.stop(t + 0.22);
      }
    } catch {
      // Audio not available
    }

    // Repeat every 2 seconds
    timeoutId = setTimeout(ring, 2000);
  }

  ring();

  return () => {
    stopped = true;
    if (timeoutId) clearTimeout(timeoutId);
  };
}

/** Browser push notification for background tabs */
export function showBrowserNotification(title: string, body: string, tag?: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    // Try requesting
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
    return;
  }

  try {
    const n = new Notification(title, {
      body,
      tag: tag || "studyhub-notification",
      icon: "/placeholder.svg",
      requireInteraction: tag?.includes("call"),
    });

    // Auto-close after 5s for messages
    if (!tag?.includes("call")) {
      setTimeout(() => n.close(), 5000);
    }
  } catch {
    // Notifications not supported
  }
}
