const mqtt = require('mqtt');
const WebSocket = require('ws');
const tv = require('./lgtv');
const { getConfig } = require('./config');

const DEFAULT_HA_WS_URL = process.env.HA_WS_URL || 'wss://vanc.win/api/websocket';
const DEFAULT_HA_TOKEN = process.env.HA_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI5YWYwYzVmYjY0NWI0ZDAzYTUwY2Y4OTI1NTZiNjkzYSIsImlhdCI6MTc4ODU1NjY0OSwiZXhwIjoyMTAzOTE2NjQ5fQ.P1Eqjr7zXTbcDddXLlY4BtdQ0TPc3tpx_8VsXq9jMR0';

class HomeAssistantBridge {
  constructor() {
    this.mqttClient = null;
    this.wsClient = null;
    this.isMqttConnected = false;
    this.isWsConnected = false;
    this.reqId = 100;
    this.cachedApps = [];
    this.knownSources = [
      'com.webos.app.home',
      'youtube.leanback.v4',
      'netflix',
      'spotify-beehive',
      'com.webos.app.browser',
      'com.webos.app.discovery',
      'com.webos.app.livetv'
    ];
  }

  getDeviceId() {
    const config = getConfig();
    const mac = (config.tvMac || 'DC:03:98:69:CC:9A').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `lg_tv_${mac}`;
  }

  getDevicePayload() {
    const config = getConfig();
    const mac = config.tvMac || 'DC:03:98:69:CC:9A';
    const cleanMac = mac.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return {
      identifiers: [`lg_webos_${cleanMac}`],
      connections: [['mac', mac]],
      name: config.deviceName || 'LG webOS Smart TV',
      manufacturer: 'LG Electronics',
      model: 'webOS Smart TV',
      sw_version: 'webOS 1.1.0',
      suggested_area: config.deviceArea || 'Living Room',
      configuration_url: config.tvIp ? `http://${config.tvIp}` : undefined
    };
  }

  start() {
    // 1. Start Home Assistant WebSocket Connection
    this.startWebSocketBridge();

    // 2. Start MQTT Connection
    this.startMQTTBridge();

    // 3. Attach TV status listeners
    this.attachTVListeners();
  }

  // --- WEBSOCKET EVENT BRIDGE ---
  startWebSocketBridge() {
    const wsUrl = DEFAULT_HA_WS_URL;
    console.log(`[HA-Bridge] Connecting to Home Assistant WebSocket at ${wsUrl}...`);

    try {
      this.wsClient = new WebSocket(wsUrl);

      this.wsClient.on('open', () => {
        console.log('[HA-Bridge] Home Assistant WebSocket connected!');
      });

      this.wsClient.on('message', (msg) => {
        try {
          const data = JSON.parse(msg);
          this.handleWsMessage(data);
        } catch (e) {}
      });

      this.wsClient.on('error', (err) => {
        console.warn('[HA-Bridge] WebSocket notice:', err.message);
      });

      this.wsClient.on('close', () => {
        this.isWsConnected = false;
        setTimeout(() => this.startWebSocketBridge(), 10000);
      });
    } catch (e) {
      console.warn('[HA-Bridge] WebSocket init notice:', e.message);
    }
  }

  handleWsMessage(data) {
    if (data.type === 'auth_required') {
      this.wsSend({ type: 'auth', access_token: DEFAULT_HA_TOKEN });
    } else if (data.type === 'auth_ok') {
      this.isWsConnected = true;
      console.log('[HA-Bridge] Authenticated to Home Assistant via WebSocket!');

      // Publish Discovery configurations
      this.publishAllDiscovery();

      // Subscribe to call_service events to capture Home Assistant UI clicks & automations
      this.wsSend({
        id: this.reqId++,
        type: 'subscribe_events',
        event_type: 'call_service'
      });

      // Subscribe to MQTT topics via Home Assistant WebSocket
      this.wsSend({
        id: this.reqId++,
        type: 'mqtt/subscribe',
        topic: `${this.getDeviceId()}/#`
      });

      // Initial state synchronization
      this.syncState();
    } else if (data.type === 'event' && data.event) {
      if (data.event.event_type === 'call_service' && data.event.data) {
        this.handleServiceCall(data.event.data);
      } else if (data.event.topic && data.event.payload !== undefined) {
        this.handleMqttMessage(data.event.topic, String(data.event.payload).trim());
      }
    }
  }

  wsSend(payload) {
    if (this.wsClient && this.wsClient.readyState === WebSocket.OPEN) {
      this.wsClient.send(JSON.stringify(payload));
    }
  }

  publishViaHA(topic, payload, retain = true) {
    if (!this.isWsConnected) return;
    this.wsSend({
      id: this.reqId++,
      type: 'call_service',
      domain: 'mqtt',
      service: 'publish',
      service_data: {
        topic: topic,
        payload: typeof payload === 'object' ? JSON.stringify(payload) : String(payload),
        retain: retain
      }
    });
  }

