const mqtt = require('mqtt');
const tv = require('./lgtv');
const { getConfig } = require('./config');

class HomeAssistantBridge {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectTimer = null;
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
      sw_version: 'webOS 1.0.2',
      suggested_area: config.deviceArea || 'Living Room',
      configuration_url: config.tvIp ? `http://${config.tvIp}` : undefined
    };
  }

  start() {
    const config = getConfig();
    if (config.mqttEnabled === false) {
      console.log('[HA-Bridge] MQTT Device Integration is disabled in config.');
      return;
    }

    const host = config.mqttHost || '127.0.0.1';
    const port = config.mqttPort || 1883;
    const user = config.mqttUser || '';
    const pass = config.mqttPassword || '';

    const protocol = host.startsWith('mqtt://') || host.startsWith('ws://') || host.startsWith('wss://') ? '' : 'mqtt://';
    const brokerUrl = `${protocol}${host}:${port}`;

    console.log(`[HA-Bridge] Connecting to Home Assistant MQTT broker at ${brokerUrl}...`);
    this.isConnecting = true;

    const options = {
      clientId: `lg_tv_ha_bridge_${Math.random().toString(16).substring(2, 8)}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
      will: {
        topic: `${this.getDeviceId()}/availability`,
        payload: 'offline',
        qos: 1,
        retain: true
      }
    };

    if (user) options.username = user;
    if (pass) options.password = pass;

    try {
      this.client = mqtt.connect(brokerUrl, options);

      this.client.on('connect', () => {
        console.log('[HA-Bridge] Connected to Home Assistant MQTT Broker!');
        this.isConnected = true;
        this.isConnecting = false;

        // Publish availability online
        this.publish(`${this.getDeviceId()}/availability`, 'online', { retain: true });

        // Register Home Assistant Device and all Entities
        this.publishDiscovery();

        // Subscribe to all command topics
        this.subscribeCommandTopics();

        // Sync initial state
        this.syncState();
      });

      this.client.on('message', (topic, message) => {
        this.handleCommand(topic, message.toString().trim());
      });

      this.client.on('error', (err) => {
        if (!this.isConnected) {
          // Log softly on first connect attempts
          console.warn('[HA-Bridge] MQTT Connection notice:', err.message);
        } else {
          console.error('[HA-Bridge] MQTT Error:', err.message);
        }
      });

      this.client.on('close', () => {
        if (this.isConnected) {
          console.log('[HA-Bridge] MQTT connection closed. Reconnecting...');
        }
        this.isConnected = false;
      });
    } catch (err) {
      console.warn('[HA-Bridge] Failed to initialize MQTT client:', err.message);
    }

    // Attach TV event listeners for real-time state sync
    this.attachTVListeners();
  }

  publish(topic, payload, options = {}) {
    if (!this.client || !this.isConnected) return;
    const strPayload = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
    this.client.publish(topic, strPayload, { qos: 0, ...options });
  }

  attachTVListeners() {
    tv.on('statusChanged', (status) => {
      this.syncState(status);
    });

    tv.on('connect', () => {
      this.syncState();
      // Fetch latest apps to update source select options
      tv.getApps().then((apps) => {
        if (apps && apps.length) {
          this.updateAppSources(apps);
        }
      }).catch(() => {});
    });

    tv.on('close', () => {
      this.syncState();
    });

    tv.on('error', () => {
      this.syncState();
    });
  }

  updateAppSources(apps) {
    this.cachedApps = apps;
    const appIds = apps.map((a) => a.title || a.id);
    const combined = Array.from(new Set([...this.knownSources, ...appIds]));
    this.publish(`${this.getDeviceId()}/select/source/options`, JSON.stringify(combined), { retain: true });
    this.publish(`${this.getDeviceId()}/media_player/source_list/state`, JSON.stringify(combined), { retain: true });
  }

  publishDiscovery() {
    const config = getConfig();
    const prefix = config.mqttDiscoveryPrefix || 'homeassistant';
    const deviceId = this.getDeviceId();
    const device = this.getDevicePayload();
    const availTopic = `${deviceId}/availability`;

    console.log(`[HA-Bridge] Publishing Home Assistant Device Discovery for "${device.name}" to "${prefix}/..."`);

    // 1. MEDIA PLAYER ENTITY
    const mediaPlayerConfig = {
      name: `${device.name}`,
      unique_id: `${deviceId}_media_player`,
      device: device,
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
    };
    this.publish(`${prefix}/media_player/${deviceId}/media_player/config`, mediaPlayerConfig, { retain: true });

    // 2. REMOTE ENTITY
    const remoteConfig = {
      name: `${device.name} Remote`,
      unique_id: `${deviceId}_remote`,
      device: device,
      availability_topic: availTopic,
      state_topic: `${deviceId}/remote/state`,
      command_topic: `${deviceId}/remote/power/set`,
      send_command_topic: `${deviceId}/remote/send_command`,
      icon: 'mdi:remote-tv'
    };
    this.publish(`${prefix}/remote/${deviceId}/remote/config`, remoteConfig, { retain: true });

    // 3. BUTTON ENTITIES (Individual instant actions on HA dashboards)
    const buttons = [
      { id: 'power_on', name: 'Power On (WoL)', icon: 'mdi:power', topic: `${deviceId}/button/power_on/set` },
      { id: 'power_off', name: 'Power Off', icon: 'mdi:power-off', topic: `${deviceId}/button/power_off/set` },
      { id: 'screen_off', name: 'Turn Screen Off', icon: 'mdi:television-ambient-light', topic: `${deviceId}/button/screen_off/set` },
      { id: 'screen_on', name: 'Turn Screen On', icon: 'mdi:television-guide', topic: `${deviceId}/button/screen_on/set` },
      { id: 'dpad_up', name: 'D-Pad Up', icon: 'mdi:chevron-up', topic: `${deviceId}/button/dpad_up/set` },
      { id: 'dpad_down', name: 'D-Pad Down', icon: 'mdi:chevron-down', topic: `${deviceId}/button/dpad_down/set` },
      { id: 'dpad_left', name: 'D-Pad Left', icon: 'mdi:chevron-left', topic: `${deviceId}/button/dpad_left/set` },
      { id: 'dpad_right', name: 'D-Pad Right', icon: 'mdi:chevron-right', topic: `${deviceId}/button/dpad_right/set` },
      { id: 'dpad_enter', name: 'D-Pad Enter', icon: 'mdi:checkbox-marked-circle-outline', topic: `${deviceId}/button/dpad_enter/set` },
      { id: 'nav_back', name: 'Back', icon: 'mdi:arrow-left', topic: `${deviceId}/button/nav_back/set` },
      { id: 'nav_home', name: 'Home', icon: 'mdi:home', topic: `${deviceId}/button/nav_home/set` },
      { id: 'nav_menu', name: 'Menu', icon: 'mdi:cog', topic: `${deviceId}/button/nav_menu/set` },
      { id: 'nav_exit', name: 'Exit', icon: 'mdi:close-circle-outline', topic: `${deviceId}/button/nav_exit/set` },
      { id: 'vol_up', name: 'Volume Up', icon: 'mdi:volume-plus', topic: `${deviceId}/button/vol_up/set` },
      { id: 'vol_down', name: 'Volume Down', icon: 'mdi:volume-minus', topic: `${deviceId}/button/vol_down/set` },
      { id: 'vol_mute', name: 'Mute Toggle', icon: 'mdi:volume-mute', topic: `${deviceId}/button/vol_mute/set` },
      { id: 'chan_up', name: 'Channel Up', icon: 'mdi:arrow-up-drop-circle-outline', topic: `${deviceId}/button/chan_up/set` },
      { id: 'chan_down', name: 'Channel Down', icon: 'mdi:arrow-down-drop-circle-outline', topic: `${deviceId}/button/chan_down/set` },
      { id: 'app_youtube', name: 'YouTube', icon: 'mdi:youtube', topic: `${deviceId}/button/app_youtube/set` },
      { id: 'app_netflix', name: 'Netflix', icon: 'mdi:netflix', topic: `${deviceId}/button/app_netflix/set` },
      { id: 'app_spotify', name: 'Spotify', icon: 'mdi:spotify', topic: `${deviceId}/button/app_spotify/set` },
      { id: 'app_browser', name: 'Web Browser', icon: 'mdi:web', topic: `${deviceId}/button/app_browser/set` }
    ];

    buttons.forEach((btn) => {
      const btnConfig = {
        name: `${device.name} ${btn.name}`,
        unique_id: `${deviceId}_btn_${btn.id}`,
        device: device,
        availability_topic: availTopic,
        command_topic: btn.topic,
        icon: btn.icon
      };
      this.publish(`${prefix}/button/${deviceId}/${btn.id}/config`, btnConfig, { retain: true });
    });

    // 4. SELECT ENTITY (Input / App Source Selector)
    const selectConfig = {
      name: `${device.name} Input Source`,
      unique_id: `${deviceId}_select_source`,
      device: device,
      availability_topic: availTopic,
      command_topic: `${deviceId}/select/source/set`,
      state_topic: `${deviceId}/select/source/state`,
      options: this.knownSources,
      icon: 'mdi:video-input-hdmi'
    };
    this.publish(`${prefix}/select/${deviceId}/source/config`, selectConfig, { retain: true });

    // 5. SENSORS & BINARY SENSORS
    const binarySensors = [
      {
        id: 'power',
        name: 'Power',
        device_class: 'power',
        topic: `${deviceId}/binary_sensor/power/state`
      },
      {
        id: 'connectivity',
        name: 'Connectivity',
        device_class: 'connectivity',
        topic: `${deviceId}/binary_sensor/connectivity/state`
      },
      {
        id: 'muted',
        name: 'Muted',
        icon: 'mdi:volume-mute',
        topic: `${deviceId}/binary_sensor/muted/state`
      }
    ];

    binarySensors.forEach((bs) => {
      const bsConfig = {
        name: `${device.name} ${bs.name}`,
        unique_id: `${deviceId}_bs_${bs.id}`,
        device: device,
        availability_topic: availTopic,
        state_topic: bs.topic,
        payload_on: 'ON',
        payload_off: 'OFF',
        device_class: bs.device_class,
        icon: bs.icon
      };
      this.publish(`${prefix}/binary_sensor/${deviceId}/${bs.id}/config`, bsConfig, { retain: true });
    });

    const sensors = [
      {
        id: 'current_app',
        name: 'Current App',
        icon: 'mdi:application',
        topic: `${deviceId}/sensor/current_app/state`
      },
      {
        id: 'volume',
        name: 'Volume',
        icon: 'mdi:volume-high',
        unit_of_measurement: '%',
        topic: `${deviceId}/sensor/volume/state`
      }
    ];

    sensors.forEach((s) => {
      const sConfig = {
        name: `${device.name} ${s.name}`,
        unique_id: `${deviceId}_s_${s.id}`,
        device: device,
        availability_topic: availTopic,
        state_topic: s.topic,
        unit_of_measurement: s.unit_of_measurement,
        icon: s.icon
      };
      this.publish(`${prefix}/sensor/${deviceId}/${s.id}/config`, sConfig, { retain: true });
    });

    // 6. TEXT ENTITY (Direct Keyboard Typing)
    const textConfig = {
      name: `${device.name} Virtual Keyboard`,
      unique_id: `${deviceId}_text_typing`,
      device: device,
      availability_topic: availTopic,
      command_topic: `${deviceId}/text/typing/set`,
      state_topic: `${deviceId}/text/typing/state`,
      mode: 'text',
      icon: 'mdi:keyboard'
    };
    this.publish(`${prefix}/text/${deviceId}/typing/config`, textConfig, { retain: true });
  }

  subscribeCommandTopics() {
    const deviceId = this.getDeviceId();
    const topics = [
      `${deviceId}/media_player/power/set`,
      `${deviceId}/media_player/volume/set`,
      `${deviceId}/media_player/mute/set`,
      `${deviceId}/media_player/source/set`,
      `${deviceId}/media_player/media/set`,
      `${deviceId}/remote/power/set`,
      `${deviceId}/remote/send_command`,
      `${deviceId}/button/+/set`,
      `${deviceId}/select/source/set`,
      `${deviceId}/text/typing/set`,
      `${deviceId}/toast/set`
    ];

    topics.forEach((t) => {
      this.client.subscribe(t, (err) => {
        if (err) console.error(`[HA-Bridge] Error subscribing to ${t}:`, err.message);
      });
    });
  }

  syncState(status) {
    const s = status || tv.getStatus();
    const deviceId = this.getDeviceId();

    const isConnected = Boolean(s.connected);
    const volume = s.volume !== null && s.volume !== undefined ? s.volume : 0;
    const isMuted = Boolean(s.muted);
    const currentApp = s.currentApp || 'None';

    // Media Player State
    const powerState = isConnected ? 'on' : 'off';
    this.publish(`${deviceId}/media_player/state`, powerState, { retain: true });
    this.publish(`${deviceId}/remote/state`, powerState, { retain: true });
    this.publish(`${deviceId}/media_player/volume/state`, (volume / 100).toFixed(2), { retain: true });
    this.publish(`${deviceId}/media_player/mute/state`, isMuted ? 'ON' : 'OFF', { retain: true });
    this.publish(`${deviceId}/media_player/source/state`, currentApp, { retain: true });

    // Select State
    this.publish(`${deviceId}/select/source/state`, currentApp, { retain: true });

    // Binary Sensors
    this.publish(`${deviceId}/binary_sensor/power/state`, isConnected ? 'ON' : 'OFF', { retain: true });
    this.publish(`${deviceId}/binary_sensor/connectivity/state`, isConnected ? 'ON' : 'OFF', { retain: true });
    this.publish(`${deviceId}/binary_sensor/muted/state`, isMuted ? 'ON' : 'OFF', { retain: true });

    // Sensors
    this.publish(`${deviceId}/sensor/current_app/state`, currentApp, { retain: true });
    this.publish(`${deviceId}/sensor/volume/state`, String(volume), { retain: true });
  }

  async handleCommand(topic, payload) {
    const deviceId = this.getDeviceId();
    console.log(`[HA-Bridge] Received command on [${topic}]: "${payload}"`);

    try {
      // 1. Media Player Power
      if (topic === `${deviceId}/media_player/power/set` || topic === `${deviceId}/remote/power/set`) {
        if (payload.toUpperCase() === 'ON') {
          await tv.turnOn();
        } else {
          await tv.turnOff();
        }
        return;
      }

      // 2. Media Player Volume
      if (topic === `${deviceId}/media_player/volume/set`) {
        const floatVol = parseFloat(payload);
        const intVol = Math.round(floatVol * 100);
        await tv.setVolume(intVol);
        return;
      }

      // 3. Media Player Mute
      if (topic === `${deviceId}/media_player/mute/set`) {
        const mute = payload.toUpperCase() === 'ON';
        await tv.setMute(mute);
        return;
      }

      // 4. Media Player Source & Select Source
      if (topic === `${deviceId}/media_player/source/set` || topic === `${deviceId}/select/source/set`) {
        await this.launchSource(payload);
        return;
      }

      // 5. Media Playback Controls
      if (topic === `${deviceId}/media_player/media/set`) {
        const cmd = payload.toUpperCase();
        if (cmd === 'PLAY') await tv.play();
        else if (cmd === 'PAUSE') await tv.pause();
        else if (cmd === 'STOP') await tv.stop();
        else if (cmd === 'NEXT' || cmd === 'FAST_FORWARD') await tv.fastForward();
        else if (cmd === 'PREVIOUS' || cmd === 'REWIND') await tv.rewind();
        return;
      }

      // 6. Remote Send Command
      if (topic === `${deviceId}/remote/send_command`) {
        let commands = [];
        try {
          const parsed = JSON.parse(payload);
          if (Array.isArray(parsed)) commands = parsed;
          else if (parsed.command) {
            commands = Array.isArray(parsed.command) ? parsed.command : [parsed.command];
          } else {
            commands = [payload];
          }
        } catch (e) {
          commands = payload.split(',').map((c) => c.trim());
        }

        for (const cmd of commands) {
          await this.executeRemoteCommand(cmd);
        }
        return;
      }

      // 7. Text Input Typing
      if (topic === `${deviceId}/text/typing/set`) {
        await tv.sendText(payload);
        this.publish(`${deviceId}/text/typing/state`, payload);
        return;
      }

      // 8. Toast On-screen Alerts
      if (topic === `${deviceId}/toast/set`) {
        await tv.showToast(payload);
        return;
      }

      // 9. Buttons
      if (topic.startsWith(`${deviceId}/button/`)) {
        const btnAction = topic.split('/')[2];
        await this.executeButtonAction(btnAction);
        return;
      }
    } catch (err) {
      console.error(`[HA-Bridge] Command execution failed for ${topic}:`, err.message);
    }
  }

  async launchSource(sourceName) {
    const raw = sourceName.trim();
    // Check if it's an app title or ID
    const matchingApp = this.cachedApps.find((a) => (a.title && a.title.toLowerCase() === raw.toLowerCase()) || a.id === raw);
    if (matchingApp) {
      return tv.launchApp(matchingApp.id);
    }

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
    const formatted = String(cmd).trim().toUpperCase();
    switch (formatted) {
      case 'UP':
      case 'DOWN':
      case 'LEFT':
      case 'RIGHT':
      case 'ENTER':
      case 'BACK':
      case 'HOME':
      case 'MENU':
      case 'EXIT':
      case 'RED':
      case 'GREEN':
      case 'YELLOW':
      case 'BLUE':
        return tv.sendButton(formatted);
      case 'VOLUME_UP':
      case 'VOLUMEUP':
        return tv.volumeUp();
      case 'VOLUME_DOWN':
      case 'VOLUMEDOWN':
        return tv.volumeDown();
      case 'MUTE':
        return tv.setMute(!tv.getStatus().muted);
      case 'CHANNEL_UP':
      case 'CHANNELUP':
        return tv.channelUp();
      case 'CHANNEL_DOWN':
      case 'CHANNELDOWN':
        return tv.channelDown();
      case 'PLAY':
        return tv.play();
      case 'PAUSE':
        return tv.pause();
      case 'STOP':
        return tv.stop();
      case 'POWER':
      case 'POWER_OFF':
        return tv.turnOff();
      case 'POWER_ON':
        return tv.turnOn();
      default:
        return tv.sendButton(formatted);
    }
  }

  async executeButtonAction(btnId) {
    switch (btnId) {
      case 'power_on':
        return tv.turnOn();
      case 'power_off':
        return tv.turnOff();
      case 'screen_off':
        return tv.turnScreenOff();
      case 'screen_on':
        return tv.turnScreenOn();
      case 'dpad_up':
        return tv.sendButton('UP');
      case 'dpad_down':
        return tv.sendButton('DOWN');
      case 'dpad_left':
        return tv.sendButton('LEFT');
      case 'dpad_right':
        return tv.sendButton('RIGHT');
      case 'dpad_enter':
        return tv.sendButton('ENTER');
      case 'nav_back':
        return tv.sendButton('BACK');
      case 'nav_home':
        return tv.sendButton('HOME');
      case 'nav_menu':
        return tv.sendButton('MENU');
      case 'nav_exit':
        return tv.sendButton('EXIT');
      case 'vol_up':
        return tv.volumeUp();
      case 'vol_down':
        return tv.volumeDown();
      case 'vol_mute':
        return tv.setMute(!tv.getStatus().muted);
      case 'chan_up':
        return tv.channelUp();
      case 'chan_down':
        return tv.channelDown();
      case 'app_youtube':
        return tv.openYoutube('');
      case 'app_netflix':
        return tv.launchApp('netflix');
      case 'app_spotify':
        return tv.launchApp('spotify-beehive');
      case 'app_browser':
        return tv.launchApp('com.webos.app.browser');
      default:
        console.warn(`[HA-Bridge] Unknown button action: ${btnId}`);
    }
  }
}

const haBridge = new HomeAssistantBridge();
module.exports = haBridge;
