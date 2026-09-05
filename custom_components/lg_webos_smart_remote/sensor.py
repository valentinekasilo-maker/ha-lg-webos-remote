"""Sensor platform for LG webOS Smart Remote integration."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
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
    """Set up the LG webOS Sensor platform."""
    client: LGWebOSTVClient = hass.data[DOMAIN][entry.entry_id]["client"]
    async_add_entities(
        [
            LGWebOSCurrentAppSensor(client, entry.entry_id),
            LGWebOSVolumeSensor(client, entry.entry_id),
        ],
        True,
    )


class LGWebOSCurrentAppSensor(LGWebOSBaseEntity, SensorEntity):
    """Sensor tracking foreground application on TV."""

    _attr_name = "Current App"
    _attr_icon = "mdi:application"

    def __init__(self, client: LGWebOSTVClient, entry_id: str) -> None:
        """Initialize current app sensor."""
        super().__init__(client, entry_id, "s_current_app")

    @property
    def native_value(self) -> str | None:
        """Return the current foreground app name."""
        cur = self.client.current_app
        if not cur:
            return "Off" if not self.client.is_connected else "None"
        for app in self.client.installed_apps:
            if app.get("id") == cur and app.get("title"):
                return app.get("title")
        return cur


class LGWebOSVolumeSensor(LGWebOSBaseEntity, SensorEntity):
    """Sensor tracking volume percentage level."""

    _attr_name = "Volume"
    _attr_icon = "mdi:volume-high"
    _attr_native_unit_of_measurement = "%"

    def __init__(self, client: LGWebOSTVClient, entry_id: str) -> None:
        """Initialize volume sensor."""
        super().__init__(client, entry_id, "s_volume")

    @property
    def native_value(self) -> int | None:
        """Return current volume percentage."""
        return self.client.volume
