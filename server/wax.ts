// ---------------------------------------------------------------------------
// server/wax.ts — all WAX blockchain I/O for the character-NFT feature.
//
// This is the ONLY module that talks to the chain (AtomicAssets / AtomicMarket)
// or signs transactions. It owns no SQL and no game logic — db.ts owns the
// off-chain character row, main.ts orchestrates. Everything is env-driven so
// the same code runs against WAX testnet (default) or mainnet by config alone.
//
// The feature is OPT-IN: if the required env (game account + key + chain) is
// missing, `waxEnabled()` is false and the REST layer returns "not configured"
// instead of the server failing to boot. Keep all clients lazily constructed so
// importing this module never throws.
// ---------------------------------------------------------------------------

import { Asset } from '@wharfkit/antelope';
import { Session } from '@wharfkit/session';
import { WalletPluginPrivateKey } from '@wharfkit/wallet-plugin-privatekey';

try {
  process.loadEnvFile?.();
} catch {
  // .env optional; prod injects env directly.
}

const env = process.env;

// WAX testnet defaults so a developer only needs to supply the game account +
// private key + collection to get a working flow. Override any of these for
// mainnet. Endpoints are public community nodes; swap for your own in prod.
const DEFAULTS = {
  chainId: 'f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12', // WAX testnet
  rpcUrl: 'https://testnet.waxsweden.org',
  atomicApiUrl: 'https://test.wax.api.atomicassets.io',
  hyperionUrl: 'https://testnet.waxsweden.org',
  feeTokenContract: 'eosio.token',
  permission: 'active',
  mintFee: '5.00000000 WAX',
  redeemFee: '2.00000000 WAX',
};

export interface WaxConfig {
  enabled: boolean;
  chainId: string;
  rpcUrl: string;
  atomicApiUrl: string;
  hyperionUrl: string;
  gameAccount: string;
  permission: string;
  collection: string;
  schema: string;
  marketplace: string;
  templateId: number; // -1 means "no template" (free-form immutable data)
  feeTokenContract: string;
  mintFee: string;
  redeemFee: string;
}

// Private (server-only) config: the signing key never leaves this module and is
// never part of getWaxConfig()'s public payload.
interface PrivateConfig extends WaxConfig {
  privateKey: string;
}

function loadConfig(): PrivateConfig {
  const gameAccount = (env.WAX_GAME_ACCOUNT ?? '').trim();
  const privateKey = (env.WAX_GAME_PRIVATE_KEY ?? '').trim();
  const collection = (env.WAX_COLLECTION ?? '').trim();
  const schema = (env.WAX_SCHEMA ?? '').trim();
  const chainId = (env.WAX_CHAIN_ID ?? DEFAULTS.chainId).trim();
  // The feature is enabled only when everything needed to actually mint exists.
  const enabled = Boolean(gameAccount && privateKey && collection && schema && chainId);
  const templateId = Number.parseInt(env.WAX_TEMPLATE_ID ?? '-1', 10);
  return {
    enabled,
    chainId,
    rpcUrl: (env.WAX_RPC_URL ?? DEFAULTS.rpcUrl).trim(),
    atomicApiUrl: (env.WAX_ATOMIC_API_URL ?? DEFAULTS.atomicApiUrl).trim().replace(/\/$/, ''),
    hyperionUrl: (env.WAX_HYPERION_URL ?? DEFAULTS.hyperionUrl).trim().replace(/\/$/, ''),
    gameAccount,
    permission: (env.WAX_GAME_PERMISSION ?? DEFAULTS.permission).trim(),
    collection,
    schema,
    marketplace: (env.WAX_MARKETPLACE ?? '').trim(),
    templateId: Number.isFinite(templateId) ? templateId : -1,
    feeTokenContract: (env.WAX_FEE_TOKEN_CONTRACT ?? DEFAULTS.feeTokenContract).trim(),
    mintFee: (env.WAX_MINT_FEE ?? DEFAULTS.mintFee).trim(),
    redeemFee: (env.WAX_REDEEM_FEE ?? DEFAULTS.redeemFee).trim(),
    privateKey,
  };
}

let cfg: PrivateConfig | null = null;
function config(): PrivateConfig {
  if (!cfg) cfg = loadConfig();
  return cfg;
}

export function waxEnabled(): boolean {
  return config().enabled;
}

