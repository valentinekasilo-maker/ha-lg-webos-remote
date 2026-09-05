"""Constants for the LG webOS Smart Remote integration."""
from typing import Final

DOMAIN: Final = "lg_webos_smart_remote"

CONF_HOST: Final = "host"
CONF_MAC: Final = "mac"
CONF_CLIENT_KEY: Final = "client_key"
CONF_NAME: Final = "name"
CONF_BROADCAST_ADDRESS: Final = "broadcast_address"

DEFAULT_NAME: Final = "LG webOS Smart TV"
DEFAULT_PORT: Final = 3000
DEFAULT_SUGGESTED_AREA: Final = "Living Room"

PLATFORMS: Final = [
    "media_player",
    "remote",
    "button",
    "select",
    "sensor",
    "binary_sensor",
    "text",
]

# Service Names
SERVICE_SEND_BUTTON: Final = "send_button"
SERVICE_SEND_TEXT: Final = "send_text"
SERVICE_SHOW_TOAST: Final = "show_toast"
SERVICE_SCREEN_OFF: Final = "screen_off"
SERVICE_SCREEN_ON: Final = "screen_on"
SERVICE_OPEN_YOUTUBE: Final = "open_youtube"