  // --- MQTT BRIDGE ---
  startMQTTBridge() {
    const config = getConfig();
    if (config.mqttEnabled === false) return;

    const host = config.mqttHost || '127.0.0.1';
    const port = config.mqttPort || 1883;
    const user = config.mqttUser || '';
    const pass = config.mqttPassword || '';

    const protocol = host.startsWith('mqtt://') || host.startsWith('ws://') ? '' : 'mqtt://';
    const brokerUrl = `${protocol}${host}:${port}`;

    try {
      this.mqttClient = mqtt.connect(brokerUrl, {
        clientId: `lg_tv_bridge_${Math.random().toString(16).substring(2, 8)}`,
        clean: true,
        reconnectPeriod: 10000,
        connectTimeout: 5000,
        username: user || undefined,
        password: pass || undefined,
        will: {
          topic: `${this.getDeviceId()}/availability`,
          payload: 'offline',
          qos: 1,
          retain: true
        }
      });

      this.mqttClient.on('connect', () => {
        console.log('[HA-Bridge] MQTT broker connected!');
        this.isMqttConnected = true;
        this.publishAllDiscovery();
        this.subscribeMqttTopics();
        this.syncState();
      });

      this.mqttClient.on('message', (topic, message) => {
        this.handleMqttMessage(topic, message.toString().trim());
      });

      this.mqttClient.on('error', () => {});
      this.mqttClient.on('close', () => {
        this.isMqttConnected = false;
      });
    } catch (e) {}
  }

  subscribeMqttTopics() {
    if (!this.mqttClient || !this.isMqttConnected) return;
    const deviceId = this.getDeviceId();
    this.mqttClient.subscribe(`${deviceId}/#`);
  }

  publish(topic, payload, options = { retain: true }) {
    // 1. Send via local MQTT if connected
    if (this.mqttClient && this.isMqttConnected) {
      const strPayload = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
      this.mqttClient.publish(topic, strPayload, { qos: 0, ...options });
    }

    // 2. Also send via Home Assistant WebSocket API to ensure instant delivery
    this.publishViaHA(topic, payload, options.retain !== false);
  }

