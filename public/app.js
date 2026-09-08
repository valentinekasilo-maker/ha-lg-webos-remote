// Detect Home Assistant Ingress base path or standalone path
const basePath = window.location.pathname.endsWith('/') 
  ? window.location.pathname.slice(0, -1) 
  : window.location.pathname;

// Connect to backend Socket.IO server with prioritized websocket transport
const socket = io({
  path: (basePath ? basePath : '') + '/socket.io',
  transports: ['websocket', 'polling'],
  upgrade: true
});

// DOM Elements
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');
const uiAlert = document.getElementById('ui-alert');
const uiAlertMsg = document.getElementById('ui-alert-msg');
const footerIp = document.getElementById('footer-ip');
const volDisplay = document.getElementById('vol-display');
const volSlider = document.getElementById('vol-slider');
const muteBtn = document.getElementById('btn-mute');
const muteIcon = document.getElementById('mute-icon');

const settingsModal = document.getElementById('settings-modal');
const settingsForm = document.getElementById('settings-form');
const tvIpInput = document.getElementById('tv-ip-input');
const tvMacInput = document.getElementById('tv-mac-input');
const btnSettingsOpen = document.getElementById('btn-settings-open');
const btnSettingsClose = document.getElementById('btn-settings-close');

let currentVolume = 20;
let isMuted = false;
let isScreenOff = false;

// Vibration feedback helper for mobile
function haptic() {
  if (navigator.vibrate) {
    try { navigator.vibrate(25); } catch (e) {}
  }
}

// Show alert banner
function showAlert(message, type = 'warning') {
  uiAlertMsg.textContent = message;
  uiAlert.className = `ui-alert ${type}`;
  uiAlert.classList.remove('hidden');
}

function hideAlert() {
  uiAlert.classList.add('hidden');
}

// Update UI Connection State
function updateConnectionUI(status) {
  statusBadge.className = 'status-badge';
  
  if (status.pairingPrompt || status.pairing) {
    statusBadge.classList.add('pairing');
    statusText.textContent = 'Pairing Request';
    showAlert('⚠️ Please click "Allow" on your TV screen with your remote', 'warning');
  } else if (status.connected) {
    statusBadge.classList.add('connected');
    statusText.textContent = 'Connected';
    hideAlert();
  } else if (status.isConnecting) {
    statusBadge.classList.add('pairing');
    statusText.textContent = 'Connecting...';
    hideAlert();
  } else {
    statusBadge.classList.add('disconnected');
    statusText.textContent = 'Disconnected';
    hideAlert();
  }

  if (status.config && status.config.tvIp) {
    footerIp.textContent = status.config.tvIp;
    tvIpInput.value = status.config.tvIp;
    if (status.config.tvMac) tvMacInput.value = status.config.tvMac;
  }

  // Update volume & mute state if received
  if (typeof status.volume === 'number') {
    currentVolume = status.volume;
    volDisplay.textContent = currentVolume;
    volSlider.value = currentVolume;
  }
  if (typeof status.muted === 'boolean') {
    isMuted = status.muted;
    if (isMuted) {
      muteBtn.classList.add('muted');
      muteIcon.className = 'fa-solid fa-volume-xmark';
    } else {
      muteBtn.classList.remove('muted');
      muteIcon.className = 'fa-solid fa-volume-high';
    }
  }

  // Render dynamic installed apps from TV
  if (Array.isArray(status.installedApps) && status.installedApps.length > 0) {
    renderInstalledApps(status.installedApps);
  }
}

function renderInstalledApps(apps) {
  const grid = document.getElementById('installed-apps-grid');
  const countSpan = document.getElementById('installed-apps-count');
  if (!grid) return;

  if (countSpan) countSpan.textContent = apps.length;
  grid.innerHTML = '';

  apps.forEach((app) => {
    const btn = document.createElement('button');
    btn.className = 'app-card';
    btn.title = app.title || app.id;
    btn.onclick = () => {
      apiCall('/api/apps/launch', 'POST', { appId: app.id });
    };

    const iconDiv = document.createElement('div');
    iconDiv.className = 'app-icon';
    if (app.icon) {
      const img = document.createElement('img');
      img.src = app.icon;
      img.alt = app.title || app.id;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.borderRadius = '8px';
      img.style.objectFit = 'contain';
      iconDiv.appendChild(img);
    } else {
      iconDiv.innerHTML = '<i class="fa-solid fa-tv"></i>';
    }

    const titleSpan = document.createElement('span');
    titleSpan.textContent = (app.title || app.id).substring(0, 14);

    btn.appendChild(iconDiv);
    btn.appendChild(titleSpan);
    grid.appendChild(btn);
  });
}

