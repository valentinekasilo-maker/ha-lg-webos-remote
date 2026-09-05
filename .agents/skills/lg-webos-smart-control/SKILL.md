---
name: lg-webos-smart-control
description: Complete integration skill for Lucia AI to control LG webOS Smart TVs over LAN, Ngrok Cloud Tunnel (dominque-hydrocephalic-unconsiderablely.ngrok-free.dev), and Render deployment, including Wake-on-LAN power on/off, volume, D-Pad navigation, app launching (YouTube/Netflix/Spotify), smart keyboard typing, on-screen toast alerts, and embedded glassmorphic Web Remote GUI.
version: 1.0.0
---

# LG webOS Smart TV Control & Remote Integration for Lucia AI

## 🎯 Objective for Lucia AI
When this skill is executed or invoked, Lucia AI will:
1. **Control LG webOS Smart TVs** over the local Wi-Fi / Ethernet network or via Cloud Ngrok Tunnel (`https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev`).
2. **Translate natural language voice & chat commands** into direct REST API actions (e.g., *"Lucia, turn on the TV"*, *"Set TV volume to 30"*, *"Open YouTube on TV"*, *"Type interstellar on TV"*).
3. **Embed the real-time glassmorphic Web Remote GUI** inside Lucia's **Smart Home / TV Remote** dashboard panel.
4. **Send instant on-screen toast alerts & notifications** from Lucia to the TV screen from anywhere in the world.
5. **Rebuild or spin up the controller service** seamlessly.

---

## ⚙️ Environment Configuration (`.env` / `config.json`)

```env
# LG webOS Smart TV Details
TV_IP=192.168.50.145
TV_MAC=DC:03:98:69:CC:9A
TV_CLIENT_KEY=7d5d8bb32bcaffe8539149791e4cb037

# Web Remote & REST API Server Port
PORT=8080

# Cloud Public Domain
CLOUD_URL=https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev
```

`config.json`:
```json
{
  "tvIp": "192.168.50.145",
  "tvMac": "DC:03:98:69:CC:9A",
  "clientKey": "7d5d8bb32bcaffe8539149791e4cb037",
  "saveKey": true,
  "port": 3000,
  "webServerPort": 8080,
  "reconnectInterval": 5000
}
```

---

## ☁️ Cloud Tunnel & Global Access (Ngrok)

Your dedicated static cloud endpoint is:
**`https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev`**

### To Start the Tunnel:
```bash
# In your terminal:
npm run tunnel:ngrok
# Or:
ngrok http 8080 --url https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev
```

---

## 🏗️ Exact Architecture & Dependencies

To reproduce or spin up the controller service from scratch:

### 1. `package.json` Dependencies
```json
{
  "name": "lg-webos-controller",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "cli": "node cli.js",
    "tunnel": "lt --port 8080",
    "tunnel:ngrok": "npx ngrok http 8080 --url https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "lgtv2": "^1.4.3",
    "socket.io": "^4.8.1",
    "wake_on_lan": "^1.0.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "localtunnel": "^2.0.2"
  }
}
```

### 2. Core Modules
- **`src/lgtv.js`**: SSAP protocol manager, client key caching, auto-reconnect, Wake-on-LAN magic packet dispatcher, pointer socket handling, Luna IME typing, and subscription streams.
- **`src/config.js`**: Loads and persists TV IP, MAC address, pairing keys, and server ports.
- **`server.js`**: Express REST API + Socket.IO server serving `public/` web dashboard.
- **`public/`**: Glassmorphic dark cybernetic Web Remote UI (`index.html`, `style.css`, `app.js`).
- **`cli.js`**: Standalone terminal execution tool.

---

## 🌐 Lucia AI Natural Language & Action Handlers

Lucia AI translates user voice/chat prompts into the following HTTP requests:

### 1. Power Operations
* **"Lucia, turn on the TV"** (Wake-on-LAN):
  ```http
  POST https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev/api/power/on
  ```