/** Public config for the client + WharfKit — never includes the private key. */
export function getWaxConfig(): WaxConfig {
  const { privateKey: _ignored, ...pub } = config();
  return pub;
}

export class WaxNotConfiguredError extends Error {
  constructor() {
    super('WAX integration is not configured');
    this.name = 'WaxNotConfiguredError';
  }
}

function assertEnabled(): PrivateConfig {
  const c = config();
  if (!c.enabled) throw new WaxNotConfiguredError();
  return c;
}

// --- lazy clients ----------------------------------------------------------

let gameSession: Session | null = null;
function session(): Session {
  const c = assertEnabled();
  if (!gameSession) {
    gameSession = new Session({
      chain: { id: c.chainId, url: c.rpcUrl },
      actor: c.gameAccount,
      permission: c.permission,
      walletPlugin: new WalletPluginPrivateKey(c.privateKey),
    });
  }
  return gameSession;
}

// --- fee-amount helpers (pure, unit-testable) ------------------------------

/**
 * True if `paid` covers `required` in the same token. Compares integer token
 * units (not floats) and requires the symbol codes to match, so "5 WAX" never
 * satisfies a fee denominated in a different token.
 */
export function feeCovers(paid: string, required: string): boolean {
  try {
    const a = Asset.from(paid);
    const b = Asset.from(required);
    if (a.symbol.code.toString() !== b.symbol.code.toString()) return false;
    return BigInt(a.units.toString()) >= BigInt(b.units.toString());
  } catch {
    return false;
  }
}

// --- ownership proof (link a WAX wallet to a game account) ------------------

/**
 * Verify the wallet proved control of `waxAccount` by broadcasting a tiny
 * transaction that carries the single-use link nonce in its memo. We confirm via
 * history that the transaction contains a token transfer FROM `waxAccount` whose
 * memo includes the nonce — only the wallet's owner could have authorized it.
 *
 * This is transaction-based rather than message-signature-based because WAX
 * wallets (Anchor, WAX Cloud Wallet) sign transactions, not arbitrary strings.
 */
export async function verifyLinkTransfer(waxAccount: string, nonce: string, txid: string): Promise<boolean> {
  const c = assertEnabled();
  let data: any;
  try {
    data = await getJson(`${c.hyperionUrl}/v2/history/get_transaction?id=${encodeURIComponent(txid)}`);
  } catch {
    return false;
  }
  const actions: any[] = Array.isArray(data?.actions) ? data.actions : [];
  return actions.some((a) => {
    const act = a?.act ?? {};
    if (act.account !== c.feeTokenContract || act.name !== 'transfer') return false;
    const d = act.data ?? {};
    // Exact `link:<nonce>` (the memo the client signs) — the nonce is single-use
    // and account-scoped, so an exact match fully binds the proof to this link.
    return String(d.from ?? '') === waxAccount && String(d.memo ?? '') === `link:${nonce}`;
  });
}

// --- chain reads via HTTP (history + AtomicAssets/Market REST) --------------

async function getJson(url: string): Promise<any> {
  const resp = await fetch(url, { headers: { accept: 'application/json' } });
  if (!resp.ok) throw new Error(`GET ${url} -> ${resp.status}`);
  return resp.json();
}

export interface FeeCheck {
  txid: string;
  fromWax: string;
  requiredFee: string;
  memo: string; // exact memo, e.g. "mint:42" — binds the fee to a specific character
}

/**
 * Confirm an on-chain token transfer that paid a mint fee: it must be a
 * `transfer` on the fee-token contract, FROM the player's wallet, TO the game
 * account, for at least the required fee, with a memo EXACTLY equal to `memo`.
 * The exact-memo match is what binds a paid fee to the one character it pays
 * for (otherwise a `mint:5` payment could be replayed to mint a different,
 * more valuable character). Read through Hyperion history (v2). False on any
 * mismatch.
 */
export async function verifyFeePayment(check: FeeCheck): Promise<boolean> {
  const c = assertEnabled();
  let data: any;
  try {
    data = await getJson(`${c.hyperionUrl}/v2/history/get_transaction?id=${encodeURIComponent(check.txid)}`);
  } catch {
    return false;
  }
  const actions: any[] = Array.isArray(data?.actions) ? data.actions : [];
  return actions.some((a) => {
    const act = a?.act ?? {};
    if (act.account !== c.feeTokenContract || act.name !== 'transfer') return false;
    const d = act.data ?? {};
    const from = String(d.from ?? '');
    const to = String(d.to ?? '');
    const memo = String(d.memo ?? '');
    const quantity = String(d.quantity ?? d.amount ?? '');
    return (
      from === check.fromWax &&
      to === c.gameAccount &&
      memo === check.memo &&
      feeCovers(quantity, check.requiredFee)
    );
  });
}