  // --- DISCOVERY REGISTRATION ---
  publishAllDiscovery() {
    const config = getConfig();
    const prefix = config.mqttDiscoveryPrefix || 'homeassistant';
    const deviceId = this.getDeviceId();
    const device = this.getDevicePayload();
    const availTopic = `${deviceId}/availability`;

    console.log(`[HA-Bridge] Registering Home Assistant Device: "${device.name}" in Area: "${device.suggested_area}"`);

    // Availability
    this.publish(availTopic, 'online');

    // 1. Media Player
    this.publish(`${prefix}/media_player/${deviceId}/media_player/config`, {
      name: null,
      has_entity_name: true,
      unique_id: `${deviceId}_media_player`,
      device,
      device_class: 'tv',
      availability_topic: availTopic,
      state_topic: `${deviceId}/media_player/state`,
      command_topic: `${deviceId}/media_player/power/set`,
      volume_level_state_topic: `${deviceId}/media_player/volume/state`,
      volume_level_command_topic: `${deviceId}/media_player/volume/set`,
      is_volume_muted_state_topic: `${deviceId}/media_player/mute/state`,
      mute_command_topic: `${deviceId}/media_player/mute/set`,
      source_state_topic: `${deviceId}/media_player/source/state`,
      source_command_topic: `${deviceId}/media_player/source/set`,
      source_list_topic: `${deviceId}/media_player/source_list/state`,
      media_playback_command_topic: `${deviceId}/media_player/media/set`,
      payload_on: 'ON',
      payload_off: 'OFF',
      payload_mute: 'ON',
      payload_unmute: 'OFF',
      icon: 'mdi:television'
    });

    // 2. Remote
    this.publish(`${prefix}/remote/${deviceId}/remote/config`, {
      name: 'Remote',
      has_entity_name: true,
      unique_id: `${deviceId}_remote`,
      device,
      availability_topic: availTopic,
      state_topic: `${deviceId}/remote/state`,
      command_topic: `${deviceId}/remote/power/set`,
      send_command_topic: `${deviceId}/remote/send_command`,
      icon: 'mdi:remote-tv'
    });

    // 3. Complete TV Control Buttons (All Remote Controls)
    const buttons = [
      { id: 'power_on', name: 'Power On (WoL)', icon: 'mdi:power' },
      { id: 'power_off', name: 'Power Off', icon: 'mdi:power-off' },
      { id: 'screen_off', name: 'Turn Screen Off', icon: 'mdi:television-ambient-light' },
      { id: 'screen_on', name: 'Turn Screen On', icon: 'mdi:television-guide' },
      { id: 'dpad_up', name: 'D-Pad Up', icon: 'mdi:chevron-up' },
      { id: 'dpad_down', name: 'D-Pad Down', icon: 'mdi:chevron-down' },
      { id: 'dpad_left', name: 'D-Pad Left', icon: 'mdi:chevron-left' },
      { id: 'dpad_right', name: 'D-Pad Right', icon: 'mdi:chevron-right' },
      { id: 'dpad_enter', name: 'D-Pad Enter / OK', icon: 'mdi:checkbox-marked-circle-outline' },
      { id: 'nav_back', name: 'Back', icon: 'mdi:arrow-left' },
      { id: 'nav_home', name: 'Home', icon: 'mdi:home' },
      { id: 'nav_menu', name: 'Menu', icon: 'mdi:cog' },
      { id: 'nav_exit', name: 'Exit', icon: 'mdi:close-circle-outline' },
      { id: 'vol_up', name: 'Volume Up', icon: 'mdi:volume-plus' },
      { id: 'vol_down', name: 'Volume Down', icon: 'mdi:volume-minus' },
      { id: 'vol_mute', name: 'Mute Toggle', icon: 'mdi:volume-mute' },
      { id: 'chan_up', name: 'Channel Up', icon: 'mdi:arrow-up-drop-circle-outline' },
      { id: 'chan_down', name: 'Channel Down', icon: 'mdi:arrow-down-drop-circle-outline' },
      { id: 'nav_info', name: 'Info', icon: 'mdi:information-outline' },
      { id: 'nav_guide', name: 'Guide', icon: 'mdi:television-guide' },
      { id: 'nav_cc', name: 'Closed Captions', icon: 'mdi:closed-caption' },
      { id: 'input_source', name: 'Input / Source', icon: 'mdi:video-input-hdmi' },
      { id: 'media_play', name: 'Play', icon: 'mdi:play' },
      { id: 'media_pause', name: 'Pause', icon: 'mdi:pause' },
      { id: 'media_stop', name: 'Stop', icon: 'mdi:stop' },
      { id: 'media_rewind', name: 'Rewind', icon: 'mdi:rewind' },
      { id: 'media_fastforward', name: 'Fast Forward', icon: 'mdi:fast-forward' },
      { id: 'app_youtube', name: 'YouTube', icon: 'mdi:youtube' },
      { id: 'app_netflix', name: 'Netflix', icon: 'mdi:netflix' },
      { id: 'app_spotify', name: 'Spotify', icon: 'mdi:spotify' },
      { id: 'app_browser', name: 'Web Browser', icon: 'mdi:web' },
      { id: 'app_livetv', name: 'Live TV', icon: 'mdi:television-classic' },
      { id: 'app_store', name: 'LG Content Store', icon: 'mdi:shopping' },
      { id: 'color_red', name: 'Red Key', icon: 'mdi:circle' },
      { id: 'color_green', name: 'Green Key', icon: 'mdi:circle' },
      { id: 'color_yellow', name: 'Yellow Key', icon: 'mdi:circle' },
      { id: 'color_blue', name: 'Blue Key', icon: 'mdi:circle' },
      { id: 'hdmi_1', name: 'HDMI 1', icon: 'mdi:video-input-hdmi' },
      { id: 'hdmi_2', name: 'HDMI 2', icon: 'mdi:video-input-hdmi' },
      { id: 'hdmi_3', name: 'HDMI 3', icon: 'mdi:video-input-hdmi' }
    ];

    buttons.forEach((btn) => {
      this.publish(`${prefix}/button/${deviceId}/${btn.id}/config`, {
        name: btn.name,
        has_entity_name: true,
        unique_id: `${deviceId}_btn_${btn.id}`,
        device,
        availability_topic: availTopic,
        command_topic: `${deviceId}/button/${btn.id}/set`,
        icon: btn.icon
      });
    });

    // Unregister legacy number buttons (0-9, dash) from MQTT broker so Home Assistant removes them
    ['num_0', 'num_1', 'num_2', 'num_3', 'num_4', 'num_5', 'num_6', 'num_7', 'num_8', 'num_9', 'num_dash'].forEach((id) => {
      this.publish(`${prefix}/button/${deviceId}/${id}/config`, '', { retain: true });
    });

    // 4. Select Source
    this.publish(`${prefix}/select/${deviceId}/source/config`, {
      name: 'Input Source',
      has_entity_name: true,
      unique_id: `${deviceId}_select_source`,
      device,
      availability_topic: availTopic,
      command_topic: `${deviceId}/select/source/set`,
      state_topic: `${deviceId}/select/source/state`,
      options: this.knownSources,
      icon: 'mdi:video-input-hdmi'
    });

    // 5. Binary Sensors & Sensors
    this.publish(`${prefix}/binary_sensor/${deviceId}/power/config`, {
      name: 'Power',
      has_entity_name: true,
      unique_id: `${deviceId}_bs_power`,
      device,
      availability_topic: availTopic,
      state_topic: `${deviceId}/binary_sensor/power/state`,
      payload_on: 'ON',
      payload_off: 'OFF',
      device_class: 'power',
      icon: 'mdi:power'
    });

    this.publish(`${prefix}/binary_sensor/${deviceId}/connectivity/config`, {
      name: 'Connectivity',
      has_entity_name: true,
      unique_id: `${deviceId}_bs_connectivity`,
      device,
      availability_topic: availTopic,
      state_topic: `${deviceId}/binary_sensor/connectivity/state`,
      payload_on: 'ON',
      payload_off: 'OFF',
      device_class: 'connectivity',
      icon: 'mdi:wifi'
    });

    this.publish(`${prefix}/binary_sensor/${deviceId}/muted/config`, {
      name: 'Muted',
      has_entity_name: true,
      unique_id: `${deviceId}_bs_muted`,
      device,
      availability_topic: availTopic,
      state_topic: `${deviceId}/binary_sensor/muted/state`,
      payload_on: 'ON',
      payload_off: 'OFF',
      icon: 'mdi:volume-mute'
    });

    this.publish(`${prefix}/sensor/${deviceId}/current_app/config`, {
      name: 'Current App',
      has_entity_name: true,
      unique_id: `${deviceId}_s_current_app`,
      device,
      availability_topic: availTopic,
      state_topic: `${deviceId}/sensor/current_app/state`,
      icon: 'mdi:application'
    });

    this.publish(`${prefix}/sensor/${deviceId}/volume/config`, {
      name: 'Volume',
      has_entity_name: true,
      unique_id: `${deviceId}_s_volume`,
      device,
      availability_topic: availTopic,
      state_topic: `${deviceId}/sensor/volume/state`,
      unit_of_measurement: '%',
      icon: 'mdi:volume-high'
    });

    // 6. Text Entity (Typing)
    this.publish(`${prefix}/text/${deviceId}/typing/config`, {
      name: 'Virtual Keyboard',
      has_entity_name: true,
      unique_id: `${deviceId}_text_typing`,
      device,
      availability_topic: availTopic,
      command_topic: `${deviceId}/text/typing/set`,
      state_topic: `${deviceId}/text/typing/state`,
      mode: 'text',
      icon: 'mdi:keyboard'
    });
  }

