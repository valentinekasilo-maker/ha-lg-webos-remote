const tv = require('./lgtv');

/**
 * Intelligent AI Assistant for LG webOS Smart TVs
 * Translates natural language prompts & voice requests into automated TV commands.
 */
class AIAssistant {
  constructor() {
    this.knownApps = {
      'youtube': 'youtube.leanback.v4',
      'netflix': 'netflix',
      'spotify': 'spotify-beehive',
      'prime': 'amazon',
      'amazon': 'amazon',
      'prime video': 'amazon',
      'browser': 'com.webos.app.browser',
      'web browser': 'com.webos.app.browser',
      'internet': 'com.webos.app.browser',
      'live tv': 'com.webos.app.livetv',
      'tv': 'com.webos.app.livetv',
      'gallery': 'com.webos.app.igallery',
      'store': 'com.webos.app.discovery',
      'content store': 'com.webos.app.discovery',
      'camera': 'com.webos.app.camera',
      'settings': 'com.palm.app.settings',
      'home': 'com.webos.app.home'
    };
  }

  /**
   * Split composite prompt into individual sub-intent clauses
   */
  splitClauses(prompt) {
    const raw = String(prompt || '').trim();
    if (!raw) return [];

    // Split on " and then ", " then ", " and ", " & ", " ; ", " , "
    const parts = raw.split(/\s+(?:and\s+then|then|and|&)\s+|[;,]+/i);
    return parts.map((p) => p.trim()).filter(Boolean);
  }

  /**
   * Parse and execute a natural language prompt
   */
  async processCommand(prompt) {
    const clean = String(prompt || '').trim();
    if (!clean) {
      return {
        success: false,
        prompt: clean,
        reply: "I didn't catch that. Try saying 'Set volume to 20' or 'Open YouTube'.",
        steps: []
      };
    }

    const clauses = this.splitClauses(clean);
    const steps = [];
    const executionLogs = [];

    // Check for special presets first
    const lower = clean.toLowerCase();
    if (lower.includes('bedtime') || lower.includes('sleep mode') || lower.includes('night mode')) {
      return this.executeBedtimeMode();
    }
    if (lower.includes('cinema mode') || lower.includes('movie mode')) {
      return this.executeCinemaMode();
    }
    if (lower.includes('gaming mode') || lower.includes('game mode')) {
      return this.executeGameMode();
    }

    for (const clause of clauses) {
      const stepResult = await this.executeSingleClause(clause);
      steps.push(stepResult);
      if (stepResult.detail) executionLogs.push(stepResult.detail);
      // Small pause between multiple actions
      await new Promise((r) => setTimeout(r, 400));
    }

    const allSuccessful = steps.every((s) => s.success);
    const reply = executionLogs.length > 0 
      ? `✨ ${executionLogs.join(', ')}` 
      : `Done! Processed ${steps.length} action(s).`;

    return {
      success: allSuccessful,
      prompt: clean,
      reply,
      steps
    };
  }