// --- Socket.IO Event Listeners ---
socket.on('status', (data) => {
  updateConnectionUI(data);
});

socket.on('tv:connect', (data) => {
  updateConnectionUI(data);
});

socket.on('tv:prompt', () => {
  showAlert('⚠️ Please click "Allow" on your TV screen to pair!', 'warning');
  statusBadge.className = 'status-badge pairing';
  statusText.textContent = 'Pairing...';
});

socket.on('tv:error', (err) => {
  console.warn('TV Error:', err);
});

socket.on('tv:close', () => {
  statusBadge.className = 'status-badge disconnected';
  statusText.textContent = 'Disconnected';
});

// --- REST API Call Helper ---
async function apiCall(endpoint, method = 'POST', body = null) {
  haptic();
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const url = endpoint.startsWith('/') ? ((basePath || '') + endpoint) : endpoint;
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) {
      console.warn('API Warning:', data.error || data.message);
    }
    return data;
  } catch (err) {
    console.error('Network error:', err);
  }
}

// High-speed low-latency touch binder (0ms touch delay)
function bindFastTouch(el, callback) {
  if (!el) return;
  let touched = false;

  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    touched = true;
    haptic();
    callback();
    setTimeout(() => { touched = false; }, 100);
  }, { passive: false });

  el.addEventListener('click', (e) => {
    e.preventDefault();
    if (!touched) {
      haptic();
      callback();
    }
  });
}

// Send Remote Button (UP, DOWN, LEFT, RIGHT, ENTER, HOME, BACK, etc.)
function sendKey(key) {
  socket.emit('button', key);
}

// --- Event Binding ---

// D-Pad and Buttons with data-key attribute (High speed pointerdown)
document.querySelectorAll('[data-key]').forEach((btn) => {
  const key = btn.getAttribute('data-key');
  if (key) {
    bindFastTouch(btn, () => sendKey(key));
  }
});

// Power On (Wake-on-LAN)
const btnPowerOn = document.getElementById('btn-power-on');
if (btnPowerOn) {
  btnPowerOn.addEventListener('click', async () => {
    showAlert('📡 Sending Wake-on-LAN packet to turn TV On...', 'info');
    const res = await apiCall('/api/power/on');
    if (res && res.error) {
      showAlert(`❌ ${res.error}`, 'warning');
    } else {
      setTimeout(() => hideAlert(), 4000);
    }
  });
}

// Power Off
const btnPowerOff = document.getElementById('btn-power-off');
if (btnPowerOff) {
  btnPowerOff.addEventListener('click', () => {
    if (confirm('Power off the TV?')) {
      apiCall('/api/power/off');
    }
  });
}

// Screen Off/On Toggle
const btnScreenToggle = document.getElementById('btn-screen-toggle');
if (btnScreenToggle) {
  btnScreenToggle.addEventListener('click', async () => {
    if (!isScreenOff) {
      await apiCall('/api/power/screen-off');
      isScreenOff = true;
      btnScreenToggle.innerHTML = '<i class="fa-solid fa-display"></i><span>Screen On</span>';
    } else {
      await apiCall('/api/power/screen-on');
      isScreenOff = false;
      btnScreenToggle.innerHTML = '<i class="fa-solid fa-display"></i><span>Screen Off</span>';
    }
  });
}

// Reconnect
const btnReconnect = document.getElementById('btn-reconnect');
if (btnReconnect) {
  btnReconnect.addEventListener('click', () => {
    apiCall('/api/connect');
  });
}

// Volume Up / Down via instant WebSocket
const btnVolUp = document.getElementById('btn-vol-up');
if (btnVolUp) bindFastTouch(btnVolUp, () => socket.emit('volume', { action: 'up' }));

const btnVolDown = document.getElementById('btn-vol-down');
if (btnVolDown) bindFastTouch(btnVolDown, () => socket.emit('volume', { action: 'down' }));