* **"Lucia, turn off the TV"**:
  ```http
  POST https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev/api/power/off
  ```
* **"Lucia, turn screen off"** (Screen off, audio continues):
  ```http
  POST https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev/api/power/screen-off
  ```
* **"Lucia, turn screen back on"**:
  ```http
  POST https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev/api/power/screen-on
  ```

---

### 2. Volume & Audio Operations
* **"Lucia, set TV volume to 25"**:
  ```http
  POST https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev/api/volume
  Content-Type: application/json

  {"volume": 25}
  ```
* **"Lucia, volume up" / "volume down"**:
  ```http
  POST https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev/api/volume
  Content-Type: application/json

  {"action": "up"}
  ```
  *(or `{"action": "down"}`)*
* **"Lucia, mute TV" / "unmute TV"**:
  ```http
  POST https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev/api/volume
  Content-Type: application/json

  {"action": "toggleMute"}
  ```

---

### 3. Remote Navigation & D-Pad Controls
* **"Lucia, press UP / DOWN / LEFT / RIGHT / OK / BACK / HOME"**:
  ```http
  POST https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev/api/button/:KEY
  ```
  *(Valid `:KEY`: `UP`, `DOWN`, `LEFT`, `RIGHT`, `ENTER`, `BACK`, `HOME`, `EXIT`, `MENU`, `INFO`, `RED`, `GREEN`, `YELLOW`, `BLUE`)*

---

### 4. Smart TV Keyboard & Text Typing
* **"Lucia, type 'Cyberpunk 2077' on the TV"**:
  ```http
  POST https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev/api/keyboard/type
  Content-Type: application/json

  {"text": "Cyberpunk 2077"}
  ```
* **"Lucia, press Enter on the TV"**:
  ```http
  POST https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev/api/keyboard/enter
  ```
* **"Lucia, delete character / backspace on TV"**:
  ```http
  POST https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev/api/keyboard/backspace
  Content-Type: application/json

  {"count": 1}
  ```

---

### 5. Launching Applications & Inputs
* **"Lucia, open YouTube on TV"** (or play specific video):
  ```http
  POST https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev/api/youtube
  Content-Type: application/json

  {"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
  ```
* **"Lucia, open Netflix / Spotify / Browser"**:
  ```http
  POST https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev/api/apps/launch
  Content-Type: application/json

  {"appId": "netflix"}
  ```
  *(Common appIds: `youtube.leanback.v4`, `netflix`, `spotify-beehive`, `amazon`, `com.webos.app.browser`)*
* **"Lucia, switch TV to HDMI 1"**:
  ```http
  POST https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev/api/inputs/switch
  Content-Type: application/json

  {"inputId": "HDMI_1"}
  ```
* **"Lucia, list installed apps on TV"**:
  ```http
  GET https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev/api/apps
  ```

---

### 6. On-Screen Toast Notifications
* **"Lucia, show message on TV: 'Dinner is ready!'"**:
  ```http
  POST https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev/api/toast
  Content-Type: application/json

  {"message": "Dinner is ready!"}
  ```

---

### 7. Status & Monitoring
* **"Lucia, check TV status"**:
  ```http
  GET https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev/api/status
  ```

---

## 🖼️ Lucia Dashboard GUI Embedding

To embed the Web Remote Controller directly inside Lucia AI's interface (Smart Home Panel / Dashboard Settings):

```html
<iframe 
  src="https://dominque-hydrocephalic-unconsiderablely.ngrok-free.dev" 
  title="LG webOS Smart Remote"
  allow="clipboard-read; clipboard-write"
  style="width: 100%; max-width: 480px; height: 820px; border: none; border-radius: 24px; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5); overflow: hidden;">
</iframe>
```

---

## 🚀 Service Startup & Management

```bash
# Start background server & Web Remote
npm start

# Start Ngrok Cloud Tunnel
npm run tunnel:ngrok
```
