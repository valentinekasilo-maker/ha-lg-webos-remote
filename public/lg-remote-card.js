/**
 * LG webOS Smart Remote - Real TV Remote Lovelace Card
 * 
 * Direct 1-Tap Action Execution Architecture:
 * - 0ms latency direct service calls via hass.callService
 * - ZERO More-Info popups, ZERO secondary press dialogs
 * - Unified D-Pad navigation wheel with central OK button
 * - Physical TV remote layout matching standard LG Magic Remote
 */

class LGRemoteCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = {};
  }

  setConfig(config) {
    this._config = {
      name: config.name || 'LG Smart Remote',
      media_player: config.media_player || config.entity || 'media_player.living_room_living_room',
      remote_entity: config.remote_entity || 'remote.living_room_living_room',
      ...config
    };
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.updateState();
  }

  // Get effective entity IDs with auto-discovery fallback
  getMediaPlayerId() {
    if (this._config.media_player && this._hass && this._hass.states[this._config.media_player]) {
      return this._config.media_player;
    }
    if (!this._hass || !this._hass.states) return 'media_player.living_room_living_room';
    const found = Object.keys(this._hass.states).find(id =>
      id.startsWith('media_player.') && (id.includes('lg') || id.includes('webos') || id.includes('living_room_living_room'))
    );
    return found || 'media_player.living_room_living_room';
  }

  getRemoteEntityId() {
    if (this._config.remote_entity && this._hass && this._hass.states[this._config.remote_entity]) {
      return this._config.remote_entity;
    }
    if (!this._hass || !this._hass.states) return 'remote.living_room_living_room';
    const found = Object.keys(this._hass.states).find(id =>
      id.startsWith('remote.') && (id.includes('lg') || id.includes('webos') || id.includes('living_room_living_room'))
    );
    return found || 'remote.living_room_living_room';
  }

  // 1-Tap immediate action execution with haptic feedback
  tap(actionFn) {
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(15);
    }
    if (actionFn) actionFn();
  }

  // Send Remote Navigation Command (UP, DOWN, LEFT, RIGHT, ENTER, BACK, HOME, MENU, EXIT, RED, etc.)
  sendRemote(command) {
    if (!this._hass) return;
    const remoteId = this.getRemoteEntityId();
    this._hass.callService('remote', 'send_command', {
      entity_id: remoteId,
      command: command
    });
    // Custom domain service fallback for instant execution
    this._hass.callService('lg_webos_smart_remote', 'send_button', {
      button: command
    }).catch(() => {});
  }

  // Call Media Player Service
  callMedia(service, data = {}) {
    if (!this._hass) return;
    const mpId = this.getMediaPlayerId();
    this._hass.callService('media_player', service, {
      entity_id: mpId,
      ...data
    });
  }

  // Launch App
  launchApp(appId) {
    this.callMedia('select_source', { source: appId });
  }

  render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --remote-bg: #0d111a;
          --remote-card-bg: rgba(17, 24, 39, 0.95);
          --remote-border: rgba(255, 255, 255, 0.08);
          --remote-primary: #38bdf8;
          --remote-primary-glow: rgba(56, 189, 248, 0.3);
          --remote-btn-bg: rgba(255, 255, 255, 0.05);
          --remote-btn-active: rgba(56, 189, 248, 0.4);
          --remote-text: #f8fafc;
          --remote-text-dim: #94a3b8;
        }

        ha-card {
          background: var(--remote-card-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--remote-border);
          border-radius: 28px;
          padding: 24px 20px;
          color: var(--remote-text);
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          user-select: none;
          -webkit-user-select: none;
          touch-action: manipulation;
          max-width: 440px;
          margin: 0 auto;
        }

        /* --- HEADER & STATUS --- */
        .remote-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding: 0 4px;
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
          transition: all 0.3s ease;
        }

        .status-dot.online {
          background: #10b981;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.8);
        }

        .remote-title {
          font-size: 1.12rem;
          font-weight: 700;
          letter-spacing: 0.4px;
        }

        .app-status {
          font-size: 0.76rem;
          color: var(--remote-text-dim);
          font-weight: 500;
        }

        .header-btns {
          display: flex;
          gap: 8px;
        }

        button {
          background: var(--remote-btn-bg);
          border: 1px solid var(--remote-border);
          color: var(--remote-text);
          border-radius: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.06s ease, background 0.12s ease, border-color 0.12s ease;
          outline: none;
          -webkit-tap-highlight-color: transparent;
          font-family: inherit;
        }

        button:active {
          transform: scale(0.92);
          background: var(--remote-btn-active);
          border-color: var(--remote-primary);
          box-shadow: 0 0 14px var(--remote-primary-glow);
        }

        .power-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.35);
          color: #f87171;
        }

        .power-btn:active {
          background: rgba(239, 68, 68, 0.5);
          box-shadow: 0 0 16px rgba(239, 68, 68, 0.8);
        }

        .screen-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          color: #38bdf8;
        }

        /* --- UNIFIED D-PAD NAVIGATION WHEEL --- */
        .dpad-section {
          display: flex;
          justify-content: center;
          margin: 14px 0 22px 0;
        }

        .dpad-wheel {
          position: relative;
          width: 230px;
          height: 230px;
          border-radius: 50%;
          background: radial-gradient(circle at center, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.1);
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
          transition: all 0.06s ease;
          border-radius: 0;
        }

        .dpad-up {
          top: 4px;
          left: 50%;
          transform: translateX(-50%);
          width: 72px;
          height: 58px;
          border-radius: 36px 36px 10px 10px;
        }

        .dpad-down {
          bottom: 4px;
          left: 50%;
          transform: translateX(-50%);
          width: 72px;
          height: 58px;
          border-radius: 10px 10px 36px 36px;
        }

        .dpad-left {
          left: 4px;
          top: 50%;
          transform: translateY(-50%);
          width: 58px;
          height: 72px;
          border-radius: 36px 10px 10px 36px;
        }

        .dpad-right {
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          width: 58px;
          height: 72px;
          border-radius: 10px 36px 36px 10px;
        }

        .dpad-ok {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 84px;
          height: 84px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(56, 189, 248, 0.3) 0%, rgba(37, 99, 235, 0.22) 100%);
          border: 1px solid rgba(56, 189, 248, 0.5);
          color: #ffffff;
          font-weight: 800;
          font-size: 1.1rem;
          letter-spacing: 0.8px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
        }

        .dpad-btn:active {
          background: rgba(56, 189, 248, 0.35);
          color: #bae6fd;
        }

        .dpad-ok:active {
          transform: translate(-50%, -50%) scale(0.92);
          background: rgba(56, 189, 248, 0.65);
          box-shadow: 0 0 22px rgba(56, 189, 248, 0.7);
        }

        /* --- NAVIGATION 2x2 GRID (HOME, BACK, MENU, EXIT) --- */
        .nav-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 16px;
        }

        .nav-pill {
          height: 44px;
          font-size: 0.88rem;
          font-weight: 600;
          gap: 8px;
        }

        /* --- VOLUME, MUTE & CHANNELS --- */
        .controls-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          margin-bottom: 16px;
        }

        .rocker-col {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ctrl-btn {
          height: 46px;
          font-weight: 700;
          font-size: 0.92rem;
          gap: 6px;
        }

        .mute-btn {
          height: 100%;
          flex-direction: column;
          gap: 4px;
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.2);
          color: #f87171;
        }

        /* --- MEDIA PLAYBACK (REWIND, PLAY/PAUSE, FASTFORWARD, STOP) --- */
        .media-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 16px;
        }

        .media-btn {
          height: 42px;
        }

        /* --- QUICK APPS GRID --- */
        .apps-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 16px;
        }

        .app-btn {
          height: 42px;
          font-weight: 700;
          font-size: 0.82rem;
          border-radius: 12px;
        }

        .app-yt { color: #f87171; border-color: rgba(248, 113, 113, 0.25); }
        .app-nf { color: #ef4444; border-color: rgba(239, 68, 68, 0.25); }
        .app-sp { color: #34d399; border-color: rgba(52, 211, 153, 0.25); }
        .app-web { color: #60a5fa; border-color: rgba(96, 165, 250, 0.25); }
        .app-tv { color: #fbbf24; border-color: rgba(251, 191, 36, 0.25); }
        .app-store { color: #c084fc; border-color: rgba(192, 132, 252, 0.25); }

        /* --- COLOR KEYS (RED, GREEN, YELLOW, BLUE) --- */
        .color-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 16px;
        }

        .color-btn {
          height: 32px;
          border-radius: 8px;
        }

        .color-btn.red { background: rgba(239, 68, 68, 0.25); border-color: #ef4444; }
        .color-btn.green { background: rgba(34, 197, 94, 0.25); border-color: #22c55e; }
        .color-btn.yellow { background: rgba(234, 179, 8, 0.25); border-color: #eab308; }
        .color-btn.blue { background: rgba(59, 130, 246, 0.25); border-color: #3b82f6; }

        /* --- KEYBOARD INPUT BAR --- */
        .keyboard-bar {
          display: flex;
          gap: 8px;
        }

        .keyboard-input {
          flex: 1;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid var(--remote-border);
          border-radius: 12px;
          padding: 10px 14px;
          color: #fff;
          font-size: 0.88rem;
          outline: none;
        }

        .keyboard-input:focus {
          border-color: var(--remote-primary);
        }

        .keyboard-btn {
          padding: 0 16px;
          height: 42px;
          background: rgba(56, 189, 248, 0.18);
          border-color: rgba(56, 189, 248, 0.4);
          color: #38bdf8;
          font-weight: 600;
          font-size: 0.85rem;
        }

        svg {
          width: 22px;
          height: 22px;
          fill: currentColor;
          flex-shrink: 0;
        }
      </style>

      <ha-card>
        <!-- 1. HEADER & POWER -->
        <div class="remote-header">
          <div class="status-badge">
            <div class="status-dot" id="statusDot"></div>
            <div>
              <div class="remote-title">${this._config.name}</div>
              <div class="app-status" id="appStatus">LG webOS TV</div>
            </div>
          </div>
          <div class="header-btns">
            <button class="screen-btn" id="btnScreenOff" title="Screen Off (Audio Mode)">
              <svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>
            </button>
            <button class="power-btn" id="btnPower" title="Power On / Off">
              <svg viewBox="0 0 24 24"><path d="M16.56 5.44l-1.45 1.45A5.969 5.969 0 0 1 18 11.5c0 3.31-2.69 6-6 6s-6-2.69-6-6c0-1.97.96-3.72 2.45-4.83L6.99 5.22A7.965 7.965 0 0 0 4 11.5c0 4.42 3.58 8 8 8s8-3.58 8-8c0-2.34-.99-4.44-2.56-6.06zM13 3h-2v10h2V3z"/></svg>
            </button>
          </div>
        </div>

        <!-- 2. UNIFIED D-PAD NAVIGATION WHEEL -->
        <div class="dpad-section">
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

        <!-- 3. NAVIGATION (HOME, BACK, MENU, EXIT) -->
        <div class="nav-grid">
          <button class="nav-pill" id="btnHome">
            <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            <span>Home</span>
          </button>
          <button class="nav-pill" id="btnBack">
            <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            <span>Back</span>
          </button>
          <button class="nav-pill" id="btnMenu">
            <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
            <span>Menu</span>
          </button>
          <button class="nav-pill" id="btnExit">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            <span>Exit</span>
          </button>
        </div>

        <!-- 4. VOLUME, MUTE & CHANNELS -->
        <div class="controls-row">
          <div class="rocker-col">
            <button class="ctrl-btn" id="btnVolUp">
              <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              <span>Vol +</span>
            </button>
            <button class="ctrl-btn" id="btnVolDown">
              <svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
              <span>Vol −</span>
            </button>
          </div>

          <div class="rocker-col" style="justify-content: center;">
            <button class="ctrl-btn mute-btn" id="btnMute">
              <svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
              <span>Mute</span>
            </button>
          </div>

          <div class="rocker-col">
            <button class="ctrl-btn" id="btnChanUp">
              <svg viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>
              <span>Ch +</span>
            </button>
            <button class="ctrl-btn" id="btnChanDown">
              <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
              <span>Ch −</span>
            </button>
          </div>
        </div>

        <!-- 5. MEDIA PLAYBACK (REWIND, PLAY/PAUSE, FASTFORWARD, STOP) -->
        <div class="media-row">
          <button class="media-btn" id="btnRewind" title="Rewind">
            <svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
          </button>
          <button class="media-btn" id="btnPlayPause" title="Play / Pause">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button class="media-btn" id="btnFastForward" title="Fast Forward">
            <svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
          </button>
          <button class="media-btn" id="btnStop" title="Stop">
            <svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
          </button>
        </div>

        <!-- 6. QUICK APPS (YOUTUBE, NETFLIX, SPOTIFY, BROWSER, LIVE TV, STORE) -->
        <div class="apps-grid">
          <button class="app-btn app-yt" id="btnYt">YouTube</button>
          <button class="app-btn app-nf" id="btnNf">Netflix</button>
          <button class="app-btn app-sp" id="btnSp">Spotify</button>
          <button class="app-btn app-web" id="btnWeb">Browser</button>
          <button class="app-btn app-tv" id="btnLiveTv">Live TV</button>
          <button class="app-btn app-store" id="btnStore">LG Store</button>
        </div>

        <!-- 7. COLOR BUTTONS (RED, GREEN, YELLOW, BLUE) -->
        <div class="color-row">
          <button class="color-btn red" id="btnRed" title="Red"></button>
          <button class="color-btn green" id="btnGreen" title="Green"></button>
          <button class="color-btn yellow" id="btnYellow" title="Yellow"></button>
          <button class="color-btn blue" id="btnBlue" title="Blue"></button>
        </div>

        <!-- 8. VIRTUAL KEYBOARD TYPING BAR -->
        <div class="keyboard-bar">
          <input type="text" class="keyboard-input" id="keyboardInput" placeholder="Type text on TV search..." />
          <button class="keyboard-btn" id="btnSendText">Send</button>
        </div>
      </ha-card>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    if (!root) return;

    // Direct 1-Tap event binder: 0ms latency, zero popups
    const bindTap = (id, callback) => {
      const el = root.getElementById(id);
      if (!el) return;

      const trigger = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        this.tap(callback);
      };

      el.addEventListener('pointerdown', trigger);
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    };

    // --- D-PAD NAVIGATION WHEEL ---
    bindTap('btnUp', () => this.sendRemote('UP'));
    bindTap('btnDown', () => this.sendRemote('DOWN'));
    bindTap('btnLeft', () => this.sendRemote('LEFT'));
    bindTap('btnRight', () => this.sendRemote('RIGHT'));
    bindTap('btnOk', () => this.sendRemote('ENTER'));

    // --- NAVIGATION ---
    bindTap('btnHome', () => this.sendRemote('HOME'));
    bindTap('btnBack', () => this.sendRemote('BACK'));
    bindTap('btnMenu', () => this.sendRemote('MENU'));
    bindTap('btnExit', () => this.sendRemote('EXIT'));

    // --- AUDIO & CHANNELS ---
    bindTap('btnVolUp', () => this.callMedia('volume_up'));
    bindTap('btnVolDown', () => this.callMedia('volume_down'));
    bindTap('btnMute', () => {
      const mpId = this.getMediaPlayerId();
      const isMuted = this._hass && this._hass.states[mpId] && this._hass.states[mpId].attributes.is_volume_muted;
      this.callMedia('volume_mute', { is_volume_muted: !isMuted });
    });
    bindTap('btnChanUp', () => this.sendRemote('CHANNEL_UP'));
    bindTap('btnChanDown', () => this.sendRemote('CHANNEL_DOWN'));

    // --- MEDIA CONTROLS ---
    bindTap('btnRewind', () => this.callMedia('media_previous_track'));
    bindTap('btnPlayPause', () => this.callMedia('media_play_pause'));
    bindTap('btnFastForward', () => this.callMedia('media_next_track'));
    bindTap('btnStop', () => this.callMedia('media_stop'));

    // --- POWER & SCREEN ---
    bindTap('btnPower', () => this.callMedia('toggle'));
    bindTap('btnScreenOff', () => this.sendRemote('SCREEN_OFF'));

    // --- APPS ---
    bindTap('btnYt', () => this.launchApp('youtube.leanback.v4'));
    bindTap('btnNf', () => this.launchApp('netflix'));
    bindTap('btnSp', () => this.launchApp('spotify-beehive'));
    bindTap('btnWeb', () => this.launchApp('com.webos.app.browser'));
    bindTap('btnLiveTv', () => this.launchApp('com.webos.app.livetv'));
    bindTap('btnStore', () => this.launchApp('com.webos.app.discovery'));

    // --- COLOR KEYS ---
    bindTap('btnRed', () => this.sendRemote('RED'));
    bindTap('btnGreen', () => this.sendRemote('GREEN'));
    bindTap('btnYellow', () => this.sendRemote('YELLOW'));
    bindTap('btnBlue', () => this.sendRemote('BLUE'));

    // --- KEYBOARD TYPING ---
    const input = root.getElementById('keyboardInput');
    const sendBtn = root.getElementById('btnSendText');
    const doSendText = () => {
      if (!input || !input.value.trim()) return;
      const val = input.value.trim();
      input.value = '';
      this._hass.callService('lg_webos_smart_remote', 'send_text', { text: val });
    };

    if (sendBtn) bindTap('btnSendText', doSendText);
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doSendText();
        }
      });
    }
  }

  updateState() {
    if (!this._hass || !this.shadowRoot) return;
    const mpId = this.getMediaPlayerId();
    const mediaState = mpId ? this._hass.states[mpId] : null;
    const isOnline = mediaState && mediaState.state !== 'unavailable' && mediaState.state !== 'off';

    const dot = this.shadowRoot.getElementById('statusDot');
    if (dot) {
      if (isOnline) dot.classList.add('online');
      else dot.classList.remove('online');
    }

    const appLabel = this.shadowRoot.getElementById('appStatus');
    if (appLabel) {
      if (mediaState && mediaState.attributes && mediaState.attributes.source) {
        appLabel.textContent = mediaState.attributes.source.replace('com.webos.app.', '').replace('.leanback.v4', '');
      } else if (isOnline) {
        appLabel.textContent = 'TV Online';
      } else {
        appLabel.textContent = 'TV Standby';
      }
    }
  }

  getCardSize() {
    return 8;
  }
}

customElements.define('lg-remote-card', LGRemoteCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'lg-remote-card',
  name: 'LG Smart Remote Card',
  description: 'Physical tactile glassmorphic LG TV remote controller with unified D-Pad wheel and 1-tap instant action execution.'
});
console.log('*** LG webOS Smart Remote Card v2.0 Registered ***');
