"""Provides device actions for LG webOS Smart Remote integration."""
from __future__ import annotations

import logging
from typing import Any
import voluptuous as vol

from homeassistant.const import CONF_DEVICE_ID, CONF_DOMAIN, CONF_TYPE
from homeassistant.core import Context, HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType, TemplateVarsType

from .client import LGWebOSTVClient
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

# List of supported device action types
ACTION_TYPES = {
    "power_on": "Power On (Wake-on-LAN)",
    "power_off": "Power Off",
    "screen_off": "Turn Screen Off",
    "screen_on": "Turn Screen On",
    "dpad_up": "D-Pad Up",
    "dpad_down": "D-Pad Down",
    "dpad_left": "D-Pad Left",
    "dpad_right": "D-Pad Right",
    "dpad_enter": "D-Pad Enter / OK",
    "nav_back": "Back",
    "nav_home": "Home",
    "nav_menu": "Menu / Settings",
    "nav_exit": "Exit",
    "vol_up": "Volume Up",
    "vol_down": "Volume Down",
    "vol_mute": "Mute Toggle",
    "chan_up": "Channel Up",
    "chan_down": "Channel Down",
    "app_youtube": "Launch YouTube",
    "app_netflix": "Launch Netflix",
    "app_spotify": "Launch Spotify",
    "app_browser": "Launch Web Browser",
}

ACTION_SCHEMA = cv.DEVICE_ACTION_BASE_SCHEMA.extend(
    {
        vol.Required(CONF_TYPE): vol.In(ACTION_TYPES.keys()),
    }
)


async def async_get_actions(
    hass: HomeAssistant, device_id: str
) -> list[dict[str, Any]]:
    """List device actions for LG webOS Smart TV device."""
    actions = []
    base_action = {
        CONF_DEVICE_ID: device_id,
        CONF_DOMAIN: DOMAIN,
    }

    for action_type in ACTION_TYPES:
        actions.append({**base_action, CONF_TYPE: action_type})

    return actions


async def async_call_action_from_config(
    hass: HomeAssistant,
    config: ConfigType,
    variables: TemplateVarsType,
    context: Context | None,
) -> None:
    """Execute a device action."""
    action_type = config[CONF_TYPE]

    for entry_data in hass.data.get(DOMAIN, {}).values():
        client: LGWebOSTVClient = entry_data.get("client")
        if not client:
            continue

        if action_type == "power_on":
            client.turn_on()
        elif action_type == "power_off":
            await client.turn_off()
        elif action_type == "screen_off":
            await client.turn_screen_off()
        elif action_type == "screen_on":
            await client.turn_screen_on()
        elif action_type == "dpad_up":
            await client.send_button("UP")
        elif action_type == "dpad_down":
            await client.send_button("DOWN")
        elif action_type == "dpad_left":
            await client.send_button("LEFT")
        elif action_type == "dpad_right":
            await client.send_button("RIGHT")
        elif action_type == "dpad_enter":
            await client.send_button("ENTER")
        elif action_type == "nav_back":
            await client.send_button("BACK")
        elif action_type == "nav_home":
            await client.send_button("HOME")
        elif action_type == "nav_menu":
            await client.send_button("MENU")
        elif action_type == "nav_exit":
            await client.send_button("EXIT")
        elif action_type == "vol_up":
            await client.volume_up()
        elif action_type == "vol_down":
            await client.volume_down()
        elif action_type == "vol_mute":
            await client.set_mute(not client.is_muted)
        elif action_type == "chan_up":
            await client.channel_up()
        elif action_type == "chan_down":
            await client.channel_down()
        elif action_type == "app_youtube":
            await client.open_youtube()
        elif action_type == "app_netflix":
            await client.launch_app("netflix")
        elif action_type == "app_spotify":
            await client.launch_app("spotify-beehive")
        elif action_type == "app_browser":
            await client.launch_app("com.webos.app.browser")