  attachTVListeners() {
    tv.on('statusChanged', (status) => {
      this.syncState(status);
    });

    tv.on('connect', () => {
      this.syncState();
      tv.getApps().then((apps) => {
        if (apps && apps.length) {
          this.cachedApps = apps;
          const titles = apps.map((a) => a.title || a.id);
          const combined = Array.from(new Set([...this.knownSources, ...titles]));
          this.publish(`${this.getDeviceId()}/media_player/source_list/state`, combined);
        }
      }).catch(() => {});
    });

    tv.on('close', () => this.syncState());
    tv.on('error', () => this.syncState());
  }

  syncState(status) {
    const s = status || tv.getStatus();
    const deviceId = this.getDeviceId();

    const isConnected = Boolean(s.connected);
    const volume = s.volume !== null && s.volume !== undefined ? s.volume : 0;
    const isMuted = Boolean(s.muted);
    const currentApp = s.currentApp || 'None';

    const powerState = isConnected ? 'on' : 'off';
    this.publish(`${deviceId}/media_player/state`, powerState);
    this.publish(`${deviceId}/remote/state`, powerState);
    this.publish(`${deviceId}/media_player/volume/state`, (volume / 100).toFixed(2));
    this.publish(`${deviceId}/media_player/mute/state`, isMuted ? 'ON' : 'OFF');
    this.publish(`${deviceId}/media_player/source/state`, currentApp);
    this.publish(`${deviceId}/select/source/state`, currentApp);

    this.publish(`${deviceId}/binary_sensor/power/state`, isConnected ? 'ON' : 'OFF');
    this.publish(`${deviceId}/binary_sensor/connectivity/state`, isConnected ? 'ON' : 'OFF');
    this.publish(`${deviceId}/binary_sensor/muted/state`, isMuted ? 'ON' : 'OFF');

    this.publish(`${deviceId}/sensor/current_app/state`, currentApp);
    this.publish(`${deviceId}/sensor/volume/state`, String(volume));
  }

