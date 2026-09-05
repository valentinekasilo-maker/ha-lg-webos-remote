"""Remote platform for LG webOS Smart Remote integration."""
from __future__ import annotations

import logging
from typing import Any, Iterable

from homeassistant.components.remote import RemoteEntity, RemoteEntityFeature
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .client import LGWebOSTVClient
from .const import DOMAIN
from .entity import LGWebOSBaseEntity

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the LG webOS Remote platform."""
    client: LGWebOSTVClient = hass.data[DOMAIN][entry.entry_id]["client"]
    async_add_entities([LGWebOSRemote(client, entry.entry_id)], True)


class LGWebOSRemote(LGWebOSBaseEntity, RemoteEntity):
    """LG webOS Smart Remote Entity."""

    _attr_name = "Remote"
    _attr_icon = "mdi:remote-tv"
    _attr_supported_features = RemoteEntityFeature.TURN_ON | RemoteEntityFeature.TURN_OFF

    def __init__(self, client: LGWebOSTVClient, entry_id: str) -> None:
        """Initialize remote entity."""
        super().__init__(client, entry_id, "remote")

    @property
    def is_on(self) -> bool:
        """Return True if TV is connected."""
        return self.client.is_connected

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Turn TV on via Wake-on-LAN."""
        self.client.turn_on()

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Turn TV off."""
        await self.client.turn_off()

    async def async_send_command(self, command: Iterable[str], **kwargs: Any) -> None:
        """Send a sequence of remote commands to the TV."""
        for cmd in command:
            c = str(cmd).strip().upper()
            if c in ("UP", "DOWN", "LEFT", "RIGHT", "ENTER", "BACK", "HOME", "MENU", "EXIT", "RED", "GREEN", "YELLOW", "BLUE"):
                await self.client.send_button(c)
            elif c in ("VOLUME_UP", "VOLUMEUP", "VOLUP"):
                await self.client.volume_up()
            elif c in ("VOLUME_DOWN", "VOLUMEDOWN", "VOLDOWN"):
                await self.client.volume_down()
            elif c in ("MUTE", "VOLUMEMUTE"):
                await self.client.set_mute(not self.client.is_muted)
            elif c in ("CHANNEL_UP", "CHANNELUP", "CHANUP"):
                await self.client.channel_up()
            elif c in ("CHANNEL_DOWN", "CHANNELDOWN", "CHANDOWN"):
                await self.client.channel_down()
            elif c == "PLAY":
                await self.client.media_play()
            elif c == "PAUSE":
                await self.client.media_pause()
            elif c == "STOP":
                await self.client.media_stop()
            elif c in ("SCREEN_OFF", "SCREENOFF"):
                await self.client.turn_screen_off()
            elif c in ("SCREEN_ON", "SCREENON"):
                await self.client.turn_screen_on()
            elif c in ("POWER_OFF", "POWEROFF", "OFF"):
                await self.client.turn_off()
            elif c in ("POWER_ON", "POWERON", "ON", "WOL"):
                self.client.turn_on()
            else:
                await self.client.send_button(c)