export interface RedeemCheck {
  txid: string;
  fromWax: string;
  assetId: string;
  requiredFee: string;
}

/**
 * Verify a single redeem transaction that BOTH pays the redeem fee AND hands the
 * NFT to the game account, so redemption is atomic and self-proving:
 *  - a fee `transfer` (fee-token contract) from the redeemer to the game account
 *    for at least the redeem fee, memo starting `redeem:`, and
 *  - an `atomicassets::transfer` of `assetId` from the redeemer to the game
 *    account (which lets the server then burn it).
 * Both must come from the same wallet (`fromWax`). Returns false on any mismatch.
 */
export async function verifyRedeemTransaction(check: RedeemCheck): Promise<boolean> {
  const c = assertEnabled();
  let data: any;
  try {
    data = await getJson(`${c.hyperionUrl}/v2/history/get_transaction?id=${encodeURIComponent(check.txid)}`);
  } catch {
    return false;
  }
  const actions: any[] = Array.isArray(data?.actions) ? data.actions : [];
  const feeOk = actions.some((a) => {
    const act = a?.act ?? {};
    if (act.account !== c.feeTokenContract || act.name !== 'transfer') return false;
    const d = act.data ?? {};
    return (
      String(d.from ?? '') === check.fromWax &&
      String(d.to ?? '') === c.gameAccount &&
      String(d.memo ?? '').startsWith('redeem:') &&
      feeCovers(String(d.quantity ?? d.amount ?? ''), check.requiredFee)
    );
  });
  const nftOk = actions.some((a) => {
    const act = a?.act ?? {};
    if (act.account !== 'atomicassets' || act.name !== 'transfer') return false;
    const d = act.data ?? {};
    const ids: string[] = Array.isArray(d.asset_ids) ? d.asset_ids.map((x: unknown) => String(x)) : [];
    return (
      String(d.from ?? '') === check.fromWax &&
      String(d.to ?? '') === c.gameAccount &&
      ids.includes(String(check.assetId))
    );
  });
  return feeOk && nftOk;
}

/** Current on-chain owner of an AtomicAssets asset, or null if not found. */
export async function assetOwner(assetId: string): Promise<string | null> {
  const c = config();
  try {
    const data = await getJson(`${c.atomicApiUrl}/atomicassets/v1/assets/${encodeURIComponent(assetId)}`);
    return data?.data?.owner ?? null;
  } catch {
    return null;
  }
}

export interface OwnedAsset {
  assetId: string;
  templateId: string | null;
  data: Record<string, unknown>;
}

/** Assets in OUR collection/schema currently owned by a wallet (redeem UI). */
export async function assetsOwnedBy(waxAccount: string): Promise<OwnedAsset[]> {
  const c = config();
  const url =
    `${c.atomicApiUrl}/atomicassets/v1/assets?owner=${encodeURIComponent(waxAccount)}` +
    `&collection_name=${encodeURIComponent(c.collection)}&schema_name=${encodeURIComponent(c.schema)}&page=1&limit=100`;
  try {
    const data = await getJson(url);
    const rows: any[] = Array.isArray(data?.data) ? data.data : [];
    return rows.map((r) => ({
      assetId: String(r.asset_id),
      templateId: r.template?.template_id ? String(r.template.template_id) : null,
      data: (r.data ?? {}) as Record<string, unknown>,
    }));
  } catch {
    return [];
  }
}

export interface MarketListing {
  saleId: string;
  assetId: string;
  price: string; // e.g. "120.50000000 WAX"
  seller: string;
  data: Record<string, unknown>; // on-chain character snapshot
}

