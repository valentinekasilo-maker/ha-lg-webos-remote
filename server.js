const os = require('os');
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');

const tv = require('./src/lgtv');
const { getConfig, updateConfig } = require('./src/config');

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- REST API ROUTES ---

// TV Status
app.get('/api/status', (req, res) => {
  res.json(tv.getStatus());
});

// TV Reconnect / Connect
app.post('/api/connect', (req, res) => {
  tv.connect();
  res.json({ success: true, message: 'Connecting to TV...' });
});

// Power Operations
app.post('/api/power/on', async (req, res) => {
  try {
    const result = await tv.turnOn();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/power/off', async (req, res) => {
  try {
    const result = await tv.turnOff();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/power/screen-off', async (req, res) => {
  try {
    const result = await tv.turnScreenOff();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/power/screen-on', async (req, res) => {
  try {
    const result = await tv.turnScreenOn();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Volume Controls
app.post('/api/volume', async (req, res) => {
  const { volume, action } = req.body;
  try {
    if (typeof volume === 'number') {
      await tv.setVolume(volume);
    } else if (action === 'up') {
      await tv.volumeUp();
    } else if (action === 'down') {
      await tv.volumeDown();
    } else if (action === 'mute') {
      await tv.setMute(true);
    } else if (action === 'unmute') {
      await tv.setMute(false);
    } else if (action === 'toggleMute') {
      const current = tv.currentStatus.muted;
      await tv.setMute(!current);
    } else {
      return res.status(400).json({ error: 'Invalid volume parameters' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remote Buttons (D-Pad, Navigation, Numbers, Colors)
app.post('/api/button/:key', async (req, res) => {
  const key = req.params.key;
  try {
    const result = await tv.sendButton(key);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pointer Click
app.post('/api/click', async (req, res) => {
  try {
    const result = await tv.sendClick();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Keyboard & Text Input
app.post('/api/keyboard/type', async (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string') return res.status(400).json({ error: 'text must be a string' });
  try {
    const result = await tv.sendText(text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/keyboard/backspace', async (req, res) => {
  const { count } = req.body;
  try {
    const result = await tv.sendBackspace(count || 1);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/keyboard/enter', async (req, res) => {
  try {
    const result = await tv.sendEnter();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Channel Controls
app.post('/api/channel', async (req, res) => {
  const { action } = req.body;
  try {
    if (action === 'up') {
      await tv.channelUp();
    } else if (action === 'down') {
      await tv.channelDown();
    } else {
      return res.status(400).json({ error: 'action must be "up" or "down"' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Media Playback Controls
app.post('/api/media', async (req, res) => {
  const { action } = req.body;
  try {
    if (action === 'play') await tv.play();
    else if (action === 'pause') await tv.pause();
    else if (action === 'stop') await tv.stop();
    else if (action === 'rewind') await tv.rewind();
    else if (action === 'fastForward') await tv.fastForward();
    else return res.status(400).json({ error: 'Invalid media action' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// App Management
app.get('/api/apps', async (req, res) => {
  try {
    const apps = await tv.getApps();
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apps/launch', async (req, res) => {
  const { appId, params } = req.body;
  if (!appId) return res.status(400).json({ error: 'appId is required' });
  try {
    const result = await tv.launchApp(appId, params);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apps/close', async (req, res) => {
  const { appId } = req.body;
  if (!appId) return res.status(400).json({ error: 'appId is required' });
  try {
    const result = await tv.closeApp(appId);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// YouTube Launch Shortcut
app.post('/api/youtube', async (req, res) => {
  const { query, url } = req.body;
  try {
    const target = url || query || '';
    const result = await tv.openYoutube(target);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Browser Launch
app.post('/api/browser', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    const result = await tv.openUrlInBrowser(url);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// External Inputs (HDMI)
app.get('/api/inputs', async (req, res) => {
  try {
    const inputs = await tv.getInputs();
    res.json(inputs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inputs/switch', async (req, res) => {
  const { inputId } = req.body;
  if (!inputId) return res.status(400).json({ error: 'inputId is required' });
  try {
    const result = await tv.setInput(inputId);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// On-screen Toast Notification
app.post('/api/toast', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });
  try {
    const result = await tv.showToast(message);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Configuration Settings
app.get('/api/config', (req, res) => {
  const cfg = getConfig();
  // Hide full clientKey for security if needed, or return boolean
  res.json({
    tvIp: cfg.tvIp,
    tvMac: cfg.tvMac,
    hasKey: !!cfg.clientKey,
    port: cfg.port,
    webServerPort: cfg.webServerPort
  });
});

app.post('/api/config', (req, res) => {
  const { tvIp, tvMac } = req.body;
  const updates = {};
  if (tvIp !== undefined) updates.tvIp = tvIp.trim();
  if (tvMac !== undefined) updates.tvMac = tvMac.trim();

  const updated = updateConfig(updates);
  // Trigger reconnection with new IP/settings
  tv.connect();
  res.json({ success: true, config: updated });
});

// --- SOCKET.IO REALTIME EVENTS ---

io.on('connection', (socket) => {
  // Send initial status on client connection
  socket.emit('status', tv.getStatus());

  // Allow realtime button clicks via WebSocket
  socket.on('button', async (key, ack) => {
    try {
      const result = await tv.sendButton(key);
      if (ack) ack({ success: true, result });
    } catch (err) {
      if (ack) ack({ error: err.message });
    }
  });

  socket.on('click', async (ack) => {
    try {
      const result = await tv.sendClick();
      if (ack) ack({ success: true, result });
    } catch (err) {
      if (ack) ack({ error: err.message });
    }
  });

  socket.on('volume', async (data, ack) => {
    try {
      if (typeof data.volume === 'number') {
        await tv.setVolume(data.volume);
      } else if (data.action === 'up') {
        await tv.volumeUp();
      } else if (data.action === 'down') {
        await tv.volumeDown();
      } else if (data.action === 'toggleMute') {
        await tv.setMute(!tv.currentStatus.muted);
      }
      if (ack) ack({ success: true });
    } catch (err) {
      if (ack) ack({ error: err.message });
    }
  });

  socket.on('channel', async (data, ack) => {
    try {
      if (data.action === 'up') await tv.channelUp();
      else if (data.action === 'down') await tv.channelDown();
      if (ack) ack({ success: true });
    } catch (err) {
      if (ack) ack({ error: err.message });
    }
  });

  socket.on('media', async (data, ack) => {
    try {
      if (data.action === 'play') await tv.play();
      else if (data.action === 'pause') await tv.pause();
      else if (data.action === 'stop') await tv.stop();
      else if (data.action === 'rewind') await tv.rewind();
      else if (data.action === 'fastForward') await tv.fastForward();
      if (ack) ack({ success: true });
    } catch (err) {
      if (ack) ack({ error: err.message });
    }
  });

  socket.on('toast', async (message, ack) => {
    try {
      await tv.showToast(message);
      if (ack) ack({ success: true });
    } catch (err) {
      if (ack) ack({ error: err.message });
    }
  });

  socket.on('keyboard:type', async (text, ack) => {
    try {
      const result = await tv.sendText(text);
      if (ack) ack({ success: true, result });
    } catch (err) {
      if (ack) ack({ error: err.message });
    }
  });

  socket.on('keyboard:backspace', async (count, ack) => {
    try {
      const result = await tv.sendBackspace(count);
      if (ack) ack({ success: true, result });
    } catch (err) {
      if (ack) ack({ error: err.message });
    }
  });

  socket.on('keyboard:enter', async (ack) => {
    try {
      const result = await tv.sendEnter();
      if (ack) ack({ success: true, result });
    } catch (err) {
      if (ack) ack({ error: err.message });
    }
  });
});

// Broadcast TV status changes to all socket clients
tv.on('statusChanged', (status) => {
  io.emit('status', tv.getStatus());
});

tv.on('connect', () => {
  io.emit('tv:connect', tv.getStatus());
});

tv.on('prompt', () => {
  io.emit('tv:prompt');
});

tv.on('error', (err) => {
  io.emit('tv:error', { message: err.message });
});

tv.on('close', () => {
  io.emit('tv:close');
});

// Start Server & Connect to TV
const PORT = getConfig().webServerPort || 8080;
server.listen(PORT, '0.0.0.0', async () => {
  const localIPs = getLocalIPs();
  console.log(`===================================================`);
  console.log(`🚀 LG webOS TV Controller Server is RUNNING!`);
  console.log(`📡 Local Web Remote : http://localhost:${PORT}`);
  localIPs.forEach((ip) => {
    console.log(`📱 Mobile / LAN URL  : http://${ip}:${PORT}`);
  });
  console.log(`🔌 REST API Base     : http://localhost:${PORT}/api`);
  console.log(`===================================================`);

  // Auto-start Ngrok Cloud Tunnel if configured
  const ngrokToken = process.env.NGROK_AUTHTOKEN;
  const ngrokDomain = process.env.NGROK_DOMAIN || 'dominque-hydrocephalic-unconsiderablely.ngrok-free.dev';
  if (ngrokToken) {
    try {
      const ngrok = require('@ngrok/ngrok');
      console.log(`[Ngrok] Connecting public cloud tunnel to ${ngrokDomain}...`);
      const listener = await ngrok.forward({
        addr: PORT,
        authtoken: ngrokToken,
        domain: ngrokDomain
      });
      console.log(`🌐 NGROK CLOUD ACTIVE : ${listener.url()}`);
    } catch (err) {
      console.warn(`[Ngrok] Tunnel startup notice:`, err.message);
    }
  }

  // Initial connect attempt
  tv.connect();
});
