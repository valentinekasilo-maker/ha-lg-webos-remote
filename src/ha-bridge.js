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

      // Subscribe to call_service events to capture Home Assistant UI clicks
      this.wsSend({
        id: this.reqId++,
        type: 'subscribe_events',
        event_type: 'call_service'
      });

      // Initial state synchronization
      this.syncState();
    } else if (data.type === 'event' && data.event && data.event.event_type === 'call_service') {
      this.handleServiceCall(data.event.data);
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
      { id: 'num_0', name: '0', icon: 'mdi:numeric-0' },
      { id: 'num_1', name: '1', icon: 'mdi:numeric-1' },
      { id: 'num_2', name: '2', icon: 'mdi:numeric-2' },
      { id: 'num_3', name: '3', icon: 'mdi:numeric-3' },
      { id: 'num_4', name: '4', icon: 'mdi:numeric-4' },
      { id: 'num_5', name: '5', icon: 'mdi:numeric-5' },
      { id: 'num_6', name: '6', icon: 'mdi:numeric-6' },
      { id: 'num_7', name: '7', icon: 'mdi:numeric-7' },
      { id: 'num_8', name: '8', icon: 'mdi:numeric-8' },
      { id: 'num_9', name: '9', icon: 'mdi:numeric-9' },
      { id: 'num_dash', name: 'Dash (-)', icon: 'mdi:minus' },
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

  // --- SERVICE CALL EVENT DISPATCHER ---
  async handleServiceCall(data) {
    if (!data || !data.domain) return;
    const { domain, service, service_data } = data;
    const entityId = (service_data && (service_data.entity_id || service_data.entity_ids)) ? String(service_data.entity_id || service_data.entity_ids) : '';
    const deviceId = (service_data && service_data.device_id) ? String(service_data.device_id) : '';

    const entLower = entityId.toLowerCase();
    const isLgTvService = domain === 'lg_webos_smart_remote';
    const isLgEntity = entLower.includes('lg_webos') || 
                       entLower.includes('lg_tv') || 
                       entLower.includes('tv_remote') ||
                       entLower.includes('living_room_living_room') ||
                       entLower.includes('d_pad') ||
                       entLower.includes('screen_off') ||
                       entLower.includes('screen_on') ||
                       entLower.includes('power_on_wol') ||
                       entLower.includes('power_off') ||
                       deviceId.includes('cf7f119552f98a0ff46ed71a59071a96') ||
                       deviceId.includes('774cdec99cfdca039dd668ddb5697e46');

    if (!isLgTvService && !isLgEntity) {
      return;
    }

    console.log(`[HA-Bridge] Handling HA Service Call: [${domain}.${service}] on ${entityId || deviceId}`);

    try {
      // 0. Custom lg_webos_smart_remote Domain Services
      if (domain === 'lg_webos_smart_remote') {
        if (service === 'send_button' && service_data.button) await tv.sendButton(service_data.button);
        else if (service === 'send_text' && service_data.text) await tv.sendText(service_data.text);
        else if (service === 'show_toast' && service_data.message) await tv.showToast(service_data.message, service_data.icon);
        else if (service === 'screen_off') await tv.turnScreenOff();
        else if (service === 'screen_on') await tv.turnScreenOn();
        else if (service === 'open_youtube') await tv.openYoutube(service_data.video_id || '');
        return;
      }

      // 1. Button Presses
      if (domain === 'button' && service === 'press') {
        const ent = entityId.toLowerCase();
        if (ent.includes('power_on') || ent.includes('wol')) await tv.turnOn();
        else if (ent.includes('power_off')) await tv.turnOff();
        else if (ent.includes('screen_off') || ent.includes('turn_screen_off')) await tv.turnScreenOff();
        else if (ent.includes('screen_on') || ent.includes('turn_screen_on')) await tv.turnScreenOn();
        else if (ent.includes('d_pad_up') || ent.includes('dpad_up') || ent.includes('_up')) await tv.sendButton('UP');
        else if (ent.includes('d_pad_down') || ent.includes('dpad_down') || ent.includes('_down')) await tv.sendButton('DOWN');
        else if (ent.includes('d_pad_left') || ent.includes('dpad_left') || ent.includes('_left')) await tv.sendButton('LEFT');
        else if (ent.includes('d_pad_right') || ent.includes('dpad_right') || ent.includes('_right')) await tv.sendButton('RIGHT');
        else if (ent.includes('d_pad_enter') || ent.includes('dpad_enter') || ent.includes('enter') || ent.includes('ok')) await tv.sendButton('ENTER');
        else if (ent.includes('back')) await tv.sendButton('BACK');
        else if (ent.includes('home')) await tv.sendButton('HOME');
        else if (ent.includes('menu')) await tv.sendButton('MENU');
        else if (ent.includes('exit')) await tv.sendButton('EXIT');
        else if (ent.includes('vol_up') || ent.includes('volume_up')) await tv.volumeUp();
        else if (ent.includes('vol_down') || ent.includes('volume_down')) await tv.volumeDown();
        else if (ent.includes('mute')) await tv.setMute(!tv.getStatus().muted);
        else if (ent.includes('chan_up') || ent.includes('channel_up')) await tv.channelUp();
        else if (ent.includes('chan_down') || ent.includes('channel_down')) await tv.channelDown();
        else if (ent.includes('youtube')) await tv.openYoutube('');
        else if (ent.includes('netflix')) await tv.launchApp('netflix');
        else if (ent.includes('spotify')) await tv.launchApp('spotify-beehive');
        else if (ent.includes('browser') || ent.includes('web_browser')) await tv.launchApp('com.webos.app.browser');
        else if (ent.includes('livetv') || ent.includes('live_tv')) await tv.launchApp('com.webos.app.livetv');
        else if (ent.includes('store') || ent.includes('app_store')) await tv.launchApp('com.webos.app.discovery');
        else if (ent.includes('media_play') || ent.includes('play')) await tv.play();
        else if (ent.includes('media_pause') || ent.includes('pause')) await tv.pause();
        else if (ent.includes('media_stop') || ent.includes('stop')) await tv.stop();
        else if (ent.includes('media_rewind') || ent.includes('rewind')) await tv.rewind();
        else if (ent.includes('media_fastforward') || ent.includes('fastforward')) await tv.fastForward();
        else if (ent.includes('color_red') || ent.includes('red_key')) await tv.sendButton('RED');
        else if (ent.includes('color_green') || ent.includes('green_key')) await tv.sendButton('GREEN');
        else if (ent.includes('color_yellow') || ent.includes('yellow_key')) await tv.sendButton('YELLOW');
        else if (ent.includes('color_blue') || ent.includes('blue_key')) await tv.sendButton('BLUE');
        else if (ent.includes('hdmi_1')) await tv.setInput('HDMI_1');
        else if (ent.includes('hdmi_2')) await tv.setInput('HDMI_2');
        else if (ent.includes('hdmi_3')) await tv.setInput('HDMI_3');
        else if (ent.includes('input_source') || ent.includes('input')) await tv.sendButton('INPUT');
        else if (ent.includes('nav_info') || ent.includes('_info')) await tv.sendButton('INFO');
        else if (ent.includes('nav_guide') || ent.includes('_guide')) await tv.sendButton('GUIDE');
        else if (ent.includes('nav_cc') || ent.includes('_cc')) await tv.sendButton('CC');
        else if (ent.includes('num_dash') || ent.includes('_dash')) await tv.sendButton('DASH');
        else if (ent.includes('num_0') || ent.endsWith('_0')) await tv.sendButton('0');
        else if (ent.includes('num_1') || ent.endsWith('_1')) await tv.sendButton('1');
        else if (ent.includes('num_2') || ent.endsWith('_2')) await tv.sendButton('2');
        else if (ent.includes('num_3') || ent.endsWith('_3')) await tv.sendButton('3');
        else if (ent.includes('num_4') || ent.endsWith('_4')) await tv.sendButton('4');
        else if (ent.includes('num_5') || ent.endsWith('_5')) await tv.sendButton('5');
        else if (ent.includes('num_6') || ent.endsWith('_6')) await tv.sendButton('6');
        else if (ent.includes('num_7') || ent.endsWith('_7')) await tv.sendButton('7');
        else if (ent.includes('num_8') || ent.endsWith('_8')) await tv.sendButton('8');
        else if (ent.includes('num_9') || ent.endsWith('_9')) await tv.sendButton('9');
        return;
      }

      // 2. Media Player Actions
      if (domain === 'media_player') {
        if (service === 'turn_on') await tv.turnOn();
        else if (service === 'turn_off') await tv.turnOff();
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
        return;
      }

      // 3. Remote Commands
      if (domain === 'remote') {
        if (service === 'turn_on') await tv.turnOn();
        else if (service === 'turn_off') await tv.turnOff();
        else if (service === 'send_command') {
          const cmds = Array.isArray(service_data.command) ? service_data.command : [service_data.command];
          for (const cmd of cmds) {
            await this.executeRemoteCommand(cmd);
          }
        }
        return;
      }

      // 4. Select Source Option
      if (domain === 'select' && service === 'select_option' && service_data.option) {
        await this.launchSource(service_data.option);
        return;
      }

      // 5. Virtual Keyboard Typing
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

  handleMqttMessage(topic, payload) {
    // Also handle incoming MQTT command topics if broker is active
    const deviceId = this.getDeviceId();
    if (topic.startsWith(`${deviceId}/button/`)) {
      const btnId = topic.split('/')[2];
      const matchingBtn = {
        power_on: () => tv.turnOn(),
        power_off: () => tv.turnOff(),
        screen_off: () => tv.turnScreenOff(),
        screen_on: () => tv.turnScreenOn(),
        dpad_up: () => tv.sendButton('UP'),
        dpad_down: () => tv.sendButton('DOWN'),
        dpad_left: () => tv.sendButton('LEFT'),
        dpad_right: () => tv.sendButton('RIGHT'),
        dpad_enter: () => tv.sendButton('ENTER'),
        nav_back: () => tv.sendButton('BACK'),
        nav_home: () => tv.sendButton('HOME'),
        nav_menu: () => tv.sendButton('MENU'),
        nav_exit: () => tv.sendButton('EXIT'),
        vol_up: () => tv.volumeUp(),
        vol_down: () => tv.volumeDown(),
        vol_mute: () => tv.setMute(!tv.getStatus().muted),
        chan_up: () => tv.channelUp(),
        chan_down: () => tv.channelDown(),
        app_youtube: () => tv.openYoutube(''),
        app_netflix: () => tv.launchApp('netflix'),
        app_spotify: () => tv.launchApp('spotify-beehive'),
        app_browser: () => tv.launchApp('com.webos.app.browser')
      }[btnId];
      if (matchingBtn) matchingBtn();
    }
  }
}

const haBridge = new HomeAssistantBridge();
module.exports = haBridge;
