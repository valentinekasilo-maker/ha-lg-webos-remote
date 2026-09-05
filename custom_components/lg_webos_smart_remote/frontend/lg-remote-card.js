/**
 * LG webOS Smart Remote - Native Home Assistant Lovelace Card
 * 
 * Features:
 * - Instant 1-tap command execution (0ms latency, zero popups)
 * - Unified tactile D-Pad navigation wheel with center OK button
 * - Power & Screen-Off controls
 * - Volume & Channel rockers with Mute toggle
 * - Back, Home, Menu, Exit navigation keys
 * - Quick App Launchers (YouTube, Netflix, Spotify, Browser)
 * - Direct Home Assistant service calls via hass.callService
 */

class LGRemoteCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = null;
  }

  setConfig(config) {
    this._config = {
      name: config.name || 'LG Smart Remote',
      media_player: config.media_player || config.entity || 'media_player.lg_webos_smart_tv',
      remote_entity: config.remote_entity || 'remote.lg_webos_smart_tv',
      ...config
    };
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.updateState();
  }

  sendCommand(command) {
    if (!this._hass) return;
    
    // Haptic feedback if supported
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(12);
    }

    const remoteEntity = this._config.remote_entity;
    this._hass.callService('remote', 'send_command', {
      entity_id: remoteEntity,
      command: command
    });
  }

  callTvService(domain, service, serviceData = {}) {
    if (!this._hass) return;
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(12);
    }
    this._hass.callService(domain, service, serviceData);
  }

  launchApp(appId) {
    if (!this._hass) return;
    this.callTvService('media_player', 'select_source', {
      entity_id: this._config.media_player,
      source: appId
    });
  }

  render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --remote-bg: #10141e;
          --remote-card-bg: rgba(22, 28, 42, 0.85);
          --remote-primary: #3b82f6;
          --remote-accent: #60a5fa;
          --remote-border: rgba(255, 255, 255, 0.08);
          --remote-btn-bg: rgba(255, 255, 255, 0.06);
          --remote-btn-hover: rgba(59, 130, 246, 0.25);
          --remote-btn-active: rgba(59, 130, 246, 0.5);
          --remote-text: #f3f4f6;
          --remote-text-dim: #9ca3af;
        }

        ha-card {
          background: var(--remote-card-bg);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid var(--remote-border);
          border-radius: 20px;
          padding: 20px 16px;
          color: var(--remote-text);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          user-select: none;
          -webkit-user-select: none;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
          padding: 0 4px;
        }

        .title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .title {
          font-size: 1.05rem;
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
          transition: all 0.3s ease;
        }

        .status-dot.online {
          background: #10b981;
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.8);
        }

        .btn-row {
          display: flex;
          gap: 8px;
        }

        button {
          background: var(--remote-btn-bg);
          border: 1px solid var(--remote-border);
          color: var(--remote-text);
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s ease;
          outline: none;
          -webkit-tap-highlight-color: transparent;
        }

        button:active {
          transform: scale(0.93);
          background: var(--remote-btn-active);
          border-color: var(--remote-primary);
        }

        .power-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.3);
          color: #f87171;
        }

        .power-btn:active {
          background: rgba(239, 68, 68, 0.4);
        }

        .screen-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
        }

        /* --- UNIFIED D-PAD NAVIGATION WHEEL --- */
        .dpad-container {
          display: flex;
          justify-content: center;
          margin: 14px 0 20px 0;
        }

        .dpad-wheel {
          position: relative;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: radial-gradient(circle at center, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%);
          border: 1px solid var(--remote-border);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1);
        }

        .dpad-btn {
          position: absolute;
          background: transparent;
          border: none;
          color: var(--remote-text);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.1s ease;
        }

        .dpad-up {
          top: 6px;
          left: 50%;
          transform: translateX(-50%);
          width: 60px;
          height: 48px;
          border-radius: 30px 30px 6px 6px;
        }

        .dpad-down {
          bottom: 6px;
          left: 50%;
          transform: translateX(-50%);
          width: 60px;
          height: 48px;
          border-radius: 6px 6px 30px 30px;
        }

        .dpad-left {
          left: 6px;
          top: 50%;
          transform: translateY(-50%);
          width: 48px;
          height: 60px;
          border-radius: 30px 6px 6px 30px;
        }

        .dpad-right {
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          width: 48px;
          height: 60px;
          border-radius: 6px 30px 30px 6px;
        }

        .dpad-ok {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(37, 99, 235, 0.15) 100%);
          border: 1px solid rgba(59, 130, 246, 0.4);
          color: #ffffff;
          font-weight: 700;
          font-size: 0.95rem;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .dpad-btn:active {
          background: rgba(59, 130, 246, 0.35);
          color: #93c5fd;
        }

        .dpad-ok:active {
          transform: translate(-50%, -50%) scale(0.92);
          background: rgba(59, 130, 246, 0.6);
        }

        /* --- CONTROL ROCKERS & ROWS --- */
        .controls-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          margin-bottom: 14px;
        }

        .rocker-col {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .pill-btn {
          height: 44px;
          font-weight: 500;
          font-size: 0.88rem;
          gap: 6px;
        }

        .nav-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 14px;
        }

        .nav-btn {
          height: 42px;
          font-size: 0.8rem;
          font-weight: 500;
          flex-direction: column;
          gap: 2px;
        }

        .app-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 10px;
        }

        .app-btn {
          height: 42px;
          background: rgba(255, 255, 255, 0.04);
          font-weight: 600;
          font-size: 0.78rem;
        }

        .app-btn.yt { color: #f87171; }
        .app-btn.nf { color: #ef4444; }
        .app-btn.sp { color: #34d399; }
        .app-btn.web { color: #60a5fa; }

        svg {
          width: 20px;
          height: 20px;
          fill: currentColor;
        }
      </style>

      <ha-card>
        <!-- Header -->
        <div class="header">
          <div class="title-group">
            <div class="status-dot" id="statusDot"></div>
            <div class="title">${this._config.name}</div>
          </div>
          <div class="btn-row">
            <button class="screen-btn" id="btnScreenOff" title="Screen Off (Audio Mode)">
              <svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>
            </button>
            <button class="power-btn" id="btnPower" title="Power On/Off">
              <svg viewBox="0 0 24 24"><path d="M16.56 5.44l-1.45 1.45A5.969 5.969 0 0 1 18 11.5c0 3.31-2.69 6-6 6s-6-2.69-6-6c0-1.97.96-3.72 2.45-4.83L6.99 5.22A7.965 7.965 0 0 0 4 11.5c0 4.42 3.58 8 8 8s8-3.58 8-8c0-2.34-.99-4.44-2.56-6.06zM13 3h-2v10h2V3z"/></svg>
            </button>
          </div>
        </div>

        <!-- 1. UNIFIED D-PAD NAVIGATION WHEEL -->
        <div class="dpad-container">
          <div class="dpad-wheel">
            <button class="dpad-btn dpad-up" id="btnUp" title="Up">
              <svg viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
            </button>
            <button class="dpad-btn dpad-left" id="btnLeft" title="Left">
              <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <button class="dpad-ok" id="btnOk" title="OK / Enter">OK</button>
            <button class="dpad-btn dpad-right" id="btnRight" title="Right">
              <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>
            <button class="dpad-btn dpad-down" id="btnDown" title="Down">
              <svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
            </button>
          </div>
        </div>

        <!-- 2. NAVIGATION ROW -->
        <div class="nav-row">
          <button class="nav-btn" id="btnBack">
            <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            <span>Back</span>
          </button>
          <button class="nav-btn" id="btnHome">
            <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            <span>Home</span>
          </button>
          <button class="nav-btn" id="btnMenu">
            <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
            <span>Menu</span>
          </button>
          <button class="nav-btn" id="btnExit">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            <span>Exit</span>
          </button>
        </div>

        <!-- 3. VOLUME, MUTE & CHANNELS -->
        <div class="controls-grid">
          <div class="rocker-col">
            <button class="pill-btn" id="btnVolUp">
              <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              <span>Vol +</span>
            </button>
            <button class="pill-btn" id="btnVolDown">
              <svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
              <span>Vol −</span>
            </button>
          </div>

          <div class="rocker-col" style="justify-content: center;">
            <button class="pill-btn" id="btnMute" style="height: 100%;">
              <svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
              <span>Mute</span>
            </button>
          </div>

          <div class="rocker-col">
            <button class="pill-btn" id="btnChanUp">
              <svg viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>
              <span>Ch +</span>
            </button>
            <button class="pill-btn" id="btnChanDown">
              <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
              <span>Ch −</span>
            </button>
          </div>
        </div>

        <!-- 4. QUICK APPS -->
        <div class="app-grid">
          <button class="app-btn yt" id="btnYt">YouTube</button>
          <button class="app-btn nf" id="btnNf">Netflix</button>
          <button class="app-btn sp" id="btnSp">Spotify</button>
          <button class="app-btn web" id="btnWeb">Browser</button>
        </div>
      </ha-card>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    if (!root) return;

    // Helper for fast 1-tap execution
    const bindTap = (id, handler) => {
      const el = root.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handler();
      });
    };

    // D-Pad
    bindTap('btnUp', () => this.sendCommand('UP'));
    bindTap('btnDown', () => this.sendCommand('DOWN'));
    bindTap('btnLeft', () => this.sendCommand('LEFT'));
    bindTap('btnRight', () => this.sendCommand('RIGHT'));
    bindTap('btnOk', () => this.sendCommand('ENTER'));

    // Navigation
    bindTap('btnBack', () => this.sendCommand('BACK'));
    bindTap('btnHome', () => this.sendCommand('HOME'));
    bindTap('btnMenu', () => this.sendCommand('MENU'));
    bindTap('btnExit', () => this.sendCommand('EXIT'));

    // Audio & Channels
    bindTap('btnVolUp', () => this.callTvService('media_player', 'volume_up', { entity_id: this._config.media_player }));
    bindTap('btnVolDown', () => this.callTvService('media_player', 'volume_down', { entity_id: this._config.media_player }));
    bindTap('btnMute', () => {
      const isMuted = this._hass && this._hass.states[this._config.media_player] && this._hass.states[this._config.media_player].attributes.is_volume_muted;
      this.callTvService('media_player', 'volume_mute', { entity_id: this._config.media_player, is_volume_muted: !isMuted });
    });
    bindTap('btnChanUp', () => this.sendCommand('CHANNEL_UP'));
    bindTap('btnChanDown', () => this.sendCommand('CHANNEL_DOWN'));

    // Power & Screen
    bindTap('btnPower', () => this.callTvService('media_player', 'toggle', { entity_id: this._config.media_player }));
    bindTap('btnScreenOff', () => this.callTvService('lg_webos_smart_remote', 'screen_off'));

    // Apps
    bindTap('btnYt', () => this.launchApp('youtube.leanback.v4'));
    bindTap('btnNf', () => this.launchApp('netflix'));
    bindTap('btnSp', () => this.launchApp('spotify-beehive'));
    bindTap('btnWeb', () => this.launchApp('com.webos.app.browser'));
  }

  updateState() {
    if (!this._hass || !this.shadowRoot) return;
    const mediaState = this._hass.states[this._config.media_player];
    const isOnline = mediaState && mediaState.state !== 'unavailable' && mediaState.state !== 'off';

    const dot = this.shadowRoot.getElementById('statusDot');
    if (dot) {
      if (isOnline) dot.classList.add('online');
      else dot.classList.remove('online');
    }
  }

  getCardSize() {
    return 7;
  }
}

customElements.define('lg-remote-card', LGRemoteCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'lg-remote-card',
  name: 'LG Smart Remote Card',
  description: 'Instant 1-tap tactile glassmorphic remote controller with unified D-Pad wheel for LG webOS TVs.'
});
console.log('*** LG webOS Smart Remote Lovelace Card registered ***');