// Mute Toggle via instant WebSocket
if (muteBtn) bindFastTouch(muteBtn, () => socket.emit('volume', { action: 'toggleMute' }));

// Volume Slider
let sliderTimeout = null;
volSlider.addEventListener('input', (e) => {
  const vol = parseInt(e.target.value, 10);
  volDisplay.textContent = vol;
  clearTimeout(sliderTimeout);
  sliderTimeout = setTimeout(() => {
    socket.emit('volume', { volume: vol });
  }, 100);
});

// Channel Up / Down via instant WebSocket
const btnChUp = document.getElementById('btn-ch-up');
if (btnChUp) bindFastTouch(btnChUp, () => socket.emit('channel', { action: 'up' }));

const btnChDown = document.getElementById('btn-ch-down');
if (btnChDown) bindFastTouch(btnChDown, () => socket.emit('channel', { action: 'down' }));

// Media Controls via instant WebSocket
const btnPlay = document.getElementById('btn-play');
if (btnPlay) bindFastTouch(btnPlay, () => socket.emit('media', { action: 'play' }));

const btnPause = document.getElementById('btn-pause');
if (btnPause) bindFastTouch(btnPause, () => socket.emit('media', { action: 'pause' }));

const btnStop = document.getElementById('btn-stop');
if (btnStop) bindFastTouch(btnStop, () => socket.emit('media', { action: 'stop' }));

const btnRewind = document.getElementById('btn-rewind');
if (btnRewind) bindFastTouch(btnRewind, () => socket.emit('media', { action: 'rewind' }));

const btnFF = document.getElementById('btn-ff');
if (btnFF) bindFastTouch(btnFF, () => socket.emit('media', { action: 'fastForward' }));

// Quick Apps
document.querySelectorAll('[data-app]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const appId = btn.getAttribute('data-app');
    if (appId) {
      apiCall('/api/apps/launch', 'POST', { appId });
    }
  });
});

// Quick Inputs
document.querySelectorAll('[data-input]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const inputId = btn.getAttribute('data-input');
    if (inputId) {
      apiCall('/api/inputs/switch', 'POST', { inputId });
    }
  });
});

// Toast Messenger Form
document.getElementById('toast-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('toast-input');
  const message = input.value.trim();
  if (!message) return;
  await apiCall('/api/toast', 'POST', { message });
  input.value = '';
  showAlert(`✨ Message sent to TV: "${message}"`, 'info');
  setTimeout(() => hideAlert(), 3000);
});

// --- Settings Modal ---
btnSettingsOpen.addEventListener('click', () => {
  settingsModal.classList.remove('hidden');
});

btnSettingsClose.addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.add('hidden');
  }
});

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const tvIp = tvIpInput.value.trim();
  const tvMac = tvMacInput.value.trim();
  
  await apiCall('/api/config', 'POST', { tvIp, tvMac });
  settingsModal.classList.add('hidden');
  showAlert('⚙️ Settings saved. Connecting to TV...', 'info');
  setTimeout(() => hideAlert(), 3000);
});

// Initial Status Fetch
apiCall('/api/status', 'GET')
  .then((data) => {
    if (data) updateConnectionUI(data);
  })
  .catch((err) => console.log('Init status error:', err));

// --- Smart TV Keyboard Logic ---
const kbInput = document.getElementById('kb-input');
const btnKbSend = document.getElementById('btn-kb-send');
const btnKbEnter = document.getElementById('btn-kb-enter');
const btnKbBackspace = document.getElementById('btn-kb-backspace');
const btnKbSpace = document.getElementById('btn-kb-space');
const btnKbClear = document.getElementById('btn-kb-clear');
const btnKbPaste = document.getElementById('btn-kb-paste');
const kbLiveMode = document.getElementById('kb-live-mode');
const btnKeyboardScroll = document.getElementById('btn-keyboard-scroll');

if (btnKeyboardScroll) {
  btnKeyboardScroll.addEventListener('click', () => {
    const kbSec = document.getElementById('keyboard-section');
    if (kbSec) {
      kbSec.scrollIntoView({ behavior: 'smooth' });
      if (kbInput) kbInput.focus();
    }
  });
}

