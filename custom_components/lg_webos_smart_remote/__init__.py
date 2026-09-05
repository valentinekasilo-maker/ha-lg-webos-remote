"""LG webOS Smart Remote Home Assistant Custom Integration."""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
import homeassistant.helpers.config_validation as cv
from homeassistant.helpers import device_registry as dr

from .client import LGWebOSTVClient
from .const import (
    CONF_BROADCAST_ADDRESS,
    CONF_CLIENT_KEY,
    CONF_HOST,
    CONF_MAC,
    CONF_NAME,
    DEFAULT_NAME,
    DEFAULT_SUGGESTED_AREA,
    DOMAIN,
    PLATFORMS,
    SERVICE_OPEN_YOUTUBE,
    SERVICE_SCREEN_OFF,
    SERVICE_SCREEN_ON,
    SERVICE_SEND_BUTTON,
    SERVICE_SEND_TEXT,
    SERVICE_SHOW_TOAST,
)

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    """Set up the LG webOS Smart Remote component and register services."""
    hass.data.setdefault(DOMAIN, {})

    async def handle_send_button(call: ServiceCall) -> None:
        """Handle send_button service."""
        button = call.data.get("button")
        for entry_data in hass.data[DOMAIN].values():
            client: LGWebOSTVClient = entry_data.get("client")
            if client:
                await client.send_button(button)

    async def handle_send_text(call: ServiceCall) -> None:
        """Handle send_text service."""
        text = call.data.get("text")
        for entry_data in hass.data[DOMAIN].values():
            client: LGWebOSTVClient = entry_data.get("client")
            if client:
                await client.send_text(text)

    async def handle_show_toast(call: ServiceCall) -> None:
        """Handle show_toast service."""
        message = call.data.get("message")
        icon = call.data.get("icon")
        for entry_data in hass.data[DOMAIN].values():
            client: LGWebOSTVClient = entry_data.get("client")
            if client:
                await client.show_toast(message, icon)

    async def handle_screen_off(call: ServiceCall) -> None:
        """Handle screen_off service."""
        for entry_data in hass.data[DOMAIN].values():
            client: LGWebOSTVClient = entry_data.get("client")
            if client:
                await client.turn_screen_off()

    async def handle_screen_on(call: ServiceCall) -> None:
        """Handle screen_on service."""
        for entry_data in hass.data[DOMAIN].values():
            client: LGWebOSTVClient = entry_data.get("client")
            if client:
                await client.turn_screen_on()

    async def handle_open_youtube(call: ServiceCall) -> None:
        """Handle open_youtube service."""
        video_id = call.data.get("video_id", "")
        for entry_data in hass.data[DOMAIN].values():
            client: LGWebOSTVClient = entry_data.get("client")
            if client:
                await client.open_youtube(video_id)

    # Register custom device actions & services
    hass.services.async_register(
        DOMAIN,
        SERVICE_SEND_BUTTON,
        handle_send_button,
        schema=vol.Schema({vol.Required("button"): cv.string}),
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_SEND_TEXT,
        handle_send_text,
        schema=vol.Schema({vol.Required("text"): cv.string}),
    )

    hass.services.async_register(
        DOMAIN,
        SERVICE_SHOW_TOAST,
        handle_show_toast,
        schema=vol.Schema(
            {vol.Required("message"): cv.string, vol.Optional("icon"): cv.string}
        ),
    )

    hass.services.async_register(DOMAIN, SERVICE_SCREEN_OFF, handle_screen_off)
    hass.services.async_register(DOMAIN, SERVICE_SCREEN_ON, handle_screen_on)

    hass.services.async_register(
        DOMAIN,
        SERVICE_OPEN_YOUTUBE,
        handle_open_youtube,
        schema=vol.Schema({vol.Optional("video_id"): cv.string}),
    )

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up LG webOS Smart Remote from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    host = entry.data[CONF_HOST]
    mac = entry.data.get(CONF_MAC, "")
    client_key = entry.data.get(CONF_CLIENT_KEY, "")
    broadcast = entry.options.get(
        CONF_BROADCAST_ADDRESS, entry.data.get(CONF_BROADCAST_ADDRESS, "255.255.255.255")
    )

    client = LGWebOSTVClient(
        host=host,
        mac=mac,
        client_key=client_key,
        broadcast_address=broadcast,
    )

    hass.data[DOMAIN][entry.entry_id] = {"client": client}

    # Register device directly into Home Assistant Device Registry
    clean_mac = mac.replace(":", "").upper()
    device_registry = dr.async_get(hass)
    device_registry.async_get_or_create(
        config_entry_id=entry.entry_id,
        identifiers={(DOMAIN, clean_mac)},
        connections={("mac", mac)} if mac else set(),
        name=DEFAULT_NAME,
        manufacturer="LG Electronics",
        model="webOS Smart TV",
        sw_version="webOS 1.1.0",
        suggested_area=DEFAULT_SUGGESTED_AREA,
        configuration_url=f"http://{host}",
    )

    # Initial connection attempt
    hass.async_create_task(client.connect())

    # Forward setup to all entity platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        data = hass.data[DOMAIN].pop(entry.entry_id, {})
        client: LGWebOSTVClient = data.get("client")
        if client:
            await client.disconnect()

    return unload_ok
