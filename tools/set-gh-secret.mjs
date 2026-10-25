/* One-off helper: PUT the EXPO_TOKEN GitHub Actions secret, sealed with
 * libsodium (tweetnacl). Reads the token from the environment and never
 * prints it. Not part of the shipped app; delete after use if you like.
 */
import sodium from 'file:///E:/Tools/npm-global/node_modules/libsodium-wrappers/dist/modules/libsodium-wrappers.js';

await sodium.ready;
const { crypto_box_seal, from_base64, to_base64 } = sodium;

const REPO = 'Avithegod2010/chat-launcher';
const ghToken = process.env.GH_TOKEN;
const expoToken = process.env.EXPO_TOKEN;
if (!ghToken || !expoToken) throw new Error('GH_TOKEN and EXPO_TOKEN env vars required');

const res = await fetch(`https://api.github.com/repos/${REPO}/actions/secrets/public-key`, {
  headers: { Authorization: `token ${ghToken}`, Accept: 'application/vnd.github+json' },
});
if (!res.ok) throw new Error(`public-key failed: ${res.status} ${await res.text()}`);
const { key, key_id } = await res.json();

const sealed = crypto_box_seal(
  new TextEncoder().encode(expoToken),
  from_base64(key, sodium.base64_variants.ORIGINAL),
);

const put = await fetch(`https://api.github.com/repos/${REPO}/actions/secrets/EXPO_TOKEN`, {
  method: 'PUT',
  headers: { Authorization: `token ${ghToken}`, Accept: 'application/vnd.github+json' },
  body: JSON.stringify({
    encrypted_value: to_base64(sealed, sodium.base64_variants.ORIGINAL),
    key_id,
    secret_type: 'repository',
  }),
});
console.log('EXPO_TOKEN secret set:', put.status, put.statusText);
