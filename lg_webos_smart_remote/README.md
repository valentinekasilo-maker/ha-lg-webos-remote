# 📺 LG webOS Smart TV Node.js Controller

A powerful, full-featured Node.js controller, real-time Web Remote UI, REST API, and CLI tool for **LG webOS Smart TVs** (webOS 2.0 through webOS 24+).

---

## ✨ Features

- 🎮 **Tactile Web Remote Dashboard**: Responsive glassmorphism interface for mobile and desktop browsers with instant low-latency WebSocket control.
- 🛜 **Wake-on-LAN (WoL)**: Turn the TV **ON** directly over the network even from standby mode.
- 🔊 **Audio Control**: Volume slider, Volume Up/Down, Mute/Unmute, and live volume synchronization.
- 🎯 **Magic Remote & D-Pad**: Up, Down, Left, Right, OK/Enter, Back, Home, Exit, Settings Menu, Color buttons (Red/Green/Yellow/Blue), and Number Pad.
- 🚀 **App Launcher**: Instant shortcuts to YouTube, Netflix, Prime Video, Web Browser, HDMI inputs (1, 2, 3, 4), and custom apps.
- 💬 **On-Screen Toast Notifications**: Send custom alert banners that pop up directly on your TV screen.
- 🔌 **REST API & Socket.IO**: Easily automate your TV with Home Assistant, Node-RED, or curl scripts.
- 💻 **CLI Tool**: Trigger any action instantly from your terminal (e.g. `npm run cli -- on`, `npm run cli -- vol 20`, `npm run cli -- toast "Dinner ready!"`).

---

## 🏠 Home Assistant Add-on Installation (Raspberry Pi & HAOS)

This project can be installed directly inside Home Assistant on your Raspberry Pi as an official Add-on with **Ingress support** (embedded into your Home Assistant sidebar).

### Method 1: Add as Custom Repository in Home Assistant
1. In Home Assistant, navigate to **Settings ➔ Add-ons ➔ Add-on Store**.
2. Click the **3 dots** (top right) ➔ **Repositories**.
3. Add your GitHub repository URL:
   `https://github.com/valentinekasilo-maker/ha-lg-webos-remote`
4. Find **LG webOS Smart Remote** in the store and click **Install**.
5. Go to the **Configuration** tab, set your `tv_ip` and `tv_mac`.
6. Enable **"Start on boot"** and **"Show in sidebar"**, then click **Start**!

### Method 2: Copy as a Local Add-on (Via Samba or SSH)
1. Using the **Samba Share** or **SSH & Web Terminal** add-on in HA, copy this folder into the `/addons/` directory on your Raspberry Pi (e.g. `/addons/lg-webos-remote/`).
2. In Home Assistant: **Settings ➔ Add-ons ➔ Add-on Store ➔ 3 dots ➔ Check for updates**.
3. Under **Local add-ons**, click **LG webOS Smart Remote** ➔ **Install**.
4. Enable **"Show in sidebar"** and **Start**.

---

## 📋 Prerequisites on Your LG TV

Before connecting for the first time:

1. **Connect TV to Network**: Ensure your LG TV is on the same local network (Wi-Fi or Ethernet) as your computer.
2. **Enable Mobile TV On (for Turning TV ON via Wake-on-LAN)**:
   - On LG TV: Go to **Settings > All Settings > Connection (or General) > Mobile TV On** (or *Turn On with Wi-Fi* / *LG Connect Apps*). Turn it **ON**.
3. **Find TV IP & MAC Address**:
   - Go to **Settings > All Settings > Connection > Network > Wi-Fi Connection (or Ethernet)** > **Advanced Wi-Fi Settings**.
   - Note the **IP Address** (e.g., `192.168.1.150`) and **MAC Address** (e.g., `14:C9:13:XX:XX:XX`).

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure TV IP Address
You can configure the TV IP and MAC either by:
- Editing `config.json` directly, or
- Running `node cli.js config <TV_IP> [TV_MAC]`, or
- Simply starting the server and typing it into the Settings popup in the Web UI!

Example `config.json`:
```json
{
  "tvIp": "192.168.1.150",
  "tvMac": "14:C9:13:XX:XX:XX",
  "webServerPort": 8080
}
```

### 3. Start the Web Server & Remote UI
```bash
npm start
```
Then open your browser at **`http://localhost:8080`** (or access it from your smartphone at `http://<YOUR-PC-IP>:8080`).

> 💡 **First Time Pairing Prompt**:
> When you first connect, a prompt **"Allow connection from Node.js Controller?"** will appear on your TV screen. Click **Allow / Yes** with your physical remote. The app will save the pairing key automatically so you won't be asked again!

---

## ⌨️ Command Line Interface (CLI)

You can control your TV directly from your terminal:

