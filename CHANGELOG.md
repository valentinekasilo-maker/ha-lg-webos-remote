# Changelog

## 1.0.2
- ⚡ **Instant Page Load (<50ms)**: Replaced external FontAwesome CDN (500KB+) with self-contained inline SVG sprites.
- 📦 **Gzip / Deflate Compression**: Added Express compression middleware and static asset cache-control headers.
- 🚀 **Non-Blocking Fonts**: Configured asynchronous Google Font loading with system UI fallbacks.

## 1.0.1
- ⚡ **Zero-Latency D-Pad & Remote Control**: Instant pointerdown touch events eliminating 300ms mobile touch delays.
- 🚀 **Direct WebSocket Dispatch**: Replaced HTTP calls with direct sub-millisecond WebSocket channels for Volume, Channels, and Media.
- 🎯 **Optimized Pointer Socket Pipeline**: Kept active connection warm and cached for immediate discrete button presses.

## 1.0.0
- Initial release of LG webOS Smart Remote Home Assistant Add-on.
- Home Assistant Ingress and left sidebar embedding with zero-port configuration.
- Wake-on-LAN power on and screen-off audio listening mode.
- Smart virtual keyboard & Luna IME typing integration.
- Tactile D-Pad, Volume/Channel rockers, Numpad, and Color buttons.
- Real-time TV status sync and On-Screen Toast HUD Messenger.
