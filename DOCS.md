# LG webOS Smart Remote - Home Assistant Device & Entity Integration

A full-featured Home Assistant Device & Entity integration and cybernetic glassmorphic web controller, pointer air mouse, and virtual typing keyboard for LG webOS Smart TVs.

## 🌟 Home Assistant Native Device Architecture
This integration registers your LG TV as a **first-class physical Device** in Home Assistant's Device Registry:
- **Device Name**: `LG webOS Smart TV`
- **Manufacturer**: `LG Electronics`
- **Model**: `webOS Smart TV`
- **Suggested Area**: `Living Room` (Assign to any room/area in Home Assistant)

### 🎛️ Exposed Entities
| Domain | Entity ID | Purpose |
| :--- | :--- | :--- |
| `media_player` | `media_player.lg_webos_smart_tv` | Full media player: Power, Volume Slider, Mute, Source/App Switcher, Playback |
| `remote` | `remote.lg_webos_smart_tv` | Standard Remote supporting `remote.send_command` (D-Pad, Menu, Back, Home) |
| `button` | `button.lg_webos_smart_tv_power_on` | Instant Wake-on-LAN Power On |
| `button` | `button.lg_webos_smart_tv_power_off` | Instant Power Off |
| `button` | `button.lg_webos_smart_tv_screen_off` | Turn OLED/LED screen off while keeping audio streaming |
| `button` | `button.lg_webos_smart_tv_dpad_*` | D-Pad Navigation buttons (Up, Down, Left, Right, Enter) |
| `button` | `button.lg_webos_smart_tv_app_*` | 1-Tap App Launchers (YouTube, Netflix, Spotify, Web Browser) |
| `select` | `select.lg_webos_smart_tv_input_source` | Real-time synced dropdown for apps and HDMI inputs |
| `sensor` | `sensor.lg_webos_smart_tv_current_app` | Current foreground app tracker |
| `sensor` | `sensor.lg_webos_smart_tv_volume` | Live volume level % |
| `binary_sensor` | `binary_sensor.lg_webos_smart_tv_power` | TV Power & Online status |
| `text` | `text.lg_webos_smart_tv_virtual_keyboard` | Direct search bar typing from any Home Assistant card |

---

## ⚙️ Configuration

In the Add-on **Configuration** tab:

```yaml
tv_ip: "192.168.50.145" # Your LG TV IP address
tv_mac: "DC:03:98:69:CC:9A" # Your LG TV MAC address (for Wake-on-LAN power on)
mqtt_host: "core-mosquitto" # Mosquitto MQTT broker hostname
mqtt_port: 1883
device_name: "LG webOS Smart TV"
device_area: "Living Room"
```

1. Click **Save** and **Start**.
2. Go to **Settings ➔ Devices & Services ➔ Devices** ➔ **LG webOS Smart TV** to view and customize all entities.
3. Add Tile Cards, Media Control Cards, or Remote Cards directly to your **Living Room** dashboard tab!

---

## 🎨 Instant 1-Tap Home Assistant Remote Cards (Zero Popup, Zero Delay)

### Option 1: Dedicated 1-Tap LG Remote Card (`custom:lg-remote-card`)
This card is built directly into the integration and provides a tactile glassmorphic remote with the unified D-Pad wheel:

```yaml
type: custom:lg-remote-card
name: Living Room Remote
media_player: media_player.lg_webos_smart_tv
remote_entity: remote.lg_webos_smart_tv
```

---

### Option 2: 100% Native Standard Home Assistant Cards with Instant 1-Tap Execution
To ensure buttons execute immediately with **NO detail popup and NO second "Press" click**, configure `tap_action` as `perform-action` / `call-service`:

```yaml
type: vertical-stack
title: Living Room TV Remote
cards:
  # 1. Power, Mute & Apps
  - type: horizontal-stack
    cards:
      - type: button
        name: Power
        icon: mdi:power
        tap_action:
          action: call-service
          service: remote.send_command
          target:
            entity_id: remote.lg_webos_smart_tv
          data:
            command: POWER
      - type: button
        name: Screen Off
        icon: mdi:television-ambient-light
        tap_action:
          action: call-service
          service: lg_webos_smart_remote.screen_off
      - type: button
        name: YouTube
        icon: mdi:youtube
        tap_action:
          action: call-service
          service: lg_webos_smart_remote.open_youtube
      - type: button
        name: Netflix
        icon: mdi:netflix
        tap_action:
          action: call-service
          service: media_player.select_source
          target:
            entity_id: media_player.lg_webos_smart_tv
          data:
            source: Netflix

  # 2. Unified D-Pad Navigation & OK Wheel
  - type: grid
    columns: 3
    square: true
    cards:
      # Row 1
      - type: button
        icon: mdi:arrow-left
        name: Back
        tap_action:
          action: call-service
          service: remote.send_command
          target:
            entity_id: remote.lg_webos_smart_tv
          data:
            command: BACK
      - type: button
        icon: mdi:chevron-up
        name: Up
        tap_action:
          action: call-service
          service: remote.send_command
          target:
            entity_id: remote.lg_webos_smart_tv
          data:
            command: UP
      - type: button
        icon: mdi:home
        name: Home
        tap_action:
          action: call-service
          service: remote.send_command
          target:
            entity_id: remote.lg_webos_smart_tv
          data:
            command: HOME

      # Row 2 (Left, OK / Enter, Right)
      - type: button
        icon: mdi:chevron-left
        name: Left
        tap_action:
          action: call-service
          service: remote.send_command
          target:
            entity_id: remote.lg_webos_smart_tv
          data:
            command: LEFT
      - type: button
        icon: mdi:checkbox-marked-circle-outline
        name: OK
        tap_action:
          action: call-service
          service: remote.send_command
          target:
            entity_id: remote.lg_webos_smart_tv
          data:
            command: ENTER
      - type: button
        icon: mdi:chevron-right
        name: Right
        tap_action:
          action: call-service
          service: remote.send_command
          target:
            entity_id: remote.lg_webos_smart_tv
          data:
            command: RIGHT

      # Row 3
      - type: button
        icon: mdi:cog
        name: Menu
        tap_action:
          action: call-service
          service: remote.send_command
          target:
            entity_id: remote.lg_webos_smart_tv
          data:
            command: MENU
      - type: button
        icon: mdi:chevron-down
        name: Down
        tap_action:
          action: call-service
          service: remote.send_command
          target:
            entity_id: remote.lg_webos_smart_tv
          data:
            command: DOWN
      - type: button
        icon: mdi:close-circle-outline
        name: Exit
        tap_action:
          action: call-service
          service: remote.send_command
          target:
            entity_id: remote.lg_webos_smart_tv
          data:
            command: EXIT

  # 3. Volume & Channel Rockers
  - type: horizontal-stack
    cards:
      - type: button
        icon: mdi:volume-minus
        name: Vol −
        tap_action:
          action: call-service
          service: media_player.volume_down
          target:
            entity_id: media_player.lg_webos_smart_tv
      - type: button
        icon: mdi:volume-mute
        name: Mute
        tap_action:
          action: call-service
          service: remote.send_command
          target:
            entity_id: remote.lg_webos_smart_tv
          data:
            command: MUTE
      - type: button
        icon: mdi:volume-plus
        name: Vol +
        tap_action:
          action: call-service
          service: media_player.volume_up
          target:
            entity_id: media_player.lg_webos_smart_tv
```
