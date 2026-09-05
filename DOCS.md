# LG webOS Smart Remote - Home Assistant Add-on

A full-featured cybernetic glassmorphic web controller, pointer air mouse, and virtual typing keyboard for LG webOS Smart TVs.

## Features
- 🎮 **Tactile Cybernetic Remote**: D-Pad navigation wheel, Volume & Channel rockers, Numpad, and Color buttons.
- ⌨️ **Smart Virtual Keyboard & Luna IME**: Type or paste search queries straight into YouTube, Netflix, and browser search fields.
- 🖱️ **Pointer Air Mouse Socket**: Low-latency pointer control via webOS input socket.
- ⚡ **Wake-on-LAN & Screen-Off**: Turn TV on from standby, or blank the OLED/LED screen while keeping audio streaming.
- 🚀 **1-Tap Quick Apps**: Fast launch YouTube, Netflix, Prime Video, Browser, and HDMI inputs.
- 💬 **On-Screen HUD Toast Alerts**: Broadcast custom notifications directly to your TV screen.
- 🛡️ **Home Assistant Ingress**: Embedded directly into your Home Assistant left sidebar with zero port forwarding.

---

## Configuration

In the Add-on **Configuration** tab:

```yaml
tv_ip: "192.168.50.145" # Your LG TV IP address
tv_mac: "DC:03:98:69:CC:9A" # Your LG TV MAC address (for Wake-on-LAN power on)
```

1. Click **Save**.
2. Start the add-on and open the Web UI (or click **LG Remote** in the left sidebar).
3. If this is your first time connecting, click **Allow** on the pairing prompt that appears on your TV screen!

---

## Home Assistant REST Commands Integration

You can trigger remote actions directly from Home Assistant automations and scripts by adding this to your `configuration.yaml`:

```yaml
rest_command:
  lg_tv_screen_off:
    url: "http://127.0.0.1:8080/api/power/screen-off"
    method: POST
  lg_tv_screen_on:
    url: "http://127.0.0.1:8080/api/power/screen-on"
    method: POST
  lg_tv_toast:
    url: "http://127.0.0.1:8080/api/toast"
    method: POST
    headers:
      content-type: "application/json"
    payload: '{"message": "{{ message }}"}'
  lg_tv_type:
    url: "http://127.0.0.1:8080/api/type"
    method: POST
    headers:
      content-type: "application/json"
    payload: '{"text": "{{ text }}"}'
```