function sendTextToTV(text) {
  if (!text) return;
  haptic();
  socket.emit('keyboard:type', text, (res) => {
    if (res && res.error) showAlert(`Keyboard: ${res.error}`, 'warning');
  });
}

function sendEnterToTV() {
  haptic();
  socket.emit('keyboard:enter', (res) => {
    if (res && res.error) showAlert(`Keyboard: ${res.error}`, 'warning');
  });
}

function sendBackspaceToTV(count = 1) {
  haptic();
  socket.emit('keyboard:backspace', count, (res) => {
    if (res && res.error) showAlert(`Keyboard: ${res.error}`, 'warning');
  });
}

if (btnKbSend && kbInput) {
  btnKbSend.addEventListener('click', () => {
    const text = kbInput.value;
    if (!text) return;
    sendTextToTV(text);
    showAlert(`Typed on TV: "${text}"`, 'info');
    setTimeout(() => hideAlert(), 2500);
  });
}

if (btnKbEnter) {
  btnKbEnter.addEventListener('click', () => {
    sendEnterToTV();
  });
}

if (btnKbBackspace && kbInput) {
  btnKbBackspace.addEventListener('click', () => {
    kbInput.value = kbInput.value.slice(0, -1);
    previousKbVal = kbInput.value;
    sendBackspaceToTV(1);
  });
}

if (btnKbSpace && kbInput) {
  btnKbSpace.addEventListener('click', () => {
    kbInput.value += ' ';
    previousKbVal = kbInput.value;
    sendTextToTV(' ');
  });
}

if (btnKbClear && kbInput) {
  btnKbClear.addEventListener('click', () => {
    kbInput.value = '';
    previousKbVal = '';
  });
}

if (btnKbPaste && kbInput) {
  btnKbPaste.addEventListener('click', async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) {
        kbInput.value = clip;
        previousKbVal = clip;
        sendTextToTV(clip);
        showAlert(`Pasted to TV: "${clip}"`, 'info');
        setTimeout(() => hideAlert(), 2500);
      }
    } catch (err) {
      showAlert('Clipboard read permission denied', 'warning');
    }
  });
}

// Live Typing inside input field
let previousKbVal = '';
if (kbInput) {
  kbInput.addEventListener('input', () => {
    const currentVal = kbInput.value;
    if (kbLiveMode && kbLiveMode.checked) {
      if (currentVal.length > previousKbVal.length) {
        const added = currentVal.slice(previousKbVal.length);
        sendTextToTV(added);
      } else if (currentVal.length < previousKbVal.length) {
        sendBackspaceToTV(previousKbVal.length - currentVal.length);
      }
    }
    previousKbVal = currentVal;
  });

  kbInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!kbLiveMode || !kbLiveMode.checked) {
        sendTextToTV(kbInput.value);
      }
      sendEnterToTV();
    }
  });
}

// Virtual QWERTY Keypad buttons
document.querySelectorAll('.key-btn[data-char]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const char = btn.getAttribute('data-char');
    if (char !== null && kbInput) {
      kbInput.value += char;
      previousKbVal = kbInput.value;
      sendTextToTV(char);
    }
  });
});

const btnKeyDel = document.getElementById('btn-key-del');
if (btnKeyDel && kbInput) {
  btnKeyDel.addEventListener('click', () => {
    kbInput.value = kbInput.value.slice(0, -1);
    previousKbVal = kbInput.value;
    sendBackspaceToTV(1);
  });
}

const btnKeyEnter = document.getElementById('btn-key-enter');
if (btnKeyEnter) {
  btnKeyEnter.addEventListener('click', () => {
    sendEnterToTV();
  });
}

