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

## 🎨 Dashboard Card Examples

### Standard Media Control Card
```yaml
type: media-control
entity: media_player.lg_webos_smart_tv
```

### Living Room Tile Card
```yaml
type: tile
entity: media_player.lg_webos_smart_tv
name: Living Room TV
features:
  - type: media-player-volume-slider
  - type: media-player-source-select
```

### Compact D-Pad Remote Grid
```yaml
type: grid
columns: 3
square: true
cards:
  - type: button
    entity: button.lg_webos_smart_tv_back
    icon: mdi:arrow-left
  - type: button
    entity: button.lg_webos_smart_tv_dpad_up
    icon: mdi:chevron-up
  - type: button
    entity: button.lg_webos_smart_tv_nav_home
    icon: mdi:home
  - type: button
    entity: button.lg_webos_smart_tv_dpad_left
    icon: mdi:chevron-left
  - type: button
    entity: button.lg_webos_smart_tv_dpad_enter
    icon: mdi:checkbox-marked-circle-outline
  - type: button
    entity: button.lg_webos_smart_tv_dpad_right
    icon: mdi:chevron-right
  - type: button
    entity: button.lg_webos_smart_tv_nav_menu
    icon: mdi:cog
  - type: button
    entity: button.lg_webos_smart_tv_dpad_down
    icon: mdi:chevron-down
  - type: button
    entity: button.lg_webos_smart_tv_nav_exit
    icon: mdi:close-circle-outline
```
