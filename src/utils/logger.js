function logBoot(key, value) {
  console.log(`[BOOT] ${key}: ${value}`);
}
function logReq(req) {
  console.log(`[REQ] ${req.method} ${req.url}`);
}

module.exports = { logBoot, logReq };