  // --- MQTT COMMAND HANDLER ---
  async handleMqttMessage(topic, payload) {
    if (!topic) return;
    const deviceId = this.getDeviceId();
    if (!topic.startsWith(deviceId)) return;

    const subTopic = topic.substring(deviceId.length);
    console.log(`[HA-Bridge] MQTT Command [${topic}]: "${payload}"`);

    try {
      // 1. Remote Send Command topic (e.g. /remote/send_command)
      if (subTopic === '/remote/send_command') {
        let commands = [];
        try {
          const parsed = JSON.parse(payload);
          if (Array.isArray(parsed)) {
            commands = parsed;
          } else if (parsed && parsed.command) {
            commands = Array.isArray(parsed.command) ? parsed.command : [parsed.command];
          } else if (typeof parsed === 'string') {
            commands = [parsed];
          } else {
            commands = [payload];
          }
        } catch (e) {
          commands = String(payload).split(',').map((c) => c.trim()).filter(Boolean);
        }

        for (const cmd of commands) {
          await this.executeRemoteCommand(cmd);
        }
        return;
      }

      // 2. Power on/off topics
      if (subTopic === '/remote/power/set' || subTopic === '/media_player/power/set' || subTopic === '/power/set') {
        const p = String(payload).trim().toUpperCase();
        if (p === 'ON' || p === '1' || p === 'TRUE' || p === 'WOL') {
          await tv.turnOn();
        } else if (p === 'OFF' || p === '0' || p === 'FALSE') {
          await tv.turnOff();
        } else if (p === 'TOGGLE') {
          if (tv.getStatus().connected) await tv.turnOff();
          else await tv.turnOn();
        }
        return;
      }

      // 3. Media Player Volume
      if (subTopic === '/media_player/volume/set' || subTopic === '/volume/set') {
        const floatVol = parseFloat(payload);
        if (!isNaN(floatVol)) {
          const intVol = floatVol <= 1.0 && floatVol > 0 ? Math.round(floatVol * 100) : Math.round(floatVol);
          await tv.setVolume(intVol);
        }
        return;
      }

      // 4. Media Player Mute
      if (subTopic === '/media_player/mute/set' || subTopic === '/mute/set') {
        const p = String(payload).trim().toUpperCase();
        if (p === 'ON' || p === '1' || p === 'TRUE' || p === 'MUTE') {
          await tv.setMute(true);
        } else if (p === 'OFF' || p === '0' || p === 'FALSE' || p === 'UNMUTE') {
          await tv.setMute(false);
        } else if (p === 'TOGGLE') {
          await tv.setMute(!tv.getStatus().muted);
        }
        return;
      }

      // 5. Source / App Launch
      if (subTopic === '/media_player/source/set' || subTopic === '/select/source/set' || subTopic === '/source/set') {
        await this.launchSource(payload);
        return;
      }

      // 6. Media Playback
      if (subTopic === '/media_player/media/set' || subTopic === '/media/set') {
        const cmd = String(payload).trim().toUpperCase();
        if (cmd === 'PLAY') await tv.play();
        else if (cmd === 'PAUSE') await tv.pause();
        else if (cmd === 'STOP') await tv.stop();
        else if (cmd === 'NEXT' || cmd === 'FAST_FORWARD' || cmd === 'FASTFORWARD') await tv.fastForward();
        else if (cmd === 'PREVIOUS' || cmd === 'REWIND') await tv.rewind();
        else if (cmd === 'PLAY_PAUSE' || cmd === 'TOGGLE') await tv.play();
        return;
      }

      // 7. Virtual Keyboard Typing
      if (subTopic === '/text/typing/set' || subTopic === '/keyboard/type') {
        await tv.sendText(payload);
        this.publish(`${deviceId}/text/typing/state`, payload);
        return;
      }

      if (subTopic === '/keyboard/enter') {
        await tv.sendEnter();
        return;
      }

      if (subTopic === '/keyboard/backspace') {
        const count = parseInt(payload, 10) || 1;
        await tv.sendBackspace(count);
        return;
      }

      // 8. Toast Notifications
      if (subTopic === '/toast/set' || subTopic === '/toast') {
        await tv.showToast(payload);
        return;
      }

      // 9. YouTube Launch
      if (subTopic === '/youtube/set' || subTopic === '/youtube') {
        await tv.openYoutube(payload);
        return;
      }

      // 10. Buttons (/button/<btn_id>/set or /button/<btn_id>)
      if (subTopic.startsWith('/button/')) {
        const parts = subTopic.split('/');
        const btnId = parts[2];
        if (btnId) {
          await this.executeButtonAction(btnId);
        }
        return;
      }
    } catch (err) {
      console.error(`[HA-Bridge] MQTT command error on [${topic}]:`, err.message);
    }
  }

