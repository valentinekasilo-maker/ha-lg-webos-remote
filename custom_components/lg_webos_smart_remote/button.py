"""Button platform for LG webOS Smart Remote integration."""
from __future__ import annotations

from typing import Callable, Coroutine, Any, NamedTuple

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .client import LGWebOSTVClient
from .const import DOMAIN
from .entity import LGWebOSBaseEntity


class ButtonDescription(NamedTuple):
    """Button entity metadata description."""

    key: str
    name: str
    icon: str
    action: Callable[[LGWebOSTVClient], Coroutine[Any, Any, Any]]


BUTTON_DESCRIPTIONS: list[ButtonDescription] = [
    # Power Controls
    ButtonDescription(
        key="power_on",
        name="Power On (WoL)",
        icon="mdi:power",
        action=lambda client: client.turn_on(),
    ),
    ButtonDescription(
        key="power_off",
        name="Power Off",
        icon="mdi:power-off",
        action=lambda client: client.turn_off(),
    ),
    ButtonDescription(
        key="screen_off",
        name="Turn Screen Off",
        icon="mdi:television-ambient-light",
        action=lambda client: client.turn_screen_off(),
    ),
    ButtonDescription(
        key="screen_on",
        name="Turn Screen On",
        icon="mdi:television-guide",
        action=lambda client: client.turn_screen_on(),
    ),
    # D-Pad Navigation Wheel
    ButtonDescription(
        key="dpad_up",
        name="D-Pad Up",
        icon="mdi:chevron-up",
        action=lambda client: client.send_button("UP"),
    ),
    ButtonDescription(
        key="dpad_down",
        name="D-Pad Down",
        icon="mdi:chevron-down",
        action=lambda client: client.send_button("DOWN"),
    ),
    ButtonDescription(
        key="dpad_left",
        name="D-Pad Left",
        icon="mdi:chevron-left",
        action=lambda client: client.send_button("LEFT"),
    ),
    ButtonDescription(
        key="dpad_right",
        name="D-Pad Right",
        icon="mdi:chevron-right",
        action=lambda client: client.send_button("RIGHT"),
    ),
    ButtonDescription(
        key="dpad_enter",
        name="D-Pad Enter",
        icon="mdi:checkbox-marked-circle-outline",
        action=lambda client: client.send_button("ENTER"),
    ),
    # Menu & Navigation
    ButtonDescription(
        key="nav_back",
        name="Back",
        icon="mdi:arrow-left",
        action=lambda client: client.send_button("BACK"),
    ),
    ButtonDescription(
        key="nav_home",
        name="Home",
        icon="mdi:home",
        action=lambda client: client.send_button("HOME"),
    ),
    ButtonDescription(
        key="nav_menu",
        name="Menu",
        icon="mdi:cog",
        action=lambda client: client.send_button("MENU"),
    ),
    ButtonDescription(
        key="nav_exit",
        name="Exit",
        icon="mdi:close-circle-outline",
        action=lambda client: client.send_button("EXIT"),
    ),
    ButtonDescription(
        key="nav_info",
        name="Info",
        icon="mdi:information-outline",
        action=lambda client: client.send_button("INFO"),
    ),
    ButtonDescription(
        key="nav_guide",
        name="Guide",
        icon="mdi:television-guide",
        action=lambda client: client.send_button("GUIDE"),
    ),
    ButtonDescription(
        key="nav_cc",
        name="Closed Captions",
        icon="mdi:closed-caption",
        action=lambda client: client.send_button("CC"),
    ),
    # Volume & Mute
    ButtonDescription(
        key="vol_up",
        name="Volume Up",
        icon="mdi:volume-plus",
        action=lambda client: client.volume_up(),
    ),
    ButtonDescription(
        key="vol_down",
        name="Volume Down",
        icon="mdi:volume-minus",
        action=lambda client: client.volume_down(),
    ),
    ButtonDescription(
        key="vol_mute",
        name="Mute Toggle",
        icon="mdi:volume-mute",
        action=lambda client: client.set_mute(not client.is_muted),
    ),
    # Channels
    ButtonDescription(
        key="chan_up",
        name="Channel Up",
        icon="mdi:arrow-up-drop-circle-outline",
        action=lambda client: client.channel_up(),
    ),
    ButtonDescription(
        key="chan_down",
        name="Channel Down",
        icon="mdi:arrow-down-drop-circle-outline",
        action=lambda client: client.channel_down(),
    ),
    # Number Pad (0-9, Dash)
    ButtonDescription(
        key="num_0",
        name="0",
        icon="mdi:numeric-0",
        action=lambda client: client.send_button("0"),
    ),
    ButtonDescription(
        key="num_1",
        name="1",
        icon="mdi:numeric-1",
        action=lambda client: client.send_button("1"),
    ),
    ButtonDescription(
        key="num_2",
        name="2",
        icon="mdi:numeric-2",
        action=lambda client: client.send_button("2"),
    ),
    ButtonDescription(
        key="num_3",
        name="3",
        icon="mdi:numeric-3",
        action=lambda client: client.send_button("3"),
    ),
    ButtonDescription(
        key="num_4",
        name="4",
        icon="mdi:numeric-4",
        action=lambda client: client.send_button("4"),
    ),
    ButtonDescription(
        key="num_5",
        name="5",
        icon="mdi:numeric-5",
        action=lambda client: client.send_button("5"),
    ),
    ButtonDescription(
        key="num_6",
        name="6",
        icon="mdi:numeric-6",
        action=lambda client: client.send_button("6"),
    ),
    ButtonDescription(
        key="num_7",
        name="7",
        icon="mdi:numeric-7",
        action=lambda client: client.send_button("7"),
    ),
    ButtonDescription(
        key="num_8",
        name="8",
        icon="mdi:numeric-8",
        action=lambda client: client.send_button("8"),
    ),
    ButtonDescription(
        key="num_9",
        name="9",
        icon="mdi:numeric-9",
        action=lambda client: client.send_button("9"),
    ),
    ButtonDescription(
        key="num_dash",
        name="Dash (-)",
        icon="mdi:minus",
        action=lambda client: client.send_button("DASH"),
    ),
    # 1-Tap Quick Apps
    ButtonDescription(
        key="app_youtube",
        name="YouTube",
        icon="mdi:youtube",
        action=lambda client: client.open_youtube(),
    ),
    ButtonDescription(
        key="app_netflix",
        name="Netflix",
        icon="mdi:netflix",
        action=lambda client: client.launch_app("netflix"),
    ),
    ButtonDescription(
        key="app_spotify",
        name="Spotify",
        icon="mdi:spotify",
        action=lambda client: client.launch_app("spotify-beehive"),
    ),
    ButtonDescription(
        key="app_browser",
        name="Web Browser",
        icon="mdi:web",
        action=lambda client: client.launch_app("com.webos.app.browser"),
    ),
    ButtonDescription(
        key="app_livetv",
        name="Live TV",
        icon="mdi:television-classic",
        action=lambda client: client.launch_app("com.webos.app.livetv"),
    ),
    ButtonDescription(
        key="app_store",
        name="LG Content Store",
        icon="mdi:shopping",
        action=lambda client: client.launch_app("com.webos.app.discovery"),
    ),
    # Media Playback
    ButtonDescription(
        key="media_play",
        name="Play",
        icon="mdi:play",
        action=lambda client: client.media_play(),
    ),
    ButtonDescription(
        key="media_pause",
        name="Pause",
        icon="mdi:pause",
        action=lambda client: client.media_pause(),
    ),
    ButtonDescription(
        key="media_stop",
        name="Stop",
        icon="mdi:stop",
        action=lambda client: client.media_stop(),
    ),
    ButtonDescription(
        key="media_rewind",
        name="Rewind",
        icon="mdi:rewind",
        action=lambda client: client.media_rewind(),
    ),
    ButtonDescription(
        key="media_fastforward",
        name="Fast Forward",
        icon="mdi:fast-forward",
        action=lambda client: client.media_fast_forward(),
    ),
    # Color Keys
    ButtonDescription(
        key="color_red",
        name="Red Key",
        icon="mdi:circle",
        action=lambda client: client.send_button("RED"),
    ),
    ButtonDescription(
        key="color_green",
        name="Green Key",
        icon="mdi:circle",
        action=lambda client: client.send_button("GREEN"),
    ),
    ButtonDescription(
        key="color_yellow",
        name="Yellow Key",
        icon="mdi:circle",
        action=lambda client: client.send_button("YELLOW"),
    ),
    ButtonDescription(
        key="color_blue",
        name="Blue Key",
        icon="mdi:circle",
        action=lambda client: client.send_button("BLUE"),
    ),
    # HDMI Inputs & Source Switch
    ButtonDescription(
        key="input_source",
        name="Input / Source",
        icon="mdi:video-input-hdmi",
        action=lambda client: client.send_button("INPUT"),
    ),
    ButtonDescription(
        key="hdmi_1",
        name="HDMI 1",
        icon="mdi:video-input-hdmi",
        action=lambda client: client.switch_input("HDMI_1"),
    ),
    ButtonDescription(
        key="hdmi_2",
        name="HDMI 2",
        icon="mdi:video-input-hdmi",
        action=lambda client: client.switch_input("HDMI_2"),
    ),
    ButtonDescription(
        key="hdmi_3",
        name="HDMI 3",
        icon="mdi:video-input-hdmi",
        action=lambda client: client.switch_input("HDMI_3"),
    ),
]


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the LG webOS Button platform."""
    client: LGWebOSTVClient = hass.data[DOMAIN][entry.entry_id]["client"]
    entities = [
        LGWebOSButton(client, entry.entry_id, desc) for desc in BUTTON_DESCRIPTIONS
    ]
    async_add_entities(entities, True)


class LGWebOSButton(LGWebOSBaseEntity, ButtonEntity):
    """LG webOS Discrete Button Entity."""

    def __init__(
        self,
        client: LGWebOSTVClient,
        entry_id: str,
        description: ButtonDescription,
    ) -> None:
        """Initialize the button entity."""
        super().__init__(client, entry_id, f"btn_{description.key}")
        self._attr_name = description.name
        self._attr_icon = description.icon
        self._action = description.action

    async def async_press(self) -> None:
        """Execute button press action."""
        res = self._action(self.client)
        if hasattr(res, "__await__"):
            await res