  /**
   * Execute single clause
   */
  async executeSingleClause(clause) {
    const text = clause.toLowerCase().trim();

    // 1. YouTube with Query/Video Search (e.g. "play interstellar on youtube", "search 4k oled demo on youtube", "open youtube lofi")
    if (text.includes('youtube') && (text.includes('play') || text.includes('search') || text.includes('watch') || text.includes('open') || text.includes('find'))) {
      let query = text
        .replace(/^(?:please\s+)?(?:open\s+youtube\s+and\s+)?(?:play|search|watch|find)\s+/i, '')
        .replace(/\s+on\s+youtube$/i, '')
        .replace(/^youtube\s+/i, '')
        .trim();
      
      if (!query || query === 'youtube') query = '';
      try {
        await tv.openYoutube(query);
        return {
          action: 'youtube',
          detail: query ? `Playing "${query}" on YouTube` : 'Opened YouTube',
          success: true
        };
      } catch (e) {
        return { action: 'youtube', detail: `Failed YouTube: ${e.message}`, success: false };
      }
    }

    // 2. Power Controls
    if (text.match(/\b(turn\s+on|power\s+on|wake\s+up|switch\s+on)\b/)) {
      try {
        await tv.turnOn();
        return { action: 'power', detail: 'Sent Wake-on-LAN to turn TV On', success: true };
      } catch (e) {
        return { action: 'power', detail: `Turn on error: ${e.message}`, success: false };
      }
    }

    if (text.match(/\b(turn\s+off|power\s+off|shut\s+down|switch\s+off)\b/)) {
      try {
        await tv.turnOff();
        return { action: 'power', detail: 'Turned TV Off', success: true };
      } catch (e) {
        return { action: 'power', detail: `Turn off error: ${e.message}`, success: false };
      }
    }

    if (text.includes('screen off') || text.includes('display off') || text.includes('dim screen') || text.includes('turn off screen')) {
      try {
        await tv.turnScreenOff();
        return { action: 'screen', detail: 'Turned Screen Off (Audio active)', success: true };
      } catch (e) {
        return { action: 'screen', detail: `Screen off error: ${e.message}`, success: false };
      }
    }

    if (text.includes('screen on') || text.includes('display on') || text.includes('turn on screen')) {
      try {
        await tv.turnScreenOn();
        return { action: 'screen', detail: 'Turned Screen On', success: true };
      } catch (e) {
        return { action: 'screen', detail: `Screen on error: ${e.message}`, success: false };
      }
    }

    // 3. Volume Adjustments
    const volMatch = text.match(/(?:set\s+)?volume\s+(?:to\s+)?(\d+)/) || text.match(/vol\s+(\d+)/);
    if (volMatch) {
      const vol = parseInt(volMatch[1], 10);
      try {
        await tv.setVolume(vol);
        return { action: 'volume', detail: `Set volume to ${vol}%`, success: true };
      } catch (e) {
        return { action: 'volume', detail: `Volume error: ${e.message}`, success: false };
      }
    }

    if (text.includes('volume up') || text.includes('louder') || text.includes('turn it up') || text.includes('increase volume')) {
      try {
        await tv.volumeUp();
        return { action: 'volume', detail: 'Increased volume', success: true };
      } catch (e) {
        return { action: 'volume', detail: `Volume error: ${e.message}`, success: false };
      }
    }

    if (text.includes('volume down') || text.includes('quieter') || text.includes('turn it down') || text.includes('decrease volume') || text.includes('lower volume')) {
      try {
        await tv.volumeDown();
        return { action: 'volume', detail: 'Decreased volume', success: true };
      } catch (e) {
        return { action: 'volume', detail: `Volume error: ${e.message}`, success: false };
      }
    }

    if (text.match(/\b(unmute|sound\s+on)\b/)) {
      try {
        await tv.setMute(false);
        return { action: 'volume', detail: 'Unmuted TV audio', success: true };
      } catch (e) {
        return { action: 'volume', detail: `Unmute error: ${e.message}`, success: false };
      }
    }

    if (text.match(/\b(mute|silence|quiet)\b/)) {
      try {
        await tv.setMute(true);
        return { action: 'volume', detail: 'Muted TV audio', success: true };
      } catch (e) {
        return { action: 'volume', detail: `Mute error: ${e.message}`, success: false };
      }
    }

    // 4. App Launches (Netflix, Spotify, Prime, Browser, etc.)
    for (const [appName, appId] of Object.entries(this.knownApps)) {
      if (text.includes(appName) && (text.includes('open') || text.includes('launch') || text.includes('start') || text.includes('switch to') || text.includes('go to'))) {
        try {
          await tv.launchApp(appId);
          const capitalized = appName.charAt(0).toUpperCase() + appName.slice(1);
          return { action: 'app', detail: `Launched ${capitalized}`, success: true };
        } catch (e) {
          return { action: 'app', detail: `Launch error: ${e.message}`, success: false };
        }
      }
    }

    // 5. HDMI Inputs
    const hdmiMatch = text.match(/hdmi\s*([1-4])/i) || text.match(/input\s*([1-4])/i);
    if (hdmiMatch) {
      const port = hdmiMatch[1];
      try {
        await tv.setInput(`HDMI_${port}`);
        return { action: 'input', detail: `Switched to HDMI ${port}`, success: true };
      } catch (e) {
        return { action: 'input', detail: `HDMI error: ${e.message}`, success: false };
      }
    }

    // 6. Navigation Buttons (Home, Back, Menu, Exit, OK, Up, Down, Left, Right)
    if (text.includes('go home') || text.includes('home screen') || text === 'home') {
      try {
        await tv.sendButton('HOME');
        return { action: 'button', detail: 'Opened Home Screen', success: true };
      } catch (e) { return { action: 'button', detail: e.message, success: false }; }
    }

    if (text.includes('go back') || text === 'back') {
      try {
        await tv.sendButton('BACK');
        return { action: 'button', detail: 'Pressed Back', success: true };
      } catch (e) { return { action: 'button', detail: e.message, success: false }; }
    }

    if (text.includes('open menu') || text.includes('settings') || text === 'menu') {
      try {
        await tv.sendButton('MENU');
        return { action: 'button', detail: 'Opened Menu', success: true };
      } catch (e) { return { action: 'button', detail: e.message, success: false }; }
    }

    if (text.includes('press ok') || text.includes('press enter') || text === 'select' || text === 'ok') {
      try {
        await tv.sendButton('ENTER');
        return { action: 'button', detail: 'Pressed OK / Enter', success: true };
      } catch (e) { return { action: 'button', detail: e.message, success: false }; }
    }

    // 7. Media Playback (Play, Pause, Stop, Rewind, Fast Forward)
    if (text.includes('pause') || text.includes('freeze')) {
      try {
        await tv.pause();
        return { action: 'media', detail: 'Paused playback', success: true };
      } catch (e) { return { action: 'media', detail: e.message, success: false }; }
    }

    if (text.includes('resume') || text.includes('play') || text.includes('unpause')) {
      try {
        await tv.play();
        return { action: 'media', detail: 'Resumed playback', success: true };
      } catch (e) { return { action: 'media', detail: e.message, success: false }; }
    }

    if (text.includes('stop')) {
      try {
        await tv.stop();
        return { action: 'media', detail: 'Stopped playback', success: true };
      } catch (e) { return { action: 'media', detail: e.message, success: false }; }
    }

    // 8. Text Input / Typing (e.g. "type interstellar on tv", "search for cyberpunk")
    const typeMatch = text.match(/(?:type|write|input|search\s+for)\s+["']?([^"']+)["']?/i);
    if (typeMatch && !text.includes('youtube')) {
      const query = typeMatch[1].trim();
      try {
        await tv.sendText(query);
        return { action: 'keyboard', detail: `Typed "${query}" on TV`, success: true };
      } catch (e) { return { action: 'keyboard', detail: e.message, success: false }; }
    }

    // 9. Toast Notifications / Alerts (e.g. "show message Dinner is ready", "alert TV Call in progress")
    const alertMatch = text.match(/(?:toast|alert|notify|show\s+message|display\s+message)\s+["']?([^"']+)["']?/i);
    if (alertMatch) {
      const msg = alertMatch[1].trim();
      try {
        await tv.showToast(msg);
        return { action: 'toast', detail: `Displayed alert: "${msg}"`, success: true };
      } catch (e) { return { action: 'toast', detail: e.message, success: false }; }
    }

    // 10. Fallback: Display as Toast message on TV
    try {
      await tv.showToast(clause);
      return { action: 'toast', detail: `Sent note to TV: "${clause}"`, success: true };
    } catch (e) {
      return { action: 'unknown', detail: `Could not interpret: "${clause}"`, success: false };
    }
  }

