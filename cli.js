#!/usr/bin/env node
const tv = require('./src/lgtv');
const { getConfig, updateConfig } = require('./src/config');

const args = process.argv.slice(2);
const command = (args[0] || 'help').toLowerCase();

function printHelp() {
  console.log(`
🎮 LG webOS TV Command Line Controller

Usage:
  node cli.js <command> [options]

Commands:
  on                          Send Wake-on-LAN to turn the TV On
  off                         Turn the TV Off
  screen-off                  Turn the screen off (audio keeps playing)
  screen-on                   Turn the screen back on
  vol <0-100>                 Set volume level
  vol-up                      Increase volume
  vol-down                    Decrease volume
  mute                        Mute audio
  unmute                      Unmute audio
  toast <message>             Display on-screen message banner on TV
  apps                        List installed applications and app IDs
  launch <appId>              Launch an application (e.g. netflix, youtube.leanback.v4)
  close <appId>               Close an application
  youtube <url|id>            Launch YouTube with specific video URL or query
  browser <url>               Open a web page on TV browser
  btn <KEY>                   Simulate remote button (UP, DOWN, LEFT, RIGHT, ENTER, BACK, HOME, EXIT, MENU)
  input <inputId>             Switch input (e.g. HDMI_1, HDMI_2)
  inputs                      List available external inputs
  config <ip> [mac]           Set TV IP address and optional MAC address
  info                        Display current configuration and connection status
  help                        Show this help menu

Examples:
  node cli.js on
  node cli.js vol 25
  node cli.js toast "Dinner is ready!"
  node cli.js youtube "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  node cli.js config 192.168.1.150 14:C9:13:XX:XX:XX
`);
  process.exit(0);
}

async function run() {
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  // Config command can run without connecting
  if (command === 'config') {
    const ip = args[1];
    const mac = args[2];
    if (!ip) {
      console.log('Current Config:', getConfig());
      process.exit(0);
    }
    const updates = { tvIp: ip };
    if (mac) updates.tvMac = mac;
    updateConfig(updates);
    console.log('✅ Updated config:', updates);
    process.exit(0);
  }

  // Wake on LAN doesn't require live WebSocket connection
  if (command === 'on' || command === 'power-on') {
    try {
      console.log('Sending Wake-on-LAN magic packet...');
      await tv.turnOn();
      console.log('✅ Wake-on-LAN packet sent! TV should power on shortly.');
      process.exit(0);
    } catch (err) {
      console.error('❌ WoL Error:', err.message);
      process.exit(1);
    }
  }

  // For other commands, connect to TV first
  const config = getConfig();
  console.log(`Connecting to LG TV at ${config.tvIp}...`);
  tv.connect();

  const timeout = setTimeout(() => {
    console.error('❌ Connection timed out. Make sure your TV is turned on and on the same Wi-Fi network.');
    process.exit(1);
  }, 10000);

  tv.on('prompt', () => {
    console.log('⚠️  Please accept the pairing prompt on your TV screen using your remote...');
  });

  tv.on('connect', async () => {
    clearTimeout(timeout);
    try {
      switch (command) {
        case 'off':
        case 'power-off':
          await tv.turnOff();
          console.log('✅ TV turned off.');
          break;

        case 'screen-off':
          await tv.turnScreenOff();
          console.log('✅ TV Screen turned off.');
          break;

        case 'screen-on':
          await tv.turnScreenOn();
          console.log('✅ TV Screen turned on.');
          break;

        case 'vol':
        case 'volume': {
          const level = parseInt(args[1], 10);
          if (isNaN(level)) {
            console.error('❌ Please specify a volume level from 0 to 100.');
            break;
          }
          await tv.setVolume(level);
          console.log(`✅ Volume set to ${level}.`);
          break;
        }

        case 'vol-up':
          await tv.volumeUp();
          console.log('✅ Volume increased.');
          break;

        case 'vol-down':
          await tv.volumeDown();
          console.log('✅ Volume decreased.');
          break;

        case 'mute':
          await tv.setMute(true);
          console.log('✅ TV Muted.');
          break;

        case 'unmute':
          await tv.setMute(false);
          console.log('✅ TV Unmuted.');
          break;

        case 'toast': {
          const message = args.slice(1).join(' ') || 'Hello from Node.js LG Controller!';
          await tv.showToast(message);
          console.log(`✅ Toast message sent: "${message}"`);
          break;
        }

        case 'apps': {
          const apps = await tv.getApps();
          console.log('\n📱 Installed Applications:');
          apps.forEach((app, i) => {
            console.log(`  [${i + 1}] ${app.title} (ID: ${app.id})`);
          });
          break;
        }

        case 'launch': {
          const appId = args[1];
          if (!appId) {
            console.error('❌ Please specify appId to launch.');
            break;
          }
          await tv.launchApp(appId);
          console.log(`✅ Launched app: ${appId}`);
          break;
        }

        case 'close': {
          const appId = args[1];
          if (!appId) {
            console.error('❌ Please specify appId to close.');
            break;
          }
          await tv.closeApp(appId);
          console.log(`✅ Closed app: ${appId}`);
          break;
        }

        case 'youtube': {
          const target = args[1] || '';
          await tv.openYoutube(target);
          console.log(`✅ Launched YouTube${target ? ` for ${target}` : ''}`);
          break;
        }

        case 'browser': {
          const url = args[1] || 'https://google.com';
          await tv.openUrlInBrowser(url);
          console.log(`✅ Opened ${url} in TV browser`);
          break;
        }

        case 'btn':
        case 'button': {
          const key = (args[1] || 'ENTER').toUpperCase();
          await tv.sendButton(key);
          console.log(`✅ Sent button: ${key}`);
          break;
        }

        case 'inputs': {
          const inputs = await tv.getInputs();
          console.log('\n🔌 External Inputs:', JSON.stringify(inputs, null, 2));
          break;
        }

        case 'input': {
          const inputId = args[1];
          if (!inputId) {
            console.error('❌ Please specify inputId (e.g. HDMI_1).');
            break;
          }
          await tv.setInput(inputId);
          console.log(`✅ Switched to input: ${inputId}`);
          break;
        }

        case 'info': {
          const status = tv.getStatus();
          console.log('\n📊 TV Status:', JSON.stringify(status, null, 2));
          break;
        }

        default:
          console.error(`❌ Unknown command: "${command}". Run "node cli.js help" for available commands.`);
      }
    } catch (err) {
      console.error('❌ Execution error:', err.message);
    } finally {
      tv.disconnect();
      process.exit(0);
    }
  });

  tv.on('error', (err) => {
    clearTimeout(timeout);
    console.error('❌ Connection error:', err.message);
    process.exit(1);
  });
}

run();
