/* Copy this file to js/config.js and fill in your jsonbin.io credentials.
 *
 * 1. Create a free account at https://jsonbin.io
 * 2. Create a new Bin (it can start with: {"sql":[],"dsa":[],"jobs":[],"meta":{}})
 * 3. Copy the Bin ID from the URL and your Master Key from the API Keys page.
 *
 * NOTE: This key lives in client-side JS and is visible to anyone who can open
 * the page. That's fine for a personal tracker you host privately, but do NOT
 * commit real keys or deploy this publicly with a sensitive bin.
 */
window.IPT_CONFIG = {
  // Use ONE of these. An Access Key (X-Access-Key) is safer — scope it to this bin.
  JSONBIN_ACCESS_KEY: '',   // e.g. "$2a$10$....." (preferred)
  JSONBIN_MASTER_KEY: '',   // e.g. "$2a$10$....." (full-account access)
  JSONBIN_BIN_ID: '',       // e.g. "665f1c2eacd3cb34a8...."
  JSONBIN_BASE: 'https://api.jsonbin.io/v3/b'
};