  // --- Smart Presets ---

  async executeBedtimeMode() {
    const steps = [];
    try {
      await tv.setVolume(12);
      steps.push({ action: 'volume', detail: 'Set Volume to 12%', success: true });
      await new Promise((r) => setTimeout(r, 400));
      await tv.turnScreenOff();
      steps.push({ action: 'screen', detail: 'Turned Screen Off (Audio keeps streaming)', success: true });
      return {
        success: true,
        prompt: 'Bedtime Mode',
        reply: '🌙 Bedtime Mode Activated: Volume dimmed to 12% and OLED display turned off.',
        steps
      };
    } catch (e) {
      return { success: false, reply: `Bedtime preset error: ${e.message}`, steps };
    }
  }

  async executeCinemaMode() {
    const steps = [];
    try {
      await tv.setVolume(26);
      steps.push({ action: 'volume', detail: 'Set Volume to 26%', success: true });
      await new Promise((r) => setTimeout(r, 400));
      await tv.launchApp('netflix');
      steps.push({ action: 'app', detail: 'Launched Netflix', success: true });
      return {
        success: true,
        prompt: 'Cinema Mode',
        reply: '🍿 Cinema Mode Activated: Volume set to 26% and Netflix opened.',
        steps
      };
    } catch (e) {
      return { success: false, reply: `Cinema preset error: ${e.message}`, steps };
    }
  }

  async executeGameMode() {
    const steps = [];
    try {
      await tv.setInput('HDMI_1');
      steps.push({ action: 'input', detail: 'Switched to HDMI 1', success: true });
      await new Promise((r) => setTimeout(r, 400));
      await tv.setVolume(22);
      steps.push({ action: 'volume', detail: 'Set Volume to 22%', success: true });
      return {
        success: true,
        prompt: 'Game Mode',
        reply: '🎮 Game Mode Activated: Switched to HDMI 1 with optimal audio level.',
        steps
      };
    } catch (e) {
      return { success: false, reply: `Game preset error: ${e.message}`, steps };
    }
  }
}

module.exports = new AIAssistant();