  // --- BUTTON ACTION EXECUTION ---
  async executeButtonAction(btnId) {
    const id = String(btnId).toLowerCase().trim();
    console.log(`[HA-Bridge] Executing button action: "${id}"`);

    switch (id) {
      // Power & Screen
      case 'power_on':
      case 'wol':
      case 'power_on_wol':
        return tv.turnOn();
      case 'power_off':
        return tv.turnOff();
      case 'screen_off':
      case 'turn_screen_off':
        return tv.turnScreenOff();
      case 'screen_on':
      case 'turn_screen_on':
        return tv.turnScreenOn();

      // D-Pad Navigation
      case 'dpad_up':
      case 'up':
        return tv.sendButton('UP');
      case 'dpad_down':
      case 'down':
        return tv.sendButton('DOWN');
      case 'dpad_left':
      case 'left':
        return tv.sendButton('LEFT');
      case 'dpad_right':
      case 'right':
        return tv.sendButton('RIGHT');
      case 'dpad_enter':
      case 'enter':
      case 'ok':
      case 'select':
        return tv.sendButton('ENTER');

      // Navigation & Menu
      case 'nav_back':
      case 'back':
        return tv.sendButton('BACK');
      case 'nav_home':
      case 'home':
        return tv.sendButton('HOME');
      case 'nav_menu':
      case 'menu':
      case 'settings':
        return tv.sendButton('MENU');
      case 'nav_exit':
      case 'exit':
        return tv.sendButton('EXIT');
      case 'nav_info':
      case 'info':
        return tv.sendButton('INFO');
      case 'nav_guide':
      case 'guide':
        return tv.sendButton('GUIDE');
      case 'nav_cc':
      case 'cc':
      case 'captions':
        return tv.sendButton('CC');

      // Volume & Channels
      case 'vol_up':
      case 'volume_up':
        return tv.volumeUp();
      case 'vol_down':
      case 'volume_down':
        return tv.volumeDown();
      case 'vol_mute':
      case 'mute':
        return tv.setMute(!tv.getStatus().muted);
      case 'chan_up':
      case 'channel_up':
        return tv.channelUp();
      case 'chan_down':
      case 'channel_down':
        return tv.channelDown();

      // Keypad Numbers (0-9, Dash)
      case 'num_0':
      case '0':
        return tv.sendButton('0');
      case 'num_1':
      case '1':
        return tv.sendButton('1');
      case 'num_2':
      case '2':
        return tv.sendButton('2');
      case 'num_3':
      case '3':
        return tv.sendButton('3');
      case 'num_4':
      case '4':
        return tv.sendButton('4');
      case 'num_5':
      case '5':
        return tv.sendButton('5');
      case 'num_6':
      case '6':
        return tv.sendButton('6');
      case 'num_7':
      case '7':
        return tv.sendButton('7');
      case 'num_8':
      case '8':
        return tv.sendButton('8');
      case 'num_9':
      case '9':
        return tv.sendButton('9');
      case 'num_dash':
      case 'dash':
        return tv.sendButton('DASH');

      // Quick Apps
      case 'app_youtube':
      case 'youtube':
        return tv.openYoutube('');
      case 'app_netflix':
      case 'netflix':
        return tv.launchApp('netflix');
      case 'app_spotify':
      case 'spotify':
        return tv.launchApp('spotify-beehive');
      case 'app_browser':
      case 'browser':
      case 'web_browser':
        return tv.launchApp('com.webos.app.browser');
      case 'app_livetv':
      case 'livetv':
      case 'live_tv':
        return tv.launchApp('com.webos.app.livetv');
      case 'app_store':
      case 'store':
      case 'app_store':
        return tv.launchApp('com.webos.app.discovery');

      // Media Controls
      case 'media_play':
      case 'play':
        return tv.play();
      case 'media_pause':
      case 'pause':
        return tv.pause();
      case 'media_stop':
      case 'stop':
        return tv.stop();
      case 'media_rewind':
      case 'rewind':
        return tv.rewind();
      case 'media_fastforward':
      case 'fastforward':
      case 'fast_forward':
        return tv.fastForward();

      // Color Keys
      case 'color_red':
      case 'red':
      case 'red_key':
        return tv.sendButton('RED');
      case 'color_green':
      case 'green':
      case 'green_key':
        return tv.sendButton('GREEN');
      case 'color_yellow':
      case 'yellow':
      case 'yellow_key':
        return tv.sendButton('YELLOW');
      case 'color_blue':
      case 'blue':
      case 'blue_key':
        return tv.sendButton('BLUE');

      // HDMI Inputs
      case 'input_source':
      case 'input':
        return tv.sendButton('INPUT');
      case 'hdmi_1':
      case 'hdmi1':
        return tv.setInput('HDMI_1');
      case 'hdmi_2':
      case 'hdmi2':
        return tv.setInput('HDMI_2');
      case 'hdmi_3':
      case 'hdmi3':
        return tv.setInput('HDMI_3');

      default:
        console.warn(`[HA-Bridge] Fallback executing button "${btnId}" via sendButton`);
        return tv.sendButton(btnId.toUpperCase());
    }
  }

