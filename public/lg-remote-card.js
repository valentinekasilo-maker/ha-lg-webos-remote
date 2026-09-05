/**
 * LG webOS Smart Remote - Native Home Assistant Lovelace Card
 * 
 * Features:
 * - Instant 1-tap command execution (0ms latency, zero popup dialogs)
 * - Unified tactile D-Pad navigation wheel with central OK button
 * - Direct Home Assistant service dispatch via hass.callService
 * - Multi-path failover (button.press, remote.send_command, media_player, lg_webos_smart_remote)
 * - Volume & Channel controls with Mute toggle
 * - Navigation keys (Back, Home, Menu, Exit)
 * - Quick App Launchers (YouTube, Netflix, Spotify, Browser)
 * - Virtual Keyboard Text Input
 * - Dynamic Live TV State & App indicator
 */

class LGRemoteCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = {};
    this._cachedEntities = {};
  }

  setConfig(config) {
    this._config = {
      name: config.name || 'LG Smart Remote',
      media_player: config.media_player || config.entity || '',
      remote_entity: config.remote_entity || '',
      ...config
    };
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.findTvEntities();
    this.updateState();
  }

  findTvEntities() {
    if (!this._hass || !this._hass.states) return;
    const states = this._hass.states;

    // Discover Media Player if not configured
    if (!this._config.media_player || !states[this._config.media_player]) {
      const mp = Object.keys(states).find(id => 
        id.startsWith('media_player.') && (id.includes('lg') || id.includes('tv') || id.includes('webos') || id.includes('living_room_living_room'))
      );
      if (mp) this._cachedEntities.media_player = mp;
    } else {
      this._cachedEntities.media_player = this._config.media_player;
    }

    // Discover Remote Entity
    if (!this._config.remote_entity || !states[this._config.remote_entity]) {
      const rem = Object.keys(states).find(id => 
        id.startsWith('remote.') && (id.includes('lg') || id.includes('tv') || id.includes('webos') || id.includes('living_room_living_room'))
      );
      if (rem) this._cachedEntities.remote_entity = rem;
    } else {
      this._cachedEntities.remote_entity = this._config.remote_entity;
    }

    // Cache button entities
    const btnKeys = [
      'd_pad_up', 'd_pad_down', 'd_pad_left', 'd_pad_right', 'd_pad_enter',
      'back', 'home', 'menu', 'exit',
      'volume_up', 'volume_down', 'mute_toggle',
      'channel_up', 'channel_down',
      'power_on_wol', 'power_off', 'turn_screen_off', 'turn_screen_on',
      'youtube', 'netflix', 'spotify', 'web_browser'
    ];

    btnKeys.forEach(k => {
      const found = Object.keys(states).find(id => 
        id.startsWith('button.') && (id.includes(k) || id.replace(/_/g, '').includes(k.replace(/_/g, '')))
      );
      if (found) this._cachedEntities[k] = found;
    });
  }

  // Instant 1-tap trigger with haptic feedback
  triggerTap(handler) {
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(15);
    }
    if (handler) handler();
  }

  // Direct Button Press
  pressButton(btnKey, fallbackCommand = null) {
    if (!this._hass) return;
    const btnId = this._cachedEntities[btnKey];
    if (btnId) {
      this._hass.callService('button', 'press', { entity_id: btnId });
    }

    if (fallbackCommand) {
      this.sendRemoteCommand(fallbackCommand);
    }
  }

  // Send Remote SSAP / Pointer Command
  sendRemoteCommand(cmd) {
    if (!this._hass) return;
    const rem = this._cachedEntities.remote_entity;
    if (rem) {
      this._hass.callService('remote', 'send_command', {
        entity_id: rem,
        command: cmd
      });
    }

    // Custom integration fallback
    this._hass.callService('lg_webos_smart_remote', 'send_button', {
      button: cmd
    }).catch(() => {});
  }

  // Call Home Assistant Service
  callService(domain, service, serviceData = {}) {
    if (!this._hass) return;
    this._hass.callService(domain, service, serviceData);
  }

  // Quick App Launch
  launchApp(appId, btnKey = null) {
    if (btnKey && this._cachedEntities[btnKey]) {
      this.pressButton(btnKey);
    }
    const mp = this._cachedEntities.media_player;
    if (mp) {
      this.callService('media_player', 'select_source', {
        entity_id: mp,
        source: appId
      });
    }
  }

  render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --lg-bg: linear-gradient(145deg, #101524 0%, #0a0d16 100%);
          --lg-card-bg: rgba(18, 24, 38, 0.92);
          --lg-card-border: rgba(255, 255, 255, 0.08);
          --lg-primary: #38bdf8;
          --lg-primary-glow: rgba(56, 189, 248, 0.35);
          --lg-btn-bg: rgba(255, 255, 255, 0.05);
          --lg-btn-hover: rgba(56, 189, 248, 0.15);
          --lg-btn-active: rgba(56, 189, 248, 0.4);
          --lg-text: #f8fafc;
          --lg-text-dim: #94a3b8;
        }

        ha-card {
          background: var(--lg-card-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--lg-card-border);
          border-radius: 24px;
          padding: 22px 18px;
          color: var(--lg-text);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          user-select: none;
          -webkit-user-select: none;
          touch-action: manipulation;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding: 0 4px;
        }

        .device-info {
          display: flex;
          align-items: center;
          gap: 12px;
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

        .title-col {
          display: flex;
          flex-direction: column;
        }

        .device-title {
          font-size: 1.1rem;
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        .current-app-badge {
          font-size: 0.76rem;
          color: var(--lg-text-dim);
          font-weight: 500;
          text-transform: capitalize;
        }

        .header-actions {
          display: flex;
          gap: 8px;
        }

        button {
          background: var(--lg-btn-bg);
          border: 1px solid var(--lg-card-border);
          color: var(--lg-text);
          border-radius: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.08s ease, background 0.12s ease, border-color 0.12s ease;
          outline: none;
          -webkit-tap-highlight-color: transparent;
          font-family: inherit;
        }

        button:active {
          transform: scale(0.92);
          background: var(--lg-btn-active);
          border-color: var(--lg-primary);
          box-shadow: 0 0 14px var(--lg-primary-glow);
        }

        .power-btn {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.35);
          color: #f87171;
        }

        .power-btn:active {
          background: rgba(239, 68, 68, 0.5);
          border-color: #ef4444;
          box-shadow: 0 0 16px rgba(239, 68, 68, 0.7);
        }

        .screen-btn {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          color: #38bdf8;
        }

        /* --- UNIFIED D-PAD NAVIGATION WHEEL --- */
        .dpad-container {
          display: flex;
          justify-content: center;
          margin: 16px 0 24px 0;
        }

        .dpad-wheel {
          position: relative;
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: radial-gradient(circle at center, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.08);
        }

        .dpad-btn {
          position: absolute;
          background: transparent;
          border: none;
          color: var(--lg-text);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.08s ease;
          border-radius: 0;
        }

        .dpad-up {
          top: 4px;
          left: 50%;
          transform: translateX(-50%);
          width: 68px;
          height: 54px;
          border-radius: 34px 34px 8px 8px;
        }

        .dpad-down {
          bottom: 4px;
          left: 50%;
          transform: translateX(-50%);
          width: 68px;
          height: 54px;
          border-radius: 8px 8px 34px 34px;
        }

        .dpad-left {
          left: 4px;
          top: 50%;
          transform: translateY(-50%);
          width: 54px;
          height: 68px;
          border-radius: 34px 8px 8px 34px;
        }

        .dpad-right {
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          width: 54px;
          height: 68px;
          border-radius: 8px 34px 34px 8px;
        }

        .dpad-ok {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(56, 189, 248, 0.28) 0%, rgba(37, 99, 235, 0.2) 100%);
          border: 1px solid rgba(56, 189, 248, 0.45);
          color: #ffffff;
          font-weight: 800;
          font-size: 1.05rem;
          letter-spacing: 0.8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        }

        .dpad-btn:active {
          background: rgba(56, 189, 248, 0.35);
          color: #bae6fd;
        }

        .dpad-ok:active {
          transform: translate(-50%, -50%) scale(0.92);
          background: rgba(56, 189, 248, 0.65);
          box-shadow: 0 0 20px rgba(56, 189, 248, 0.6);
        }

        /* --- NAVIGATION ROW --- */
        .nav-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 16px;
        }

        .nav-btn {
          height: 44px;
          font-size: 0.82rem;
          font-weight: 600;
          flex-direction: column;
          gap: 2px;
        }

        /* --- CONTROLS GRID --- */
        .controls-grid {
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

        .pill-btn {
          height: 46px;
          font-weight: 600;
          font-size: 0.9rem;
          gap: 6px;
        }

        /* --- QUICK APPS --- */
        .app-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 14px;
        }

        .app-btn {
          height: 44px;
          background: rgba(255, 255, 255, 0.04);
          font-weight: 700;
          font-size: 0.8rem;
          border-radius: 12px;
        }

        .app-btn.yt { color: #f87171; border-color: rgba(248, 113, 113, 0.2); }
        .app-btn.nf { color: #ef4444; border-color: rgba(239, 68, 68, 0.2); }
        .app-btn.sp { color: #34d399; border-color: rgba(52, 211, 153, 0.2); }
        .app-btn.web { color: #60a5fa; border-color: rgba(96, 165, 250, 0.2); }

        /* --- KEYBOARD INPUT BAR --- */
        .keyboard-bar {
          display: flex;
          gap: 8px;
          margin-top: 6px;
        }

        .keyboard-input {
          flex: 1;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid var(--lg-card-border);
          border-radius: 12px;
          padding: 10px 14px;
          color: #fff;
          font-size: 0.88rem;
          outline: none;
          transition: border-color 0.2s ease;
        }

        .keyboard-input:focus {
          border-color: var(--lg-primary);
        }

        .send-text-btn {
          padding: 0 16px;
          height: 42px;
          background: rgba(56, 189, 248, 0.2);
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
        <!-- Header -->
        <div class="header">
          <div class="device-info">
            <div class="status-dot" id="statusDot"></div>
            <div class="title-col">
              <span class="device-title">${this._config.name}</span>
              <span class="current-app-badge" id="currentAppBadge">LG webOS TV</span>
            </div>
          </div>
          <div class="header-actions">
            <button class="screen-btn" id="btnScreenOff" title="Screen Off (Audio Mode)">
              <svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>
            </button>
            <button class="power-btn" id="btnPower" title="Power On / Off">
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

        <!-- 5. VIRTUAL KEYBOARD TYPING BAR -->
        <div class="keyboard-bar">
          <input type="text" class="keyboard-input" id="keyboardInput" placeholder="Type text / search on TV..." />
          <button class="send-text-btn" id="btnSendText">Send</button>
        </div>
      </ha-card>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    if (!root) return;

    // Direct zero-latency tap listener
    const bindTap = (id, callback) => {
      const el = root.getElementById(id);
      if (!el) return;

      const runAction = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        this.triggerTap(callback);
      };

      el.addEventListener('pointerdown', runAction);
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    };

    // D-Pad Navigation Wheel
    bindTap('btnUp', () => this.pressButton('d_pad_up', 'UP'));
    bindTap('btnDown', () => this.pressButton('d_pad_down', 'DOWN'));
    bindTap('btnLeft', () => this.pressButton('d_pad_left', 'LEFT'));
    bindTap('btnRight', () => this.pressButton('d_pad_right', 'RIGHT'));
    bindTap('btnOk', () => this.pressButton('d_pad_enter', 'ENTER'));

    // Navigation Keys
    bindTap('btnBack', () => this.pressButton('back', 'BACK'));
    bindTap('btnHome', () => this.pressButton('home', 'HOME'));
    bindTap('btnMenu', () => this.pressButton('menu', 'MENU'));
    bindTap('btnExit', () => this.pressButton('exit', 'EXIT'));

    // Volume, Mute & Channels
    bindTap('btnVolUp', () => {
      this.pressButton('volume_up');
      const mp = this._cachedEntities.media_player;
      if (mp) this.callService('media_player', 'volume_up', { entity_id: mp });
    });

    bindTap('btnVolDown', () => {
      this.pressButton('volume_down');
      const mp = this._cachedEntities.media_player;
      if (mp) this.callService('media_player', 'volume_down', { entity_id: mp });
    });

    bindTap('btnMute', () => {
      this.pressButton('mute_toggle');
      const mp = this._cachedEntities.media_player;
      if (mp && this._hass && this._hass.states[mp]) {
        const isMuted = this._hass.states[mp].attributes.is_volume_muted;
        this.callService('media_player', 'volume_mute', { entity_id: mp, is_volume_muted: !isMuted });
      }
    });

    bindTap('btnChanUp', () => this.pressButton('channel_up', 'CHANNEL_UP'));
    bindTap('btnChanDown', () => this.pressButton('channel_down', 'CHANNEL_DOWN'));

    // Power & Screen-Off
    bindTap('btnPower', () => {
      const mp = this._cachedEntities.media_player;
      const isOnline = mp && this._hass.states[mp] && this._hass.states[mp].state !== 'off' && this._hass.states[mp].state !== 'unavailable';
      if (isOnline) {
        this.pressButton('power_off');
        if (mp) this.callService('media_player', 'turn_off', { entity_id: mp });
      } else {
        this.pressButton('power_on_wol');
        if (mp) this.callService('media_player', 'turn_on', { entity_id: mp });
      }
    });

    bindTap('btnScreenOff', () => {
      this.pressButton('turn_screen_off');
      this.callService('lg_webos_smart_remote', 'screen_off');
    });

    // Quick App Launchers
    bindTap('btnYt', () => this.launchApp('youtube.leanback.v4', 'youtube'));
    bindTap('btnNf', () => this.launchApp('netflix', 'netflix'));
    bindTap('btnSp', () => this.launchApp('spotify-beehive', 'spotify'));
    bindTap('btnWeb', () => this.launchApp('com.webos.app.browser', 'web_browser'));

    // Virtual Keyboard
    const input = root.getElementById('keyboardInput');
    const sendBtn = root.getElementById('btnSendText');
    const submitText = () => {
      if (!input || !input.value.trim()) return;
      const text = input.value.trim();
      input.value = '';

      // Direct text entity or custom service
      const textEnt = Object.keys(this._hass.states).find(id => id.startsWith('text.') && id.includes('keyboard'));
      if (textEnt) {
        this.callService('text', 'set_value', { entity_id: textEnt, value: text });
      }
      this.callService('lg_webos_smart_remote', 'send_text', { text: text });
    };

    if (sendBtn) {
      bindTap('btnSendText', submitText);
    }
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitText();
        }
      });
    }
  }

  updateState() {
    if (!this._hass || !this.shadowRoot) return;
    const mp = this._cachedEntities.media_player;
    const mediaState = mp ? this._hass.states[mp] : null;
    const isOnline = mediaState && mediaState.state !== 'unavailable' && mediaState.state !== 'off';

    const dot = this.shadowRoot.getElementById('statusDot');
    if (dot) {
      if (isOnline) dot.classList.add('online');
      else dot.classList.remove('online');
    }

    const badge = this.shadowRoot.getElementById('currentAppBadge');
    if (badge) {
      if (mediaState && mediaState.attributes && mediaState.attributes.source) {
        badge.textContent = mediaState.attributes.source.replace('com.webos.app.', '').replace('.leanback.v4', '');
      } else if (isOnline) {
        badge.textContent = 'TV Online';
      } else {
        badge.textContent = 'TV Standby';
      }
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
console.log('*** LG webOS Smart Remote Lovelace Card v1.2.0 Registered ***');
