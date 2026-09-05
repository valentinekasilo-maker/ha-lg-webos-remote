"""Config flow for LG webOS Smart Remote integration."""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult
import homeassistant.helpers.config_validation as cv

from .client import LGWebOSTVClient
from .const import (
    CONF_BROADCAST_ADDRESS,
    CONF_CLIENT_KEY,
    CONF_HOST,
    CONF_MAC,
    CONF_NAME,
    DEFAULT_NAME,
    DEFAULT_PORT,
    DOMAIN,
)

_LOGGER = logging.getLogger(__name__)


class LGWebOSConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for LG webOS Smart Remote."""

    VERSION = 1

    def __init__(self) -> None:
        """Initialize config flow."""
        self._host: Optional[str] = None
        self._mac: Optional[str] = None
        self._client: Optional[LGWebOSTVClient] = None

    async def async_step_user(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> FlowResult:
        """Handle the initial setup step."""
        errors: Dict[str, str] = {}

        if user_input is not None:
            host = user_input[CONF_HOST].strip()
            mac = user_input.get(CONF_MAC, "").strip()
            name = user_input.get(CONF_NAME, DEFAULT_NAME).strip()

            clean_mac = mac.replace(":", "").upper()
            if clean_mac:
                await self.async_set_unique_id(clean_mac)
                self._abort_if_unique_id_configured()

            client = LGWebOSTVClient(host=host, mac=mac)
            connected = await client.connect()

            if not connected and not client._pairing_prompt:
                errors["base"] = "cannot_connect"
            else:
                return self.async_create_entry(
                    title=name,
                    data={
                        CONF_HOST: host,
                        CONF_MAC: mac,
                        CONF_CLIENT_KEY: client.client_key,
                        CONF_NAME: name,
                    },
                )

        schema = vol.Schema(
            {
                vol.Required(CONF_HOST, default="192.168.50.145"): cv.string,
                vol.Optional(CONF_MAC, default="DC:03:98:69:CC:9A"): cv.string,
                vol.Optional(CONF_NAME, default=DEFAULT_NAME): cv.string,
            }
        )

        return self.async_show_form(
            step_id="user",
            data_schema=schema,
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> LGWebOSOptionsFlowHandler:
        """Get the options flow handler."""
        return LGWebOSOptionsFlowHandler(config_entry)


class LGWebOSOptionsFlowHandler(config_entries.OptionsFlow):
    """Handle LG webOS Smart Remote options."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> FlowResult:
        """Manage integration options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        data = self.config_entry.data
        options = self.config_entry.options

        schema = vol.Schema(
            {
                vol.Required(
                    CONF_HOST, default=options.get(CONF_HOST, data.get(CONF_HOST))
                ): cv.string,
                vol.Optional(
                    CONF_MAC, default=options.get(CONF_MAC, data.get(CONF_MAC, ""))
                ): cv.string,
                vol.Optional(
                    CONF_BROADCAST_ADDRESS,
                    default=options.get(CONF_BROADCAST_ADDRESS, "255.255.255.255"),
                ): cv.string,
            }
        )

        return self.async_show_form(step_id="init", data_schema=schema)
