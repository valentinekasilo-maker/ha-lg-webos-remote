"""Media Player platform for LG webOS Smart Remote integration."""
from __future__ import annotations

import logging
from typing import Any, List, Optional

from homeassistant.components.media_player import (
    MediaPlayerDeviceClass,
    MediaPlayerEntity,
    MediaPlayerEntityFeature,
    MediaPlayerState,
)
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
    """Set up the LG webOS Media Player platform."""
    client: LGWebOSTVClient = hass.data[DOMAIN][entry.entry_id]["client"]
    async_add_entities([LGWebOSMediaPlayer(client, entry.entry_id)], True)


class LGWebOSMediaPlayer(LGWebOSBaseEntity, MediaPlayerEntity):
    """LG webOS Smart TV Media Player Entity."""

    _attr_device_class = MediaPlayerDeviceClass.TV
    _attr_name = None  # Use device name

    _attr_supported_features = (
        MediaPlayerEntityFeature.TURN_ON
        | MediaPlayerEntityFeature.TURN_OFF
        | MediaPlayerEntityFeature.VOLUME_SET
        | MediaPlayerEntityFeature.VOLUME_STEP
        | MediaPlayerEntityFeature.VOLUME_MUTE
        | MediaPlayerEntityFeature.SELECT_SOURCE
        | MediaPlayerEntityFeature.PLAY
        | MediaPlayerEntityFeature.PAUSE
        | MediaPlayerEntityFeature.STOP
        | MediaPlayerEntityFeature.PREVIOUS_TRACK
        | MediaPlayerEntityFeature.NEXT_TRACK
    )

    def __init__(self, client: LGWebOSTVClient, entry_id: str) -> None:
        """Initialize the media player entity."""
        super().__init__(client, entry_id, "media_player")

    @property
    def state(self) -> MediaPlayerState:
        """Return current state of the TV."""
        if not self.client.is_connected:
            return MediaPlayerState.OFF
        return MediaPlayerState.ON

    @property
    def is_volume_muted(self) -> bool:
        """Return True if volume is muted."""
        return self.client.is_muted

    @property
    def volume_level(self) -> Optional[float]:
        """Return volume level from 0.0 to 1.0."""
        if self.client.volume is not None:
            return float(self.client.volume) / 100.0
        return None

    @property
    def source(self) -> Optional[str]:
        """Return current foreground source or app name."""
        cur = self.client.current_app
        if not cur:
            return None
        # Find friendly name if available
        for app in self.client.installed_apps:
            if app.get("id") == cur and app.get("title"):
                return app.get("title")
        return cur

    @property
    def source_list(self) -> List[str]:
        """Return list of available source names."""
        sources = [
            "Home",
            "YouTube",
            "Netflix",
            "Spotify",
            "Web Browser",
            "Live TV",
        ]
        for app in self.client.installed_apps:
            title = app.get("title")
            if title and title not in sources:
                sources.append(title)
        for inp in self.client.inputs:
            label = inp.get("label") or inp.get("id")
            if label and label not in sources:
                sources.append(label)
        return sources

    async def async_turn_on(self) -> None:
        """Turn the TV on via Wake-on-LAN."""
        self.client.turn_on()

    async def async_turn_off(self) -> None:
        """Turn the TV off."""
        await self.client.turn_off()

    async def async_set_volume_level(self, volume: float) -> None:
        """Set volume level (0.0 to 1.0)."""
        await self.client.set_volume(int(round(volume * 100)))

    async def async_volume_up(self) -> None:
        """Step volume up."""
        await self.client.volume_up()

    async def async_volume_down(self) -> None:
        """Step volume down."""
        await self.client.volume_down()

    async def async_mute_volume(self, mute: bool) -> None:
        """Set mute state."""
        await self.client.set_mute(mute)

    async def async_select_source(self, source: str) -> None:
        """Select input source or launch app."""
        s = source.strip()
        # Check installed apps by title or id
        for app in self.client.installed_apps:
            if (app.get("title") and app["title"].lower() == s.lower()) or app.get("id") == s:
                await self.client.launch_app(app["id"])
                return

        lower = s.lower()
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
            await self.client.switch_input(s.upper())
        else:
            await self.client.launch_app(s)

    async def async_media_play(self) -> None:
        """Play media."""
        await self.client.media_play()

    async def async_media_pause(self) -> None:
        """Pause media."""
        await self.client.media_pause()

    async def async_media_stop(self) -> None:
        """Stop media."""
        await self.client.media_stop()

    async def async_media_previous_track(self) -> None:
        """Rewind / Previous track."""
        await self.client.media_rewind()

    async def async_media_next_track(self) -> None:
        """Fast forward / Next track."""
        await self.client.media_fast_forward()
