const fs = require('fs');
const path = require('path');

const pairingPath = path.join(__dirname, 'node_modules', 'lgtv2', 'pairing.json');

const allPermissions = [
  "TEST_SECURE",
  "TEST_PROTECTED",
  "TEST_OPEN",
  "CONTROL_INPUT_TEXT",
  "CONTROL_MOUSE_AND_KEYBOARD",
  "CONTROL_INPUT_JOYSTICK",
  "CONTROL_INPUT_MEDIA_RECORDING",
  "CONTROL_INPUT_MEDIA_PLAYBACK",
  "CONTROL_INPUT_TV",
  "CONTROL_POWER",
  "CONTROL_TV_SCREEN",
  "CONTROL_TV_STANBY",
  "CONTROL_TV_POWER",
  "CONTROL_AUDIO",
  "CONTROL_DISPLAY",
  "READ_INSTALLED_APPS",
  "READ_LGE_SDX",
  "READ_NOTIFICATIONS",
  "READ_APP_STATUS",
  "READ_CURRENT_CHANNEL",
  "READ_INPUT_DEVICE_LIST",
  "READ_NETWORK_STATE",
  "READ_RUNNING_APPS",
  "READ_TV_CHANNEL_LIST",
  "READ_POWER_STATE",
  "READ_COUNTRY_INFO",
  "READ_SETTINGS",
  "SEARCH",
  "WRITE_SETTINGS",
  "WRITE_NOTIFICATION_ALERT",
  "WRITE_NOTIFICATION_TOAST",
  "READ_UPDATE_INFO",
  "UPDATE_FROM_REMOTE_APP",
  "READ_LGE_TV_INPUT_EVENTS",
  "READ_TV_CURRENT_TIME",
  "LAUNCH",
  "LAUNCH_WEBAPP",
  "APP_TO_APP",
  "CLOSE",
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
  "ADD_LAUNCHER_CHANNEL",
  "SET_CHANNEL_SKIP",
  "RELEASE_CHANNEL_SKIP",
  "CONTROL_CHANNEL_BLOCK",
  "DELETE_SELECT_CHANNEL",
  "CONTROL_CHANNEL_GROUP",
  "SCAN_TV_CHANNELS",
  "CONTROL_WOL"
];

const cleanManifest = {
  forcePairing: false,
  pairingType: "PROMPT",
  manifest: {
    manifestVersion: 1,
    appVersion: "1.1",
    signed: {
      created: "20240101",
      appId: "com.lge.test",
      vendorId: "com.lge",
      localizedAppNames: {
        "": "LG Smart Remote",
        "ko-KR": "리모컨 앱"
      },
      localizedVendorNames: {
        "": "LG Electronics"
      },
      permissions: allPermissions
    },
    permissions: allPermissions
  }
};

try {
  if (fs.existsSync(path.dirname(pairingPath))) {
    fs.writeFileSync(pairingPath, JSON.stringify(cleanManifest, null, 2), 'utf8');
    console.log('[Patch] Successfully patched lgtv2 pairing.json with elevated permissions.');
  }
} catch (e) {
  console.warn('[Patch] Warning patching lgtv2:', e.message);
}