// --- Physical Keyboard Navigation Support ---
document.addEventListener('keydown', (e) => {
  // Ignore if user is currently typing in an input field
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault();
      sendKey('UP');
      triggerBtnVisual('dpad-up');
      break;
    case 'ArrowDown':
      e.preventDefault();
      sendKey('DOWN');
      triggerBtnVisual('dpad-down');
      break;
    case 'ArrowLeft':
      e.preventDefault();
      sendKey('LEFT');
      triggerBtnVisual('dpad-left');
      break;
    case 'ArrowRight':
      e.preventDefault();
      sendKey('RIGHT');
      triggerBtnVisual('dpad-right');
      break;
    case 'Enter':
      e.preventDefault();
      sendKey('ENTER');
      triggerBtnVisual('dpad-ok');
      break;
    case 'Escape':
    case 'Backspace':
      e.preventDefault();
      sendKey('BACK');
      triggerBtnVisual('btn-back');
      break;
    case 'h':
    case 'H':
    case 'Home':
      e.preventDefault();
      sendKey('HOME');
      triggerBtnVisual('btn-home');
      break;
    case '+':
    case '=':
      e.preventDefault();
      apiCall('/api/volume', 'POST', { action: 'up' });
      triggerBtnVisual('btn-vol-up');
      break;
    case '-':
    case '_':
      e.preventDefault();
      apiCall('/api/volume', 'POST', { action: 'down' });
      triggerBtnVisual('btn-vol-down');
      break;
    case 'm':
    case 'M':
      e.preventDefault();
      apiCall('/api/volume', 'POST', { action: 'toggleMute' });
      triggerBtnVisual('btn-mute');
      break;
    case ' ':
      e.preventDefault();
      apiCall('/api/media', 'POST', { action: 'play' });
      triggerBtnVisual('btn-play');
      break;
  }
});

function triggerBtnVisual(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.style.transform = 'scale(0.92)';
    setTimeout(() => {
      el.style.transform = '';
    }, 120);
  }
}

// ===================================================
// 🤖 AI ASSISTANT & NATURAL LANGUAGE CONTROLLER
// ===================================================

const btnAiHeader = document.getElementById('btn-ai-header');
const aiSection = document.getElementById('ai-section');
const aiPromptInput = document.getElementById('ai-prompt-input');
const btnAiSend = document.getElementById('btn-ai-send');
const btnAiMic = document.getElementById('btn-ai-mic');
const aiVoiceWave = document.getElementById('ai-voice-wave');
const aiResponseBox = document.getElementById('ai-response-box');
const aiResText = document.getElementById('ai-res-text');
const aiResSteps = document.getElementById('ai-res-steps');
const aiStatusLabel = document.getElementById('ai-status-label');

if (btnAiHeader) {
  btnAiHeader.addEventListener('click', () => {
    haptic();
    if (aiSection) {
      aiSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (aiPromptInput) aiPromptInput.focus();
    }
  });
}

// AI Command Execution Function
async function executeAI(promptText) {
  const prompt = String(promptText || '').trim();
  if (!prompt) return;

  haptic();
  if (aiResponseBox) aiResponseBox.classList.remove('hidden');
  if (aiResText) aiResText.textContent = `Analyzing: "${prompt}"...`;
  if (aiResSteps) aiResSteps.innerHTML = '<div class="ai-step-item"><span class="ai-step-badge ok">AI</span> Processing intent...</div>';
  if (aiStatusLabel) aiStatusLabel.textContent = 'Executing...';

  try {
    let result;
    if (socket && socket.connected) {
      result = await new Promise((resolve) => {
        socket.emit('ai:command', prompt, (res) => resolve(res));
        setTimeout(() => resolve(null), 8000);
      });
    }
    if (!result) {
      result = await apiCall('/api/ai/command', 'POST', { prompt });
    }

    if (result) {
      if (aiResText) aiResText.textContent = result.reply || 'Command completed!';
      if (aiResSteps && Array.isArray(result.steps) && result.steps.length > 0) {
        aiResSteps.innerHTML = result.steps.map((s) => `
          <div class="ai-step-item">
            <span class="ai-step-badge ${s.success ? 'ok' : 'fail'}">${s.success ? '✓' : '✗'} ${s.action}</span>
            <span>${s.detail || ''}</span>
          </div>
        `).join('');
      } else if (aiResSteps) {
        aiResSteps.innerHTML = '';
      }
      showAlert(result.reply || 'AI command executed', result.success ? 'info' : 'warning');
    } else {
      if (aiResText) aiResText.textContent = 'Command sent to TV.';
    }
  } catch (err) {
    if (aiResText) aiResText.textContent = `Error: ${err.message}`;
  } finally {
    if (aiStatusLabel) aiStatusLabel.textContent = 'Voice & Smart Control';
  }
}

if (btnAiSend && aiPromptInput) {
  btnAiSend.addEventListener('click', () => {
    executeAI(aiPromptInput.value);
  });

  aiPromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeAI(aiPromptInput.value);
    }
  });
}