```bash
# Power
node cli.js on                         # Turn TV ON (sends Wake-on-LAN)
node cli.js off                        # Turn TV OFF
node cli.js screen-off                 # Turn screen off (keeps audio playing)
node cli.js screen-on                  # Turn screen back on

# Volume
node cli.js vol 25                     # Set volume to 25%
node cli.js vol-up                     # Increase volume
node cli.js vol-down                   # Decrease volume
node cli.js mute                       # Mute TV
node cli.js unmute                     # Unmute TV

# Navigation & Buttons
node cli.js btn UP                     # Send UP
node cli.js btn ENTER                  # Send OK/Enter
node cli.js btn HOME                   # Open Home dashboard
node cli.js btn BACK                   # Send Back

# Apps & Media
node cli.js apps                       # List all installed apps and IDs
node cli.js launch netflix             # Launch Netflix
node cli.js youtube "dQw4w9WgXcQ"     # Launch YouTube video
node cli.js browser "https://google.com" # Open website in TV browser
node cli.js input HDMI_1               # Switch to HDMI 1

# On-screen Toast
node cli.js toast "Dinner is ready!"   # Display notification banner on TV screen

# TV Info & Config
node cli.js info                       # View TV status & pairing info
node cli.js config 192.168.1.150       # Set TV IP address
```

---

## 🔌 REST API Reference

The server exposes HTTP endpoints on `http://localhost:8080/api`:

| Endpoint | Method | Body / Params | Description |
| :--- | :--- | :--- | :--- |
| `/api/status` | `GET` | - | Returns connection status, volume, current app |
| `/api/power/on` | `POST` | - | Sends Wake-on-LAN packet to turn TV on |
| `/api/power/off` | `POST` | - | Powers TV down |
| `/api/power/screen-off` | `POST` | - | Turns display panel off |
| `/api/volume` | `POST` | `{"volume": 30}` or `{"action": "up"\|"down"\|"toggleMute"}` | Sets or modifies volume level |
| `/api/button/:key` | `POST` | URL param (e.g. `UP`, `DOWN`, `ENTER`, `BACK`, `HOME`) | Simulates remote keypress |
| `/api/keyboard/type` | `POST` | `{"text": "Cyberpunk 2077"}` | Types text onto TV active input field |
| `/api/keyboard/enter` | `POST` | - | Sends Enter key to TV |
| `/api/keyboard/backspace` | `POST` | `{"count": 1}` | Sends Backspace to TV |
| `/api/apps` | `GET` | - | Returns JSON array of installed apps |
| `/api/apps/launch` | `POST` | `{"appId": "youtube.leanback.v4"}` | Launches specified app |
| `/api/youtube` | `POST` | `{"url": "https://..."}` | Launches YouTube video |
| `/api/browser` | `POST` | `{"url": "https://..."}` | Opens URL in TV browser |
| `/api/toast` | `POST` | `{"message": "Hello!"}` | Displays on-screen alert banner |
| `/api/inputs` | `GET` | - | Returns list of HDMI inputs |
| `/api/inputs/switch` | `POST` | `{"inputId": "HDMI_1"}` | Switches active input |
| `/api/config` | `POST` | `{"tvIp": "...", "tvMac": "..."}` | Updates TV network configuration |

---

## 🤖 Lucia AI Integration & Skill

This project includes a dedicated **Antigravity Skill** (`SKILL.md`) enabling **Lucia AI** to:
1. Control the TV using natural language voice and text commands (e.g. *"Lucia, turn on the TV"*, *"Lucia, set TV volume to 25"*, *"Lucia, open Netflix on TV"*).
2. Embed the real-time Web Remote GUI inside Lucia's Dashboard / Smart Home interface via:
   ```html
   <iframe 
     src="http://localhost:8080" 
     title="LG webOS Smart Remote"
     allow="clipboard-read; clipboard-write"
     style="width: 100%; max-width: 480px; height: 820px; border: none; border-radius: 24px; box-shadow: 0 16px 40px rgba(0,0,0,0.5);">
   </iframe>
   ```
3. Type text, search terms, and passwords from Lucia straight onto the TV screen.

---

## 📁 Project Structure

```
lg-smart-tv/
├── src/
│   ├── lgtv.js           # Core LG webOS SSAP & WoL client engine
│   └── config.js         # Configuration & pairing key persistence
├── public/
│   ├── index.html        # Web Remote UI layout
│   ├── style.css         # Glassmorphism dark UI styles
│   └── app.js            # Real-time Web Remote frontend logic
├── config.default.json   # Default configuration template
├── server.js             # Express REST API & Socket.IO server
├── cli.js                # Command line interface tool
├── package.json          # Node.js dependencies and scripts
└── README.md             # Documentation and usage guide
```

---

## 🛡️ License
MIT