  // --- SERVICE CALL EVENT DISPATCHER ---
  async handleServiceCall(data) {
    if (!data || !data.domain) return;
    const { domain, service, service_data } = data;

    // 0. Forward internal MQTT publish service calls
    if (domain === 'mqtt' && service === 'publish' && service_data && service_data.topic) {
      await this.handleMqttMessage(service_data.topic, String(service_data.payload || '').trim());
      return;
    }

    const entityId = (service_data && (service_data.entity_id || service_data.entity_ids)) ? String(service_data.entity_id || service_data.entity_ids) : '';
    const deviceId = (service_data && service_data.device_id) ? String(service_data.device_id) : '';

    const entLower = entityId.toLowerCase();
    const isLgTvService = domain === 'lg_webos_smart_remote';
    const isLgEntity = !entityId || 
                       entLower.includes('lg') || 
                       entLower.includes('webos') || 
                       entLower.includes('tv') ||
                       entLower.includes('remote') ||
                       entLower.includes('living_room') ||
                       entLower.includes('d_pad') ||
                       entLower.includes('dpad') ||
                       entLower.includes('screen') ||
                       entLower.includes('power') ||
                       entLower.includes('vol') ||
                       entLower.includes('chan') ||
                       entLower.includes('media_') ||
                       entLower.includes('app_') ||
                       entLower.includes('color_') ||
                       entLower.includes('hdmi') ||
                       entLower.includes('num_') ||
                       deviceId.includes('cf7f119552f98a0ff46ed71a59071a96') ||
                       deviceId.includes('774cdec99cfdca039dd668ddb5697e46');

    if (!isLgTvService && !isLgEntity) {
      return;
    }

    console.log(`[HA-Bridge] Handling HA Service Call: [${domain}.${service}] on ${entityId || deviceId}`);

    try {
      // 1. Custom lg_webos_smart_remote Domain Services
      if (domain === 'lg_webos_smart_remote') {
        if (service === 'send_button' && service_data.button) await this.executeRemoteCommand(service_data.button);
        else if (service === 'send_text' && service_data.text) await tv.sendText(service_data.text);
        else if (service === 'show_toast' && service_data.message) await tv.showToast(service_data.message, service_data.icon);
        else if (service === 'screen_off') await tv.turnScreenOff();
        else if (service === 'screen_on') await tv.turnScreenOn();
        else if (service === 'open_youtube') await tv.openYoutube(service_data.video_id || service_data.url || '');
        else if (service === 'turn_on') await tv.turnOn();
        else if (service === 'turn_off') await tv.turnOff();
        return;
      }

      // 2. Button Entity Presses
      if (domain === 'button' && service === 'press') {
        const ent = entityId.toLowerCase();
        const matched = [
          'power_on', 'power_off', 'screen_off', 'screen_on',
          'dpad_up', 'dpad_down', 'dpad_left', 'dpad_right', 'dpad_enter',
          'nav_back', 'nav_home', 'nav_menu', 'nav_exit', 'nav_info', 'nav_guide', 'nav_cc',
          'vol_up', 'vol_down', 'vol_mute', 'chan_up', 'chan_down',
          'num_0', 'num_1', 'num_2', 'num_3', 'num_4', 'num_5', 'num_6', 'num_7', 'num_8', 'num_9', 'num_dash',
          'app_youtube', 'app_netflix', 'app_spotify', 'app_browser', 'app_livetv', 'app_store',
          'media_play', 'media_pause', 'media_stop', 'media_rewind', 'media_fastforward',
          'color_red', 'color_green', 'color_yellow', 'color_blue',
          'input_source', 'hdmi_1', 'hdmi_2', 'hdmi_3'
        ].find((k) => ent.endsWith(`_${k}`) || ent.includes(`btn_${k}`) || ent.includes(k));

        if (matched) {
          await this.executeButtonAction(matched);
        } else {
          if (ent.includes('power_on') || ent.includes('wol')) await tv.turnOn();
          else if (ent.includes('power_off')) await tv.turnOff();
          else if (ent.includes('screen_off')) await tv.turnScreenOff();
          else if (ent.includes('screen_on')) await tv.turnScreenOn();
          else if (ent.includes('up')) await tv.sendButton('UP');
          else if (ent.includes('down')) await tv.sendButton('DOWN');
          else if (ent.includes('left')) await tv.sendButton('LEFT');
          else if (ent.includes('right')) await tv.sendButton('RIGHT');
          else if (ent.includes('enter') || ent.includes('ok')) await tv.sendButton('ENTER');
          else if (ent.includes('back')) await tv.sendButton('BACK');
          else if (ent.includes('home')) await tv.sendButton('HOME');
          else if (ent.includes('menu')) await tv.sendButton('MENU');
          else if (ent.includes('exit')) await tv.sendButton('EXIT');
          else if (ent.includes('vol_up') || ent.includes('volume_up')) await tv.volumeUp();
          else if (ent.includes('vol_down') || ent.includes('volume_down')) await tv.volumeDown();
          else if (ent.includes('mute')) await tv.setMute(!tv.getStatus().muted);
        }
        return;
      }

      // 3. Media Player Actions
      if (domain === 'media_player') {
        if (service === 'turn_on') await tv.turnOn();
        else if (service === 'turn_off') await tv.turnOff();
        else if (service === 'toggle') {
          if (tv.getStatus().connected) await tv.turnOff();
          else await tv.turnOn();
        }
        else if (service === 'volume_up') await tv.volumeUp();
        else if (service === 'volume_down') await tv.volumeDown();
        else if (service === 'volume_set' && service_data.volume_level !== undefined) {
          await tv.setVolume(Math.round(service_data.volume_level * 100));
        } else if (service === 'volume_mute') {
          await tv.setMute(Boolean(service_data.is_volume_muted));
        } else if (service === 'select_source' && service_data.source) {
          await this.launchSource(service_data.source);
        } else if (service === 'media_play') await tv.play();
        else if (service === 'media_pause') await tv.pause();
        else if (service === 'media_stop') await tv.stop();
        else if (service === 'media_next_track') await tv.fastForward();
        else if (service === 'media_previous_track') await tv.rewind();
        else if (service === 'media_play_pause') await tv.play();
        return;
      }

      // 4. Remote Commands
      if (domain === 'remote') {
        if (service === 'turn_on') await tv.turnOn();
        else if (service === 'turn_off') await tv.turnOff();
        else if (service === 'toggle') {
          if (tv.getStatus().connected) await tv.turnOff();
          else await tv.turnOn();
        }
        else if (service === 'send_command') {
          const cmds = Array.isArray(service_data.command) ? service_data.command : [service_data.command];
          for (const cmd of cmds) {
            await this.executeRemoteCommand(cmd);
          }
        }
        return;
      }

      // 5. Select Source Option
      if (domain === 'select' && service === 'select_option' && service_data.option) {
        await this.launchSource(service_data.option);
        return;
      }

      // 6. Virtual Keyboard Typing
      if (domain === 'text' && service === 'set_value' && service_data.value) {
        await tv.sendText(service_data.value);
        return;
      }
    } catch (err) {
      console.error('[HA-Bridge] Service call error:', err.message);
    }
  }

