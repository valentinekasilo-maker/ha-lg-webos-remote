"""Select platform for LG webOS Smart Remote integration."""
from __future__ import annotations

import logging
from typing import List

from homeassistant.components.select import SelectEntity
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
    """Set up the LG webOS Select platform."""
    client: LGWebOSTVClient = hass.data[DOMAIN][entry.entry_id]["client"]
    async_add_entities([LGWebOSSourceSelect(client, entry.entry_id)], True)


class LGWebOSSourceSelect(LGWebOSBaseEntity, SelectEntity):
    """LG webOS Input / App Source Selector."""

    _attr_name = "Input Source"
    _attr_icon = "mdi:video-input-hdmi"

    def __init__(self, client: LGWebOSTVClient, entry_id: str) -> None:
        """Initialize source selector."""
        super().__init__(client, entry_id, "select_source")

    @property
    def current_option(self) -> str | None:
        """Return the current foreground app or input."""
        cur = self.client.current_app
        if not cur:
            return None
        for app in self.client.installed_apps:
            if app.get("id") == cur and app.get("title"):
                return app.get("title")
        return cur

    @property
    def options(self) -> List[str]:
        """Return list of available source options."""
        base_options = [
            "Home",
            "YouTube",
            "Netflix",
            "Spotify",
            "Web Browser",
            "Live TV",
        ]
        for app in self.client.installed_apps:
            t = app.get("title")
            if t and t not in base_options:
                base_options.append(t)
        for inp in self.client.inputs:
            lbl = inp.get("label") or inp.get("id")
            if lbl and lbl not in base_options:
                base_options.append(lbl)
        return base_options

    async def async_select_option(self, option: str) -> None:
        """Change the selected source option."""
        opt = option.strip()
        for app in self.client.installed_apps:
            if (app.get("title") and app["title"].lower() == opt.lower()) or app.get("id") == opt:
                await self.client.launch_app(app["id"])
                return

        lower = opt.lower()
        if "youtube" in lower:
            await self.client.open_youtube()
        elif "netflix" in lower:
            await self.client.launch_app("netflix")
        elif "spotify" in lower:
            await self.client.launch_app("spotify-beehive")
        elif "browser" in lower or "web" in lower:
            await self.client.launch_app("com.webos.app.browser")
        elif "home" in lower:
            await self.client.launch_app("com.webos.app.home")
        elif "live" in lower or "tv" in lower:
            await self.client.launch_app("com.webos.app.livetv")
        elif lower.startswith("hdmi"):
            await self.client.switch_input(opt.upper())
        else:
            await self.client.launch_app(opt)
