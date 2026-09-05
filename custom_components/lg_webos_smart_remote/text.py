"""Text platform for LG webOS Smart Remote virtual keyboard typing."""
from __future__ import annotations

from homeassistant.components.text import TextEntity, TextMode
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .client import LGWebOSTVClient
from .const import DOMAIN
from .entity import LGWebOSBaseEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the LG webOS Text platform."""
    client: LGWebOSTVClient = hass.data[DOMAIN][entry.entry_id]["client"]
    async_add_entities([LGWebOSTextEntity(client, entry.entry_id)], True)


class LGWebOSTextEntity(LGWebOSBaseEntity, TextEntity):
    """Virtual Keyboard entity for typing search queries into TV."""

    _attr_name = "Virtual Keyboard"
    _attr_icon = "mdi:keyboard"
    _attr_mode = TextMode.TEXT

    def __init__(self, client: LGWebOSTVClient, entry_id: str) -> None:
        """Initialize text entity."""
        super().__init__(client, entry_id, "text_typing")
        self._current_text = ""

    @property
    def native_value(self) -> str:
        """Return current text input."""
        return self._current_text

    async def async_set_value(self, value: str) -> None:
        """Send text to TV search field."""
        self._current_text = value
        await self.client.send_text(value)
        self.async_write_ha_state()
