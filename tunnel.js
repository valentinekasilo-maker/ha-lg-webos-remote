const ngrok = require('@ngrok/ngrok');
const { getConfig } = require('./src/config');
require('dotenv').config();

const AUTHTOKEN = process.env.NGROK_AUTHTOKEN || '39iOKMeaJoaOg7Seo8Fof7OrLWw_SV8bAT7ZH1wnxmNpQAeW';
const DOMAIN = process.env.NGROK_DOMAIN || 'dominque-hydrocephalic-unconsiderablely.ngrok-free.dev';
const PORT = getConfig().webServerPort || 8080;

async function startTunnel() {
  try {
    console.log(`[Ngrok] Initializing tunnel for http://localhost:${PORT}...`);
    const listener = await ngrok.forward({
      addr: PORT,
      authtoken: AUTHTOKEN,
      domain: DOMAIN
    });

    console.log(`===================================================`);
    console.log(`🌐 NGROK CLOUD TUNNEL ACTIVE!`);
    console.log(`🚀 Public URL : ${listener.url()}`);
    console.log(`📡 Forwarding : http://localhost:${PORT}`);
    console.log(`===================================================`);
  } catch (err) {
    console.error(`[Ngrok] Tunnel error:`, err.message);
  }
}

startTunnel();
