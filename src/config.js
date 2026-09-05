const fs = require('fs');
const path = require('path');
require('dotenv').config();

const isHAAddon = fs.existsSync('/data');
const DATA_DIR = isHAAddon ? '/data' : path.join(__dirname, '..');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const DEFAULT_CONFIG_FILE = path.join(__dirname, 'default-config.json');
const HA_OPTIONS_FILE = '/data/options.json';

// Default fallback configuration
const defaultDefaults = {
  tvIp: process.env.TV_IP || '192.168.1.100',
  tvMac: process.env.TV_MAC || '',
  clientKey: process.env.TV_CLIENT_KEY || process.env.CLIENT_KEY || '',
  saveKey: true,
  port: parseInt(process.env.TV_PORT, 10) || 3000,
  webServerPort: parseInt(process.env.PORT, 10) || 8080,
  reconnectInterval: 5000,
  
  // Home Assistant MQTT Device Integration Settings
  mqttHost: process.env.MQTT_HOST || (isHAAddon ? 'core-mosquitto' : '127.0.0.1'),
  mqttPort: parseInt(process.env.MQTT_PORT, 10) || 1883,
  mqttUser: process.env.MQTT_USER || process.env.MQTT_USERNAME || '',
  mqttPassword: process.env.MQTT_PASSWORD || '',
  mqttDiscoveryPrefix: process.env.MQTT_DISCOVERY_PREFIX || 'homeassistant',
  mqttEnabled: process.env.MQTT_ENABLED !== 'false',
  deviceName: process.env.DEVICE_NAME || 'LG webOS Smart TV',
  deviceArea: process.env.DEVICE_AREA || 'Living Room'
};

function readHAOptions() {
  try {
    if (fs.existsSync(HA_OPTIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(HA_OPTIONS_FILE, 'utf8'));
      const haConfig = {};
      if (data.tv_ip) haConfig.tvIp = data.tv_ip;
      if (data.tv_mac) haConfig.tvMac = data.tv_mac;
      if (data.client_key) haConfig.clientKey = data.client_key;
      if (data.mqtt_host) haConfig.mqttHost = data.mqtt_host;
      if (data.mqtt_port) haConfig.mqttPort = data.mqtt_port;
      if (data.mqtt_user) haConfig.mqttUser = data.mqtt_user;
      if (data.mqtt_password) haConfig.mqttPassword = data.mqtt_password;
      if (data.mqtt_discovery_prefix) haConfig.mqttDiscoveryPrefix = data.mqtt_discovery_prefix;
      if (data.mqtt_enabled !== undefined) haConfig.mqttEnabled = data.mqtt_enabled;
      if (data.device_name) haConfig.deviceName = data.device_name;
      if (data.device_area) haConfig.deviceArea = data.device_area;
      return haConfig;
    }
  } catch (e) {
    console.warn('[Config] Error reading HA options.json:', e.message);
  }
  return {};
}

const HA_SERVICES_FILE = '/data/services.json';

function readHAServices() {
  try {
    if (fs.existsSync(HA_SERVICES_FILE)) {
      const data = JSON.parse(fs.readFileSync(HA_SERVICES_FILE, 'utf8'));
      const svcConfig = {};
      if (data.mqtt) {
        if (data.mqtt.host) svcConfig.mqttHost = data.mqtt.host;
        if (data.mqtt.port) svcConfig.mqttPort = data.mqtt.port;
        if (data.mqtt.username) svcConfig.mqttUser = data.mqtt.username;
        if (data.mqtt.password) svcConfig.mqttPassword = data.mqtt.password;
      }
      return svcConfig;
    }
  } catch (e) {
    console.warn('[Config] Error reading HA services.json:', e.message);
  }
  return {};
}

function loadConfig() {
  const haOpts = readHAOptions();
  const haSvcs = readHAServices();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return { ...defaultDefaults, ...JSON.parse(data), ...haSvcs, ...haOpts };
    } else if (fs.existsSync(DEFAULT_CONFIG_FILE)) {
      const data = fs.readFileSync(DEFAULT_CONFIG_FILE, 'utf8');
      const conf = { ...defaultDefaults, ...JSON.parse(data), ...haSvcs, ...haOpts };
      saveConfig(conf);
      return conf;
    }
  } catch (err) {
    console.error('[Config] Error reading config file, using defaults:', err.message);
  }
  return { ...defaultDefaults, ...haSvcs, ...haOpts };
}

function saveConfig(newConfig) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[Config] Failed to save config file:', err.message);
    return false;
  }
}

let config = loadConfig();

function getConfig() {
  return config;
}

function updateConfig(updates) {
  config = { ...config, ...updates };
  saveConfig(config);
  return config;
}

function saveClientKey(clientKey) {
  if (config.clientKey !== clientKey) {
    config.clientKey = clientKey;
    saveConfig(config);
    console.log('[Config] Saved new pairing clientKey.');
  }
}

module.exports = {
  getConfig,
  updateConfig,
  saveClientKey,
  CONFIG_FILE
};
