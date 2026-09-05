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
  reconnectInterval: 5000
};

function readHAOptions() {
  try {
    if (fs.existsSync(HA_OPTIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(HA_OPTIONS_FILE, 'utf8'));
      const haConfig = {};
      if (data.tv_ip) haConfig.tvIp = data.tv_ip;
      if (data.tv_mac) haConfig.tvMac = data.tv_mac;
      if (data.client_key) haConfig.clientKey = data.client_key;
      return haConfig;
    }
  } catch (e) {
    console.warn('[Config] Error reading HA options.json:', e.message);
  }
  return {};
}

function loadConfig() {
  const haOpts = readHAOptions();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return { ...defaultDefaults, ...JSON.parse(data), ...haOpts };
    } else if (fs.existsSync(DEFAULT_CONFIG_FILE)) {
      const data = fs.readFileSync(DEFAULT_CONFIG_FILE, 'utf8');
      const conf = { ...defaultDefaults, ...JSON.parse(data), ...haOpts };
      saveConfig(conf);
      return conf;
    }
  } catch (err) {
    console.error('[Config] Error reading config file, using defaults:', err.message);
  }
  return { ...defaultDefaults, ...haOpts };
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