// Suggestion Chips
document.querySelectorAll('.ai-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const prompt = chip.getAttribute('data-prompt');
    if (prompt) {
      if (aiPromptInput) aiPromptInput.value = prompt;
      executeAI(prompt);
    }
  });
});

// Web Speech API Voice Dictation
let recognition = null;
let isRecording = false;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  try {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isRecording = true;
      if (btnAiMic) btnAiMic.classList.add('listening');
      if (aiVoiceWave) aiVoiceWave.classList.remove('hidden');
      if (aiStatusLabel) aiStatusLabel.textContent = 'Listening...';
      haptic();
    };

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      if (aiPromptInput) aiPromptInput.value = transcript;
      executeAI(transcript);
    };

    recognition.onerror = (e) => {
      console.warn('Speech recognition notice:', e.error);
      stopVoice();
    };

    recognition.onend = () => {
      stopVoice();
    };
  } catch (e) {
    console.warn('Speech init notice:', e.message);
  }
}

function stopVoice() {
  isRecording = false;
  if (btnAiMic) btnAiMic.classList.remove('listening');
  if (aiVoiceWave) aiVoiceWave.classList.add('hidden');
  if (aiStatusLabel) aiStatusLabel.textContent = 'Voice & Smart Control';
}

if (btnAiMic) {
  btnAiMic.addEventListener('click', () => {
    if (!recognition) {
      showAlert('⚠️ Voice speech recognition is supported in Chrome, Edge & Android browsers.', 'warning');
      return;
    }
    if (isRecording) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (e) {
        recognition.stop();
      }
    }
  });
}

// ===================================================
// 🖱️ TOUCHPAD AIR MOUSE & D-PAD MODE SWITCHER
// ===================================================

const modeBtnDpad = document.getElementById('mode-btn-dpad');
const modeBtnTouchpad = document.getElementById('mode-btn-touchpad');
const dpadView = document.getElementById('dpad-view');
const touchpadView = document.getElementById('touchpad-view');
const touchpadSurface = document.getElementById('touchpad-surface');
const touchpadTracker = document.getElementById('touchpad-tracker');

function switchNavMode(mode) {
  haptic();
  if (mode === 'touchpad') {
    if (modeBtnTouchpad) modeBtnTouchpad.classList.add('active');
    if (modeBtnDpad) modeBtnDpad.classList.remove('active');
    if (dpadView) dpadView.classList.add('hidden');
    if (touchpadView) touchpadView.classList.remove('hidden');
    localStorage.setItem('lg_nav_mode', 'touchpad');
  } else {
    if (modeBtnDpad) modeBtnDpad.classList.add('active');
    if (modeBtnTouchpad) modeBtnTouchpad.classList.remove('active');
    if (touchpadView) touchpadView.classList.add('hidden');
    if (dpadView) dpadView.classList.remove('hidden');
    localStorage.setItem('lg_nav_mode', 'dpad');
  }
}

if (modeBtnDpad && modeBtnTouchpad) {
  modeBtnDpad.addEventListener('click', () => switchNavMode('dpad'));
  modeBtnTouchpad.addEventListener('click', () => switchNavMode('touchpad'));

  // Restore saved preference if any
  const savedMode = localStorage.getItem('lg_nav_mode');
  if (savedMode === 'touchpad') switchNavMode('touchpad');
}

// Sensitivity Settings
let touchpadSensitivity = parseFloat(localStorage.getItem('lg_tp_sens') || '1.0');
document.querySelectorAll('.sens-pill').forEach((pill) => {
  const sens = parseFloat(pill.getAttribute('data-sens'));
  if (sens === touchpadSensitivity) {
    document.querySelectorAll('.sens-pill').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
  }
  pill.addEventListener('click', () => {
    haptic();
    touchpadSensitivity = sens;
    localStorage.setItem('lg_tp_sens', String(sens));
    document.querySelectorAll('.sens-pill').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
  });
});

