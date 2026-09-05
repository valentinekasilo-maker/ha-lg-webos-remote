"""Base entity for LG webOS Smart Remote integration."""
from __future__ import annotations

from homeassistant.helpers.entity import DeviceInfo, Entity

from .client import LGWebOSTVClient
from .const import CONF_MAC, CONF_NAME, DEFAULT_NAME, DEFAULT_SUGGESTED_AREA, DOMAIN


class LGWebOSBaseEntity(Entity):
    """Base class for all LG webOS Smart Remote entities."""

    _attr_has_entity_name = True

    def __init__(self, client: LGWebOSTVClient, entry_id: str, unique_suffix: str) -> None:
        """Initialize the base entity."""
        self.client = client
        self.entry_id = entry_id
        clean_mac = client.mac.replace(":", "").upper()
        self._attr_unique_id = f"{DOMAIN}_{clean_mac}_{unique_suffix}"

        # Register under the dedicated LG webOS Smart TV device
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, clean_mac)},
            connections={("mac", client.mac)} if client.mac else set(),
            name=DEFAULT_NAME,
            manufacturer="LG Electronics",
            model="webOS Smart TV",
            sw_version="webOS 1.1.0",
            suggested_area=DEFAULT_SUGGESTED_AREA,
            configuration_url=f"http://{client.host}" if client.host else None,
        )

    async def async_added_to_hass(self) -> None:
        """Register callbacks when entity is added."""
        self.async_on_remove(self.client.register_callback(self.async_write_ha_state))

    @property
    def available(self) -> bool:
        """Return True if device is available."""
        # Entities remain available so power-on (WoL) and commands can be executed
        return True
