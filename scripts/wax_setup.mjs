#!/usr/bin/env node
// One-time WAX on-chain setup for the character-NFT feature.
//
//   node scripts/wax_setup.mjs
//
// Creates (idempotently — already-exists errors are skipped) the AtomicAssets
// collection + schema the character NFTs live in, and registers the in-game
// marketplace on the atomicmarket contract so listings made through the game
// earn the marketplace fee. Re-run safe.
//
// Reads the same WAX_* env the server uses (see .env.example). Targets WAX
// testnet by default; set the mainnet endpoints + a mainnet account/key to run
// against mainnet. NEVER commit WAX_GAME_PRIVATE_KEY.
//
// Requires: WAX_GAME_ACCOUNT, WAX_GAME_PRIVATE_KEY, WAX_COLLECTION, WAX_SCHEMA.
// Optional: WAX_MARKETPLACE (skips marketplace registration if unset),
//           WAX_GAME_PERMISSION (default active), WAX_CHAIN_ID, WAX_RPC_URL.
import { Session } from '@wharfkit/session';
import { WalletPluginPrivateKey } from '@wharfkit/wallet-plugin-privatekey';

try {
  process.loadEnvFile?.();
} catch {
  // .env optional
}

const env = process.env;
const account = (env.WAX_GAME_ACCOUNT ?? '').trim();
const privateKey = (env.WAX_GAME_PRIVATE_KEY ?? '').trim();
const permission = (env.WAX_GAME_PERMISSION ?? 'active').trim();
const collection = (env.WAX_COLLECTION ?? '').trim();
const schema = (env.WAX_SCHEMA ?? '').trim();
const marketplace = (env.WAX_MARKETPLACE ?? '').trim();
const chainId = (env.WAX_CHAIN_ID ?? 'f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12').trim();
const rpcUrl = (env.WAX_RPC_URL ?? 'https://testnet.waxsweden.org').trim();
const marketFee = Number(env.WAX_COLLECTION_MARKET_FEE ?? '0.05');

if (!account || !privateKey || !collection || !schema) {
  console.error('Missing required env: WAX_GAME_ACCOUNT, WAX_GAME_PRIVATE_KEY, WAX_COLLECTION, WAX_SCHEMA.');
  console.error('Copy .env.example to .env and fill the WAX_* values first.');
  process.exit(1);
}

// Attribute schema — MUST match server/wax.ts `mintAttributes`.
const SCHEMA_FORMAT = [
  { name: 'name', type: 'string' },
  { name: 'class', type: 'string' },
  { name: 'level', type: 'uint16' },
  { name: 'prestige', type: 'uint16' },
  { name: 'networth', type: 'uint64' },
  { name: 'networth_text', type: 'string' },
  { name: 'character_id', type: 'uint64' },
];

const session = new Session({
  chain: { id: chainId, url: rpcUrl },
  actor: account,
  permission,
  walletPlugin: new WalletPluginPrivateKey(privateKey),
});

const auth = [{ actor: account, permission }];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A genuine "this already exists" error — safe to treat as success on re-run.
// Kept deliberately narrow so it does NOT match "No collection with this name
// exists" (which is a transient not-yet-propagated error, retried below).
const ALREADY_EXISTS = /already exists|name is already taken|already registered/i;
// The new collection can lag the node for a few seconds, so createschema right
// after createcol may transiently see the collection as missing — retry those.
const NOT_PROPAGATED = /no collection with this name exists|unable to find/i;

// Run one action: skip if it already exists, retry while the collection is still
// propagating, otherwise fail loudly.
async function step(label, action, { retries = 5 } = {}) {
  process.stdout.write(`• ${label}... `);
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await session.transact({ actions: [action] }, { broadcast: true });
      const id = res?.response?.transaction_id ?? res?.resolved?.transaction?.id ?? '';
      console.log(`ok (${String(id).slice(0, 12)})`);
      return;
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (ALREADY_EXISTS.test(msg)) { console.log('already exists — skipped'); return; }
      if (NOT_PROPAGATED.test(msg) && attempt < retries) { await sleep(2000); continue; }
      console.log('FAILED');
      throw err;
    }
  }
}

console.log(`WAX setup on ${rpcUrl}\n  account=${account} collection=${collection} schema=${schema}\n`);

await step('create collection', {
  account: 'atomicassets',
  name: 'createcol',
  authorization: auth,
  data: {
    author: account,
    collection_name: collection,
    allow_notify: true,
    authorized_accounts: [account],
    notify_accounts: [],
    market_fee: marketFee,
    data: [],
  },
});

await step('create schema', {
  account: 'atomicassets',
  name: 'createschema',
  authorization: auth,
  data: {
    authorized_creator: account,
    collection_name: collection,
    schema_name: schema,
    schema_format: SCHEMA_FORMAT,
  },
});

if (marketplace) {
  await step('register marketplace', {
    account: 'atomicmarket',
    name: 'regmarket',
    authorization: auth,
    data: { creator: account, marketplace_name: marketplace },
  });
} else {
  console.log('• register marketplace... skipped (WAX_MARKETPLACE unset)');
}

console.log('\nDone. The collection, schema, and marketplace are ready for minting.');