  async launchSource(sourceName) {
    const raw = String(sourceName).trim();
    const matchingApp = this.cachedApps.find((a) => (a.title && a.title.toLowerCase() === raw.toLowerCase()) || a.id === raw);
    if (matchingApp) return tv.launchApp(matchingApp.id);

    const lower = raw.toLowerCase();
    if (lower.includes('youtube')) return tv.openYoutube('');
    if (lower.includes('netflix')) return tv.launchApp('netflix');
    if (lower.includes('spotify')) return tv.launchApp('spotify-beehive');
    if (lower.includes('browser') || lower.includes('web')) return tv.launchApp('com.webos.app.browser');
    if (lower.includes('home')) return tv.launchApp('com.webos.app.home');
    if (lower.includes('live') || lower.includes('tv')) return tv.launchApp('com.webos.app.livetv');
    if (lower.startsWith('hdmi')) return tv.setInput(raw.toUpperCase());

    return tv.launchApp(raw);
  }

  async executeRemoteCommand(cmd) {
    if (!cmd) return;
    const formatted = String(cmd).trim().toUpperCase();
    console.log(`[HA-Bridge] Executing remote command: "${formatted}"`);

    switch (formatted) {
      // D-Pad
      case 'UP':
      case 'DOWN':
      case 'LEFT':
      case 'RIGHT':
      case 'ENTER':
      case 'OK':
      case 'SELECT':
      // Navigation
      case 'BACK':
      case 'HOME':
      case 'MENU':
      case 'SETTINGS':
      case 'EXIT':
      case 'INFO':
      case 'GUIDE':
      case 'CC':
      case 'DASH':
      // Numbers
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
      // Colors
      case 'RED':
      case 'GREEN':
      case 'YELLOW':
      case 'BLUE':
      // Input
      case 'INPUT':
      case 'INPUT_SOURCE':
        return tv.sendButton(formatted === 'OK' || formatted === 'SELECT' ? 'ENTER' : formatted === 'SETTINGS' ? 'MENU' : formatted === 'INPUT_SOURCE' ? 'INPUT' : formatted);

      // Volume
      case 'VOLUME_UP':
      case 'VOLUMEUP':
      case 'VOLUP':
      case 'VOL_UP':
        return tv.volumeUp();
      case 'VOLUME_DOWN':
      case 'VOLUMEDOWN':
      case 'VOLDOWN':
      case 'VOL_DOWN':
        return tv.volumeDown();
      case 'MUTE':
      case 'VOLUMEMUTE':
      case 'VOLUME_MUTE':
      case 'TOGGLE_MUTE':
        return tv.setMute(!tv.getStatus().muted);

      // Channels
      case 'CHANNEL_UP':
      case 'CHANNELUP':
      case 'CHANUP':
      case 'CHAN_UP':
        return tv.channelUp();
      case 'CHANNEL_DOWN':
      case 'CHANNELDOWN':
      case 'CHANDOWN':
      case 'CHAN_DOWN':
        return tv.channelDown();

      // Playback
      case 'PLAY':
        return tv.play();
      case 'PAUSE':
        return tv.pause();
      case 'STOP':
        return tv.stop();
      case 'REWIND':
      case 'PREVIOUS':
        return tv.rewind();
      case 'FAST_FORWARD':
      case 'FASTFORWARD':
      case 'NEXT':
        return tv.fastForward();

      // Power
      case 'POWER':
      case 'POWER_OFF':
      case 'POWEROFF':
      case 'OFF':
        return tv.turnOff();
      case 'POWER_ON':
      case 'POWERON':
      case 'ON':
      case 'WOL':
        return tv.turnOn();

      // Screen Off / On
      case 'SCREEN_OFF':
      case 'SCREENOFF':
        return tv.turnScreenOff();
      case 'SCREEN_ON':
      case 'SCREENON':
        return tv.turnScreenOn();

      // HDMI Inputs
      case 'HDMI_1':
      case 'HDMI1':
        return tv.setInput('HDMI_1');
      case 'HDMI_2':
      case 'HDMI2':
        return tv.setInput('HDMI_2');
      case 'HDMI_3':
      case 'HDMI3':
        return tv.setInput('HDMI_3');

      // Apps
      case 'YOUTUBE':
        return tv.openYoutube('');
      case 'NETFLIX':
        return tv.launchApp('netflix');
      case 'SPOTIFY':
        return tv.launchApp('spotify-beehive');
      case 'BROWSER':
      case 'WEB':
        return tv.launchApp('com.webos.app.browser');
      case 'LIVETV':
      case 'LIVE_TV':
        return tv.launchApp('com.webos.app.livetv');
      case 'STORE':
      case 'APP_STORE':
        return tv.launchApp('com.webos.app.discovery');

      default:
        return tv.sendButton(formatted);
    }
  }
}

const haBridge = new HomeAssistantBridge();
module.exports = haBridge;