// Touchpad Pointer Tracking & Gestures
if (touchpadSurface) {
  let isPointerDown = false;
  let lastX = 0;
  let lastY = 0;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let moveDistance = 0;
  let isDragging = false;
  let lastTapTime = 0;

  let moveAccumulatorX = 0;
  let moveAccumulatorY = 0;
  let sendTimer = null;

  function flushMove() {
    if (moveAccumulatorX !== 0 || moveAccumulatorY !== 0) {
      socket.emit('mouse:move', {
        dx: moveAccumulatorX,
        dy: moveAccumulatorY,
        drag: isDragging ? 1 : 0
      });
      moveAccumulatorX = 0;
      moveAccumulatorY = 0;
    }
  }

  // Pointer Down
  touchpadSurface.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    isPointerDown = true;
    touchpadSurface.classList.add('active');
    try { touchpadSurface.setPointerCapture(e.pointerId); } catch (err) {}

    const rect = touchpadSurface.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    lastX = e.clientX;
    lastY = e.clientY;
    startX = e.clientX;
    startY = e.clientY;
    startTime = Date.now();
    moveDistance = 0;

    // Double tap check for drag mode
    const timeSinceLastTap = Date.now() - lastTapTime;
    if (timeSinceLastTap < 280) {
      isDragging = true;
      haptic();
    } else {
      isDragging = false;
    }
    lastTapTime = Date.now();

    if (touchpadTracker) {
      touchpadTracker.style.left = `${relX}px`;
      touchpadTracker.style.top = `${relY}px`;
    }
  });

  // Pointer Move
  touchpadSurface.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;
    e.preventDefault();

    const dx = (e.clientX - lastX) * touchpadSensitivity;
    const dy = (e.clientY - lastY) * touchpadSensitivity;

    moveDistance += Math.hypot(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;

    moveAccumulatorX += dx;
    moveAccumulatorY += dy;

    if (!sendTimer) {
      sendTimer = setTimeout(() => {
        flushMove();
        sendTimer = null;
      }, 16); // ~60 FPS
    }

    const rect = touchpadSurface.getBoundingClientRect();
    const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const relY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    if (touchpadTracker) {
      touchpadTracker.style.left = `${relX}px`;
      touchpadTracker.style.top = `${relY}px`;
    }
  });

  // Pointer Up
  touchpadSurface.addEventListener('pointerup', (e) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    touchpadSurface.classList.remove('active');
    try { touchpadSurface.releasePointerCapture(e.pointerId); } catch (err) {}

    flushMove();

    const duration = Date.now() - startTime;
    // If short duration and minimal movement, trigger Click
    if (duration < 300 && moveDistance < 10) {
      haptic();
      socket.emit('mouse:click');
      if (touchpadTracker) {
        touchpadTracker.style.transform = 'translate(-50%, -50%) scale(1.6)';
        setTimeout(() => {
          if (touchpadTracker) touchpadTracker.style.transform = 'translate(-50%, -50%)';
        }, 150);
      }
    }
    isDragging = false;
  });

  touchpadSurface.addEventListener('pointercancel', () => {
    isPointerDown = false;
    touchpadSurface.classList.remove('active');
    flushMove();
    isDragging = false;
  });

  // Two-Finger Touch Scroll Gesture
  let lastTouchY = 0;
  touchpadSurface.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      if (lastTouchY) {
        const deltaY = (touchY - lastTouchY) * 2;
        socket.emit('mouse:scroll', { dy: -deltaY });
      }
      lastTouchY = touchY;
    }
  }, { passive: false });

  touchpadSurface.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) lastTouchY = 0;
  });

  // Wheel event for desktop mouse over trackpad
  touchpadSurface.addEventListener('wheel', (e) => {
    e.preventDefault();
    socket.emit('mouse:scroll', { dy: e.deltaY > 0 ? 20 : -20 });
  }, { passive: false });
}

// Touchpad Action Buttons
const tpClick = document.getElementById('tp-click');
const tpScrollUp = document.getElementById('tp-scroll-up');
const tpScrollDown = document.getElementById('tp-scroll-down');
const tpBack = document.getElementById('tp-back');

if (tpClick) tpClick.addEventListener('click', () => { haptic(); socket.emit('mouse:click'); });
if (tpScrollUp) tpScrollUp.addEventListener('click', () => { haptic(); socket.emit('mouse:scroll', { dy: -25 }); });
if (tpScrollDown) tpScrollDown.addEventListener('click', () => { haptic(); socket.emit('mouse:scroll', { dy: 25 }); });
if (tpBack) tpBack.addEventListener('click', () => sendKey('BACK'));