/** Active AtomicMarket sales of OUR character NFTs (drives the in-game gallery). */
export async function getMarketListings(limit = 100): Promise<MarketListing[]> {
  const c = config();
  const url =
    `${c.atomicApiUrl}/atomicmarket/v1/sales?state=1&collection_name=${encodeURIComponent(c.collection)}` +
    `&schema_name=${encodeURIComponent(c.schema)}&sort=created&order=desc&page=1&limit=${Math.max(1, Math.min(100, limit))}`;
  try {
    const data = await getJson(url);
    const rows: any[] = Array.isArray(data?.data) ? data.data : [];
    return rows.map((r) => {
      const asset = (r.assets ?? [])[0] ?? {};
      const token = r.price?.token_symbol ?? 'WAX';
      const precision = Number(r.price?.token_precision ?? 8);
      const raw = Number(r.price?.amount ?? 0) / Math.pow(10, precision);
      return {
        saleId: String(r.sale_id),
        assetId: String(asset.asset_id ?? ''),
        price: `${raw.toFixed(precision)} ${token}`,
        seller: String(r.seller ?? ''),
        data: (asset.data ?? {}) as Record<string, unknown>,
      };
    });
  } catch {
    return [];
  }
}

// --- mint / burn (signed by the game account) ------------------------------

export interface CharacterSnapshot {
  name: string;
  charClass: string;
  level: number;
  prestigeRank: number;
  netWorth: number; // copper
  netWorthText: string; // human readable (formatMoney)
  characterId: number;
}

/**
 * AtomicAssets ATTRIBUTE_MAP for a character snapshot. Each entry is a
 * `{ key, value }` pair where value is the antelope variant form
 * `[typeName, value]`. The on-chain schema must declare these attribute
 * names/types (see scripts/wax_setup.mjs). Pure + unit-testable.
 */
export function mintAttributes(snap: CharacterSnapshot): Array<{ key: string; value: [string, unknown] }> {
  return [
    { key: 'name', value: ['string', snap.name] },
    { key: 'class', value: ['string', snap.charClass] },
    { key: 'level', value: ['uint16', snap.level] },
    { key: 'prestige', value: ['uint16', snap.prestigeRank] },
    { key: 'networth', value: ['uint64', Math.max(0, Math.floor(snap.netWorth))] },
    { key: 'networth_text', value: ['string', snap.netWorthText] },
    { key: 'character_id', value: ['uint64', snap.characterId] },
  ];
}

// Recursively scan transaction traces for the atomicassets `logmint` inline
// action the contract emits — its data.asset_id is the freshly minted id.
function findMintedAssetId(traces: any): string | null {
  if (!traces) return null;
  const stack: any[] = Array.isArray(traces) ? [...traces] : [traces];
  while (stack.length) {
    const t = stack.pop();
    const act = t?.act ?? {};
    if (act.account === 'atomicassets' && act.name === 'logmint') {
      const id = act.data?.asset_id;
      if (id) return String(id);
    }
    if (Array.isArray(t?.inline_traces)) stack.push(...t.inline_traces);
    if (Array.isArray(t?.action_traces)) stack.push(...t.action_traces);
  }
  return null;
}

/**
 * Mint a character NFT to the player's wallet, signed by the game account. The
 * NFT carries the character snapshot as immutable data. Returns the new asset
 * id (parsed from the logmint trace; falls back to the newest owned asset).
 */
export async function mintCharacterAsset(toWax: string, snap: CharacterSnapshot): Promise<string> {
  const c = assertEnabled();
  const result: any = await session().transact(
    {
      action: {
        account: 'atomicassets',
        name: 'mintasset',
        authorization: [{ actor: c.gameAccount, permission: c.permission }],
        data: {
          authorized_minter: c.gameAccount,
          collection_name: c.collection,
          schema_name: c.schema,
          template_id: c.templateId,
          new_asset_owner: toWax,
          immutable_data: mintAttributes(snap),
          mutable_data: [],
          tokens_to_back: [],
        },
      },
    },
    { broadcast: true },
  );

  const fromTrace = findMintedAssetId(result?.response?.processed?.action_traces);
  if (fromTrace) return fromTrace;

  // Fallback: the newest asset now owned by the player in our collection.
  const owned = await assetsOwnedBy(toWax);
  if (owned.length > 0) return owned[0].assetId;
  throw new Error('mint succeeded but the new asset id could not be determined');
}

/** Burn (consume) a redeemed NFT now held by the game account. */
export async function burnAsset(assetId: string): Promise<void> {
  const c = assertEnabled();
  await session().transact(
    {
      action: {
        account: 'atomicassets',
        name: 'burnasset',
        authorization: [{ actor: c.gameAccount, permission: c.permission }],
        data: { asset_owner: c.gameAccount, asset_id: assetId },
      },
    },
    { broadcast: true },
  );
}
