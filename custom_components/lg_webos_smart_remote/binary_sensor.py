"""Binary sensor platform for LG webOS Smart Remote integration."""
from __future__ import annotations

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
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
    """Set up the LG webOS Binary Sensor platform."""
    client: LGWebOSTVClient = hass.data[DOMAIN][entry.entry_id]["client"]
    async_add_entities(
        [
            LGWebOSPowerBinarySensor(client, entry.entry_id),
            LGWebOSConnectivityBinarySensor(client, entry.entry_id),
            LGWebOSMutedBinarySensor(client, entry.entry_id),
        ],
        True,
    )


class LGWebOSPowerBinarySensor(LGWebOSBaseEntity, BinarySensorEntity):
    """Binary sensor for TV power status."""

    _attr_name = "Power"
    _attr_device_class = BinarySensorDeviceClass.POWER

    def __init__(self, client: LGWebOSTVClient, entry_id: str) -> None:
        """Initialize power sensor."""
        super().__init__(client, entry_id, "bs_power")

    @property
    def is_on(self) -> bool:
        """Return True if TV is powered on and responsive."""
        return self.client.is_connected


class LGWebOSConnectivityBinarySensor(LGWebOSBaseEntity, BinarySensorEntity):
    """Binary sensor for TV network connectivity."""

    _attr_name = "Connectivity"
    _attr_device_class = BinarySensorDeviceClass.CONNECTIVITY

    def __init__(self, client: LGWebOSTVClient, entry_id: str) -> None:
        """Initialize connectivity sensor."""
        super().__init__(client, entry_id, "bs_connectivity")

    @property
    def is_on(self) -> bool:
        """Return True if connected over network."""
        return self.client.is_connected


class LGWebOSMutedBinarySensor(LGWebOSBaseEntity, BinarySensorEntity):
    """Binary sensor for TV mute status."""

    _attr_name = "Muted"
    _attr_icon = "mdi:volume-mute"

    def __init__(self, client: LGWebOSTVClient, entry_id: str) -> None:
        """Initialize mute sensor."""
        super().__init__(client, entry_id, "bs_muted")

    @property
    def is_on(self) -> bool:
        """Return True if audio is muted."""
        return self.client.is_muted
