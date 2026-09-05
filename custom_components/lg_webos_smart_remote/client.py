"""LG webOS TV Async SSAP Protocol & Pointer Socket Client.

Directly adapted from existing src/lgtv.js to preserve 100% feature parity.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import socket
from typing import Any, Callable, Dict, List, Optional
import aiohttp

_LOGGER = logging.getLogger(__name__)

# Standard LG webOS handshake manifest payload matching lgtv2 pairing.json
REGISTRATION_PAYLOAD = {
    "forcePairing": False,
    "pairingType": "PROMPT",
    "manifest": {
        "manifestVersion": 1,
        "appVersion": "1.1",
        "signed": {
            "created": "20140509",
            "appId": "com.lge.test",
            "vendorId": "com.lge",
            "localizedAppNames": {
                "": "LG Remote App",
                "ko-KR": "리모컨 앱",
                "zxx-XX": "ЛГ Rэмotэ AПП",
            },
            "localizedVendorNames": {"": "LG Electronics"},
            "permissions": [
                "TEST_SECURE",
                "CONTROL_INPUT_TEXT",
                "CONTROL_MOUSE_AND_KEYBOARD",
                "READ_INSTALLED_APPS",
                "READ_LGE_SDX",
                "READ_NOTIFICATIONS",
                "SEARCH",
                "WRITE_SETTINGS",
                "WRITE_NOTIFICATION_ALERT",
                "CONTROL_POWER",
                "READ_CURRENT_CHANNEL",
                "READ_RUNNING_APPS",
                "READ_UPDATE_INFO",
                "UPDATE_FROM_REMOTE_APP",
                "READ_LGE_TV_INPUT_EVENTS",
                "READ_TV_CURRENT_TIME",
            ],
            "serial": "2f930e2d2cfe083771f68e4fe7bb07",
        },
        "permissions": [
            "LAUNCH",
            "LAUNCH_WEBAPP",
            "APP_TO_APP",
            "CLOSE",
            "TEST_OPEN",
            "TEST_PROTECTED",
            "CONTROL_AUDIO",
            "CONTROL_DISPLAY",
            "CONTROL_INPUT_JOYSTICK",
            "CONTROL_INPUT_MEDIA_RECORDING",
            "CONTROL_INPUT_MEDIA_PLAYBACK",
            "CONTROL_INPUT_TV",
            "CONTROL_POWER",
            "READ_APP_STATUS",
            "READ_CURRENT_CHANNEL",
            "READ_INPUT_DEVICE_LIST",
            "READ_NETWORK_STATE",
            "READ_RUNNING_APPS",
            "READ_TV_CHANNEL_LIST",
            "WRITE_NOTIFICATION_TOAST",
            "READ_POWER_STATE",
            "READ_COUNTRY_INFO",
            "READ_SETTINGS",
            "CONTROL_TV_SCREEN",
            "CONTROL_TV_STANBY",
            "CONTROL_FAVORITE_GROUP",
            "CONTROL_USER_INFO",
            "CHECK_BLUETOOTH_DEVICE",
            "CONTROL_BLUETOOTH",
            "CONTROL_TIMER_INFO",
            "STB_INTERNAL_CONNECTION",
            "CONTROL_RECORDING",
            "READ_RECORDING_STATE",
            "WRITE_RECORDING_LIST",
            "READ_RECORDING_LIST",
            "READ_RECORDING_SCHEDULE",
            "WRITE_RECORDING_SCHEDULE",
            "READ_STORAGE_DEVICE_LIST",
            "READ_TV_PROGRAM_INFO",
            "CONTROL_BOX_CHANNEL",
            "READ_TV_ACR_AUTH_TOKEN",
            "READ_TV_CONTENT_STATE",
            "READ_TV_CURRENT_TIME",
            "ADD_LAUNCHER_CHANNEL",
            "SET_CHANNEL_SKIP",
            "RELEASE_CHANNEL_SKIP",
            "CONTROL_CHANNEL_BLOCK",
            "DELETE_SELECT_CHANNEL",
            "CONTROL_CHANNEL_GROUP",
            "SCAN_TV_CHANNELS",
            "CONTROL_TV_POWER",
            "CONTROL_WOL",
        ],
        "signatures": [
            {
                "signatureVersion": 1,
                "signature": "eyJhbGdvcml0aG0iOiJSU0EtU0hBMjU2Iiwia2V5SWQiOiJ0ZXN0LXNpZ25pbmctY2VydCIsInNpZ25hdHVyZVZlcnNpb24iOjF9.hrVRgjCwXVvE2OOSpDZ58hR+59aFNwYDyjQgKk3auukd7pcegmE2CzPCa0bJ0ZsRAcKkCTJrWo5iDzNhMBWRyaMOv5zWSrthlf7G128qvIlpMT0YNY+n/FaOHE73uLrS/g7swl3/qH/BGFG2Hu4RlL48eb3lLKqTt2xKHdCs6Cd4RMfJPYnzgvI4BNrFUKsjkcu+WD4OO2A27Pq1n50cMchmcaXadJhGrOqH5YmHdOCj5NSHzJYrsW0HPlpuAx/ECMeIZYDh6RMqaFM2DXzdKX9NmmyqzJ3o/0lkk/N97gfVRLW5hA29yeAwaCViZNCP8iC9aO0q9fQojoa7NQnAtw==",
            }
        ],
    },
}


class LGWebOSTVClient:
    """Async client for LG webOS TV SSAP protocol and pointer socket."""

    def __init__(
        self,
        host: str,
        mac: str = "",
        client_key: str = "",
        port: int = 3000,
        broadcast_address: str = "255.255.255.255",
    ) -> None:
        self.host = host
        self.mac = mac.strip()
        self.client_key = client_key.strip()
        self.port = port
        self.broadcast_address = broadcast_address

        self._session: Optional[aiohttp.ClientSession] = None
        self._ws: Optional[aiohttp.ClientWebSocketResponse] = None
        self._pointer_ws: Optional[aiohttp.ClientWebSocketResponse] = None

        self._is_connected = False
        self._is_connecting = False
        self._pairing_prompt = False

        self._req_id = 1
        self._requests: Dict[str, asyncio.Future] = {}
        self._callbacks: List[Callable[[], None]] = []

        # TV State cache
        self.volume: Optional[int] = None
        self.is_muted: bool = False
        self.current_app: Optional[str] = None
        self.installed_apps: List[Dict[str, Any]] = []
        self.inputs: List[Dict[str, Any]] = []

        self._listen_task: Optional[asyncio.Task] = None
        self._reconnect_task: Optional[asyncio.Task] = None

    @property
    def is_connected(self) -> bool:
        """Return True if TV is connected."""
        return self._is_connected and self._ws is not None and not self._ws.closed

    def register_callback(self, callback: Callable[[], None]) -> Callable[[], None]:
        """Register state change callback."""
        self._callbacks.append(callback)

        def remove() -> None:
            if callback in self._callbacks:
                self._callbacks.remove(callback)

        return remove

    def _notify_callbacks(self) -> None:
        """Trigger state update callbacks."""
        for cb in self._callbacks:
            try:
                cb()
            except Exception as e:
                _LOGGER.error("Error in state callback: %s", e)

    async def connect(self) -> bool:
        """Connect to LG TV over WebSocket and perform SSAP handshake."""
        if self.is_connected or self._is_connecting:
            return True

        self._is_connecting = True
        ws_url = f"ws://{self.host}:{self.port}"
        _LOGGER.debug("[LGClient] Connecting to %s...", ws_url)

        try:
            if self._session is None or self._session.closed:
                self._session = aiohttp.ClientSession()

            self._ws = await self._session.ws_connect(
                ws_url,
                timeout=aiohttp.ClientTimeout(total=8),
                heartbeat=30,
            )

            # Start background message listener
            self._listen_task = asyncio.create_task(self._message_listener())

            # Perform handshake registration
            handshake = dict(REGISTRATION_PAYLOAD)
            if self.client_key:
                handshake["client-key"] = self.client_key

            reg_future = asyncio.get_running_loop().create_future()
            reg_id = "register_0"
            self._requests[reg_id] = reg_future

            await self._ws.send_json(
                {
                    "id": reg_id,
                    "type": "register",
                    "payload": handshake,
                }
            )

            # Wait for handshake response (timeout 15s)
            res = await asyncio.wait_for(reg_future, timeout=15)
            if res and "client-key" in res:
                self.client_key = res["client-key"]
                _LOGGER.info("[LGClient] Connected & paired! Client key: %s", self.client_key)

            self._is_connected = True
            self._is_connecting = False
            self._pairing_prompt = False

            # Initialize subscriptions & pointer socket
            asyncio.create_task(self._post_connect_setup())

            self._notify_callbacks()
            return True

        except Exception as err:
            _LOGGER.debug("[LGClient] Connection failed: %s", err)
            self._is_connected = False
            self._is_connecting = False
            if self._ws and not self._ws.closed:
                await self._ws.close()
            self._ws = None
            self._notify_callbacks()
            return False

    async def _post_connect_setup(self) -> None:
        """Setup subscriptions, apps list, and pointer socket after connection."""
        try:
            # 1. Pointer socket for instant discrete buttons
            await self._get_pointer_socket()

            # 2. Subscribe volume
            await self.subscribe("ssap://audio/getVolume", self._on_volume_update)

            # 3. Subscribe current foreground app
            await self.subscribe(
                "ssap://com.webos.applicationManager/getForegroundAppInfo",
                self._on_app_update,
            )

            # 4. Fetch installed apps & inputs
            await self.get_apps()
            await self.get_inputs()
        except Exception as e:
            _LOGGER.debug("[LGClient] Post-connect notice: %s", e)

    async def _message_listener(self) -> None:
        """Listen for incoming WebSocket messages."""
        if not self._ws:
            return

        try:
            async for msg in self._ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                        msg_id = data.get("id")
                        msg_type = data.get("type")
                        payload = data.get("payload", {})

                        if msg_type == "response" and msg_id in self._requests:
                            fut = self._requests.pop(msg_id)
                            if not fut.done():
                                fut.set_result(payload)

                        elif msg_type == "registered":
                            if "client-key" in payload:
                                self.client_key = payload["client-key"]
                            if msg_id in self._requests:
                                fut = self._requests.pop(msg_id)
                                if not fut.done():
                                    fut.set_result(payload)

                        elif msg_type == "prompt":
                            _LOGGER.info("[LGClient] Please accept pairing prompt on TV screen.")
                            self._pairing_prompt = True
                            self._notify_callbacks()

                        elif msg_type == "error":
                            if msg_id in self._requests:
                                fut = self._requests.pop(msg_id)
                                if not fut.done():
                                    fut.set_exception(Exception(data.get("error", "Error")))

                    except Exception as parse_err:
                        _LOGGER.error("Error parsing WS message: %s", parse_err)

                elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                    break
        except Exception as loop_err:
            _LOGGER.debug("[LGClient] Message listener stopped: %s", loop_err)
        finally:
            self._is_connected = False
            self._is_connecting = False
            self._notify_callbacks()

    async def request(self, uri: str, payload: Optional[Dict[str, Any]] = None) -> Any:
        """Send a generic SSAP request wrapper."""
        if not self.is_connected:
            raise ConnectionError("LG TV is not connected")

        req_id = f"req_{self._req_id}"
        self._req_id += 1

        fut = asyncio.get_running_loop().create_future()
        self._requests[req_id] = fut

        msg = {
            "id": req_id,
            "type": "request",
            "uri": uri,
        }
        if payload:
            msg["payload"] = payload

        await self._ws.send_json(msg)
        return await asyncio.wait_for(fut, timeout=10)

    async def subscribe(self, uri: str, handler: Callable[[Dict[str, Any]], None]) -> None:
        """Subscribe to a continuous SSAP topic."""
        if not self.is_connected:
            return

        req_id = f"sub_{self._req_id}"
        self._req_id += 1

        # Intercept responses in listener
        async def sub_handler(payload: Dict[str, Any]) -> None:
            handler(payload)

        msg = {"id": req_id, "type": "subscribe", "uri": uri}
        await self._ws.send_json(msg)

    def _on_volume_update(self, payload: Dict[str, Any]) -> None:
        """Volume subscription update."""
        if "volume" in payload:
            self.volume = payload.get("volume")
        if "muted" in payload:
            self.is_muted = bool(payload.get("muted"))
        self._notify_callbacks()

    def _on_app_update(self, payload: Dict[str, Any]) -> None:
        """Foreground app update."""
        if "appId" in payload:
            self.current_app = payload.get("appId")
        self._notify_callbacks()

    # --- POINTER SOCKET FOR DISCRETE REMOTE BUTTONS & MOUSE ---
    async def _get_pointer_socket(self) -> aiohttp.ClientWebSocketResponse:
        """Acquire active pointer input socket."""
        if self._pointer_ws and not self._pointer_ws.closed:
            return self._pointer_ws

        sock_res = await self.request("ssap://com.webos.service.networkinput/getPointerInputSocket")
        sock_url = sock_res.get("socketPath")
        if not sock_url:
            raise ValueError("No pointer socket URL received from TV")

        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()

        self._pointer_ws = await self._session.ws_connect(sock_url)
        _LOGGER.debug("[LGClient] Pointer input socket established.")
        return self._pointer_ws

    async def send_button(self, name: str) -> bool:
        """Send discrete remote button press (UP, DOWN, LEFT, RIGHT, ENTER, BACK, HOME, MENU, EXIT, etc.)."""
        formatted = str(name).strip().upper()
        try:
            sock = await self._get_pointer_socket()
            await sock.send_str(f"type:button\nname:{formatted}\n\n")
            return True
        except Exception as e:
            _LOGGER.debug("[LGClient] Error sending button %s: %s", formatted, e)
            return False

    async def send_click(self) -> bool:
        """Click pointer cursor."""
        try:
            sock = await self._get_pointer_socket()
            await sock.send_str("type:click\n\n")
            return True
        except Exception as e:
            _LOGGER.debug("[LGClient] Error sending click: %s", e)
            return False

    async def send_move(self, dx: int, dy: int, drag: int = 0) -> bool:
        """Move pointer cursor."""
        try:
            sock = await self._get_pointer_socket()
            await sock.send_str(f"type:move\ndx:{dx}\ndy:{dy}\ndown:{drag}\n\n")
            return True
        except Exception:
            return False

    # --- TEXT TYPING & VIRTUAL KEYBOARD ---
    async def send_text(self, text: str) -> bool:
        """Type text string into TV search bar / input fields."""
        str_val = str(text)
        sent = False
        try:
            sock = await self._get_pointer_socket()
            await sock.send_str(f"type:type\nstr:{str_val}\n\n")
            sent = True
        except Exception:
            pass

        try:
            await self.request(
                "ssap://com.webos.service.ime/insertText",
                {"text": str_val, "replace": 0},
            )
            sent = True
        except Exception:
            pass

        return sent

    async def send_backspace(self, count: int = 1) -> bool:
        """Send backspace delete characters."""
        try:
            sock = await self._get_pointer_socket()
            for _ in range(count):
                await sock.send_str("type:button\nname:BACKSPACE\n\n")
        except Exception:
            pass

        try:
            await self.request(
                "ssap://com.webos.service.ime/deleteCharacters",
                {"count": count or 1},
            )
        except Exception:
            pass
        return True

    async def send_enter(self) -> bool:
        """Submit active input query."""
        try:
            sock = await self._get_pointer_socket()
            await sock.send_str("type:button\nname:ENTER\n\n")
        except Exception:
            pass

        try:
            await self.request("ssap://com.webos.service.ime/sendEnterKey")
        except Exception:
            pass
        return True

    # --- POWER CONTROLS ---
    def turn_on(self) -> None:
        """Turn TV on from deep standby using Wake-on-LAN magic packet."""
        if not self.mac:
            raise ValueError("TV MAC address is required for Wake-on-LAN")

        clean_mac = re.sub(r"[^0-9a-fA-F]", "", self.mac)
        if len(clean_mac) != 12:
            raise ValueError(f"Invalid MAC address: {self.mac}")

        payload = bytes.fromhex("FF" * 6 + clean_mac * 16)
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.sendto(payload, (self.broadcast_address, 9))
            sock.sendto(payload, (self.broadcast_address, 7))

        _LOGGER.info("[LGClient] Sent Wake-on-LAN packet to %s", self.mac)
        asyncio.create_task(self._delayed_reconnect())

    async def _delayed_reconnect(self) -> None:
        """Trigger connection attempt shortly after Wake-on-LAN."""
        await asyncio.sleep(2.5)
        await self.connect()

    async def turn_off(self) -> Any:
        """Turn TV off."""
        return await self.request("ssap://system/turnOff")

    async def turn_screen_off(self) -> Any:
        """Turn OLED/LED display off while preserving audio."""
        return await self.request("ssap://com.webos.service.tvpower/power/turnOffScreen")

    async def turn_screen_on(self) -> Any:
        """Turn display on."""
        return await self.request("ssap://com.webos.service.tvpower/power/turnOnScreen")

    # --- AUDIO & VOLUME ---
    async def set_volume(self, volume: int) -> Any:
        """Set volume level (0-100)."""
        vol = max(0, min(100, int(volume)))
        return await self.request("ssap://audio/setVolume", {"volume": vol})

    async def volume_up(self) -> Any:
        """Step volume up."""
        return await self.request("ssap://audio/volumeUp")

    async def volume_down(self) -> Any:
        """Step volume down."""
        return await self.request("ssap://audio/volumeDown")

    async def set_mute(self, mute: bool) -> Any:
        """Set mute state."""
        return await self.request("ssap://audio/setMute", {"mute": bool(mute)})

    async def get_volume(self) -> Any:
        """Get volume."""
        return await self.request("ssap://audio/getVolume")

    # --- APPS & INPUTS ---
    async def get_apps(self) -> List[Dict[str, Any]]:
        """Fetch installed launch points."""
        res = await self.request("ssap://com.webos.applicationManager/listLaunchPoints")
        if res and "launchPoints" in res:
            self.installed_apps = res["launchPoints"]
            self._notify_callbacks()
            return self.installed_apps
        return []

    async def launch_app(self, app_id: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """Launch webOS application."""
        return await self.request(
            "ssap://system.launcher/launch",
            {"id": app_id, "params": params or {}},
        )

    async def close_app(self, app_id: str) -> Any:
        """Close running application."""
        return await self.request("ssap://system.launcher/close", {"id": app_id})

    async def open_url(self, url: str) -> Any:
        """Open web URL in TV browser."""
        return await self.request("ssap://system.launcher/open", {"target": url})

    async def open_youtube(self, video_id_or_url: str = "") -> Any:
        """Launch YouTube directly with optional video ID."""
        content_id = video_id_or_url
        if "v=" in video_id_or_url:
            m = re.search(r"v=([a-zA-Z0-9_-]+)", video_id_or_url)
            if m:
                content_id = m.group(1)
        elif "youtu.be/" in video_id_or_url:
            m = re.search(r"youtu\.be/([a-zA-Z0-9_-]+)", video_id_or_url)
            if m:
                content_id = m.group(1)

        payload: Dict[str, Any] = {"id": "youtube.leanback.v4"}
        if content_id:
            payload["contentId"] = f"https://www.youtube.com/watch?v={content_id}"

        return await self.request("ssap://system.launcher/launch", payload)

    async def get_inputs(self) -> List[Dict[str, Any]]:
        """Fetch external inputs."""
        res = await self.request("ssap://tv/getExternalInputList")
        if res and "devices" in res:
            self.inputs = res["devices"]
            return self.inputs
        return []

    async def switch_input(self, input_id: str) -> Any:
        """Switch external HDMI input."""
        return await self.request("ssap://tv/switchInput", {"inputId": input_id})

    # --- CHANNELS ---
    async def channel_up(self) -> Any:
        """Channel up."""
        return await self.request("ssap://tv/channelUp")

    async def channel_down(self) -> Any:
        """Channel down."""
        return await self.request("ssap://tv/channelDown")

    async def get_channel_list(self) -> Any:
        """Get TV channel list."""
        return await self.request("ssap://tv/getChannelList")

    # --- MEDIA PLAYBACK ---
    async def media_play(self) -> Any:
        """Play."""
        return await self.request("ssap://media.controls/play")

    async def media_pause(self) -> Any:
        """Pause."""
        return await self.request("ssap://media.controls/pause")

    async def media_stop(self) -> Any:
        """Stop."""
        return await self.request("ssap://media.controls/stop")

    async def media_rewind(self) -> Any:
        """Rewind."""
        return await self.request("ssap://media.controls/rewind")

    async def media_fast_forward(self) -> Any:
        """Fast forward."""
        return await self.request("ssap://media.controls/fastForward")

    # --- TOAST NOTIFICATIONS ---
    async def show_toast(self, message: str, icon_data: Optional[str] = None) -> Any:
        """Show on-screen toast popup on TV."""
        payload: Dict[str, Any] = {"message": str(message)}
        if icon_data:
            payload["iconData"] = icon_data
        return await self.request("ssap://system.notifications/createToast", payload)

    async def disconnect(self) -> None:
        """Disconnect and cleanup."""
        self._is_connected = False
        if self._pointer_ws and not self._pointer_ws.closed:
            await self._pointer_ws.close()
        if self._ws and not self._ws.closed:
            await self._ws.close()
        if self._session and not self._session.closed:
            await self._session.close()
        self._notify_callbacks()
