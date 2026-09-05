const EventEmitter = require('events');
const lgtv2 = require('lgtv2');
const wol = require('wake_on_lan');
const { getConfig, saveClientKey } = require('./config');

class LGTVController extends EventEmitter {
  constructor() {
    super();
    this.lgtv = null;
    this.pointerSocket = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.pairingPrompt = false;
    this.currentStatus = {
      connected: false,
      pairing: false,
      volume: null,
      muted: false,
      currentApp: null,
      installedApps: []
    };
    // Default error listener to prevent uncaught EventEmitter error crash
    this.on('error', (err) => {
      // Safe no-op / warning
    });
  }

  /**
   * Initialize or reconnect to the LG TV
   */
  connect() {
    const config = getConfig();
    if (!config.tvIp) {
      console.warn('[LGTV] No TV IP configured.');
      return;
    }

    if (this.lgtv) {
      try {
        this.lgtv.disconnect();
      } catch (e) {
        // ignore
      }
      this.lgtv = null;
    }

    const wsUrl = `ws://${config.tvIp}:${config.port || 3000}`;
    console.log(`[LGTV] Connecting to ${wsUrl}...`);
    this.isConnecting = true;
    this.pairingPrompt = false;
    this.updateStatus({ connected: false, pairing: false });
    this.emit('connecting');

    try {
      this.lgtv = lgtv2({
        url: wsUrl,
        timeout: 8000,
        reconnect: config.reconnectInterval || 5000,
        clientKey: config.clientKey || undefined,
        saveKey: (key, cb) => {
          console.log('[LGTV] Received and saved client pairing key.');
          saveClientKey(key);
          if (cb) cb(null);
        }
      });

      this.lgtv.on('connect', () => {
        console.log('[LGTV] Connected and paired successfully!');
        this.isConnected = true;
        this.isConnecting = false;
        this.pairingPrompt = false;
        this.updateStatus({ connected: true, pairing: false });
        this.emit('connect');

        // Initialize pointer socket for instant button control
        this.initPointerSocket();

        // Subscribe to volume changes
        this.subscribeVolume();

        // Subscribe to current foreground app
        this.subscribeCurrentApp();

        // Refresh installed apps list
        this.getApps().catch(() => {});
      });

      this.lgtv.on('prompt', () => {
        console.log('[LGTV] Please accept the pairing request prompt on your TV screen.');
        this.pairingPrompt = true;
        this.updateStatus({ pairing: true });
        this.emit('prompt');
      });

      this.lgtv.on('error', (err) => {
        // TV off or unreachable
        if (this.isConnected) {
          console.log('[LGTV] Connection error:', err.message || err);
        }
        this.isConnected = false;
        this.isConnecting = false;
        this.pointerSocket = null;
        this.updateStatus({ connected: false });
        this.emit('error', err);
      });

      this.lgtv.on('close', () => {
        if (this.isConnected) {
          console.log('[LGTV] Connection closed.');
        }
        this.isConnected = false;
        this.isConnecting = false;
        this.pointerSocket = null;
        this.updateStatus({ connected: false });
        this.emit('close');
      });
    } catch (err) {
      console.error('[LGTV] Setup error:', err.message);
      this.isConnected = false;
      this.isConnecting = false;
    }
  }

