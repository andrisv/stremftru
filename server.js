const { serveHTTP } = require("stremio-addon-sdk");
const addonInterface = require("./addon");
const cron = require("./lib/cron");

serveHTTP(addonInterface, { port: process.env.PORT || 7000 });

cron.delCache('0 1 * * *');
