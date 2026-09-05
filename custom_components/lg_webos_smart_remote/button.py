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