  disconnect() {
    if (this.lgtv) {
      try {
        this.lgtv.disconnect();
      } catch (e) {}
      this.lgtv = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.pointerSocket = null;
    this.updateStatus({ connected: false, pairing: false });
  }

  updateStatus(updates) {
    this.currentStatus = { ...this.currentStatus, ...updates };
    this.emit('statusChanged', this.currentStatus);
  }

  getStatus() {
    return {
      ...this.currentStatus,
      isConnecting: this.isConnecting,
      pairingPrompt: this.pairingPrompt,
      config: {
        tvIp: getConfig().tvIp,
        tvMac: getConfig().tvMac,
        hasKey: !!getConfig().clientKey
      }
    };
  }

  /**
   * Generic request wrapper returning a Promise
   */
  request(uri, payload = {}) {
    return new Promise((resolve, reject) => {
      if (!this.lgtv || !this.isConnected) {
        return reject(new Error('LG TV is not connected. Make sure the TV is on and paired.'));
      }
      this.lgtv.request(uri, payload, (err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
  }

  /**
   * Get or recreate active Pointer Socket for mouse & D-pad key presses
   */
  getPointerSocket() {
    if (!this.lgtv || !this.isConnected) {
      return Promise.reject(new Error('TV is not connected. Make sure TV is on.'));
    }
    if (this.pointerSocket && this.pointerSocket.ws && this.pointerSocket.ws.connected) {
      return Promise.resolve(this.pointerSocket);
    }
    if (this._pointerPromise) {
      return this._pointerPromise;
    }
    this._pointerPromise = new Promise((resolve, reject) => {
      this.lgtv.getSocket('ssap://com.webos.service.networkinput/getPointerInputSocket', (err, sock) => {
        this._pointerPromise = null;
        if (err) {
          console.warn('[LGTV] Error getting pointer input socket:', err.message);
          return reject(err);
        }
        this.pointerSocket = sock;
        console.log('[LGTV] Pointer socket established.');
        resolve(sock);
      });
    });
    return this._pointerPromise;
  }

  /**
   * Initialize Pointer Socket on connection
   */
  initPointerSocket() {
    this.getPointerSocket().catch((e) => {
      console.warn('[LGTV] Initial pointer socket setup notice:', e.message);
    });
  }

  /**
   * Send remote button key press (e.g. 'UP', 'DOWN', 'LEFT', 'RIGHT', 'ENTER', 'BACK', 'HOME', 'MENU', 'EXIT', etc.)
   */
  sendButton(name) {
    const formattedName = String(name).trim().toUpperCase();
    if (this.pointerSocket && this.pointerSocket.ws && this.pointerSocket.ws.connected) {
      this.pointerSocket.send('button', { name: formattedName });
      return Promise.resolve({ success: true, button: formattedName });
    }
    return this.getPointerSocket().then((sock) => {
      sock.send('button', { name: formattedName });
      return { success: true, button: formattedName };
    }).catch((err) => {
      console.error(`[LGTV] Failed to send button ${formattedName}:`, err.message);
      throw err;
    });
  }

  /**
   * Click the pointer cursor
   */
  async sendClick() {
    try {
      const sock = await this.getPointerSocket();
      sock.send('click');
      return { success: true };
    } catch (err) {
      console.error('[LGTV] Failed to send click:', err.message);
      throw err;
    }
  }

  /**
   * Move the pointer cursor
   */
  sendMove(dx, dy, drag = 0) {
    if (!this.pointerSocket) return;
    try {
      this.pointerSocket.send('move', { dx, dy, drag });
    } catch (e) {}
  }

  /**
   * Send text string to TV active input field / search bar
   */
  async sendText(text) {
    const str = String(text);
    console.log(`[LGTV] Typing text: "${str}"`);
    let sent = false;

    // 1. Try pointer socket text typing
    try {
      const sock = await this.getPointerSocket();
      sock.send('type', { str: str });
      sent = true;
    } catch (e) {
      console.warn('[LGTV] Pointer socket typing notice:', e.message);
    }

    // 2. Also send via Luna IME for native apps
    try {
      await this.request('ssap://com.webos.service.ime/insertText', { text: str, replace: 0 });
      sent = true;
    } catch (e) {
      // Ignored if app doesn't use ime
    }

    return { success: sent, text: str };
  }

  /**
   * Send Backspace / Delete character
   */
  async sendBackspace(count = 1) {
    try {
      const sock = await this.getPointerSocket();
      for (let i = 0; i < count; i++) {
        sock.send('button', { name: 'BACKSPACE' });
      }
    } catch (e) {}

    try {
      await this.request('ssap://com.webos.service.ime/deleteCharacters', { count: count || 1 });
    } catch (e) {}

    return { success: true };
  }

  /**
   * Send Enter Key to submit input
   */
  async sendEnter() {
    try {
      const sock = await this.getPointerSocket();
      sock.send('button', { name: 'ENTER' });
    } catch (e) {}

    try {
      await this.request('ssap://com.webos.service.ime/sendEnterKey');
    } catch (e) {}

    return { success: true };
  }

  /**
   * Turn the TV On using Wake-on-LAN (Requires TV MAC Address & 'Mobile TV On' enabled in TV settings)
   */
  turnOn() {
    return new Promise((resolve, reject) => {
      const config = getConfig();
      const mac = config.tvMac;
      if (!mac || mac.trim() === '') {
        return reject(new Error('TV MAC Address is not configured. Wake-on-LAN requires the TV MAC address (found in TV Network Settings).'));
      }

      console.log(`[LGTV] Sending Wake-on-LAN packet to ${mac}...`);
      wol.wake(mac, (err) => {
        if (err) {
          console.error('[LGTV] WoL failed:', err);
          return reject(err);
        }
        console.log('[LGTV] WoL magic packet sent successfully!');
        // Trigger connect attempt after brief delay
        setTimeout(() => this.connect(), 2000);
        resolve({ success: true, message: 'Wake-on-LAN packet sent' });
      });
    });
  }

  /**
   * Turn TV Off
   */
  async turnOff() {
    return this.request('ssap://system/turnOff');
  }

  /**
   * Turn Screen Off (keep audio playing)
   */
  async turnScreenOff() {
    return this.request('ssap://com.webos.service.tvpower/power/turnOffScreen');
  }

  /**
   * Turn Screen On
   */
  async turnScreenOn() {
    return this.request('ssap://com.webos.service.tvpower/power/turnOnScreen');
  }

  // --- Volume & Audio ---

  async setVolume(volume) {
    const vol = Math.max(0, Math.min(100, parseInt(volume, 10)));
    return this.request('ssap://audio/setVolume', { volume: vol });
  }

  async volumeUp() {
    return this.request('ssap://audio/volumeUp');
  }

  async volumeDown() {
    return this.request('ssap://audio/volumeDown');
  }

  async setMute(mute) {
    return this.request('ssap://audio/setMute', { mute: Boolean(mute) });
  }

  async getVolume() {
    return this.request('ssap://audio/getVolume');
  }

  subscribeVolume() {
    if (!this.lgtv) return;
    this.lgtv.subscribe('ssap://audio/getVolume', (err, res) => {
      if (err || !res) return;
      this.updateStatus({
        volume: res.volume,
        muted: res.muted
      });
    });
  }

  // --- Apps & Inputs ---

  async getApps() {
    const res = await this.request('ssap://com.webos.applicationManager/listLaunchPoints');
    if (res && res.launchPoints) {
      this.updateStatus({ installedApps: res.launchPoints });
      return res.launchPoints;
    }
    return [];
  }

  subscribeCurrentApp() {
    if (!this.lgtv) return;
    this.lgtv.subscribe('ssap://com.webos.applicationManager/getForegroundAppInfo', (err, res) => {
      if (err || !res) return;
      this.updateStatus({
        currentApp: res.appId
      });
    });
  }

  async launchApp(appId, params = {}) {
    return this.request('ssap://system.launcher/launch', { id: appId, params });
  }

  async closeApp(appId) {
    return this.request('ssap://system.launcher/close', { id: appId });
  }

  async openUrlInBrowser(url) {
    return this.request('ssap://system.launcher/open', { target: url });
  }

  async openYoutube(videoIdOrUrl) {
    // If it's a full URL, extract ID or pass contentId
    let contentId = videoIdOrUrl;
    if (videoIdOrUrl.includes('v=')) {
      const match = videoIdOrUrl.match(/v=([a-zA-Z0-9_-]+)/);
      if (match) contentId = match[1];
    } else if (videoIdOrUrl.includes('youtu.be/')) {
      const match = videoIdOrUrl.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
      if (match) contentId = match[1];
    }
    return this.request('ssap://system.launcher/launch', {
      id: 'youtube.leanback.v4',
      contentId: contentId ? `https://www.youtube.com/watch?v=${contentId}` : undefined
    });
  }

  async getInputs() {
    return this.request('ssap://tv/getExternalInputList');
  }

  async setInput(inputId) {
    return this.request('ssap://tv/switchInput', { inputId });
  }

  // --- Channel Controls ---

  async channelUp() {
    return this.request('ssap://tv/channelUp');
  }

  async channelDown() {
    return this.request('ssap://tv/channelDown');
  }

  async getChannelList() {
    return this.request('ssap://tv/getChannelList');
  }

  // --- Media Controls ---

  async play() {
    return this.request('ssap://media.controls/play');
  }

  async pause() {
    return this.request('ssap://media.controls/pause');
  }

  async stop() {
    return this.request('ssap://media.controls/stop');
  }

  async rewind() {
    return this.request('ssap://media.controls/rewind');
  }

  async fastForward() {
    return this.request('ssap://media.controls/fastForward');
  }

  // --- Toast Notifications ---

  async showToast(message, iconData = null) {
    const payload = { message: String(message) };
    if (iconData) {
      payload.iconData = iconData;
    }
    return this.request('ssap://system.notifications/createToast', payload);
  }

  // --- System Info ---

  async getSystemInfo() {
    return this.request('ssap://system/getSystemInfo');
  }

  async getSoftwareInfo() {
    return this.request('ssap://com.webos.service.update/getCurrentSWInformation');
  }
}

// Singleton instance
const tv = new LGTVController();

module.exports = tv;
