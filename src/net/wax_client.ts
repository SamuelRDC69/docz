// ---------------------------------------------------------------------------
// src/net/wax_client.ts — browser-side WAX wallet (WharfKit) wrapper.
//
// Owns the SessionKit (Anchor + WAX Cloud Wallet) and builds/signs/broadcasts
// the on-chain transactions the character-NFT flow needs: prove wallet
// ownership, pay the mint fee, list/buy on AtomicMarket, and the atomic redeem
// transaction (fee + NFT transfer in one). It returns txids/actor names; the
// REST Api (online.ts) handles the off-chain side.
//
// Imported ONLY by main.ts — never by online.ts — so building a ClientWorld in
// tests doesn't pull in @wharfkit/web-renderer (which needs the DOM).
// ---------------------------------------------------------------------------

import { SessionKit, type Session } from '@wharfkit/session';
import WebRenderer from '@wharfkit/web-renderer';
import { WalletPluginAnchor } from '@wharfkit/wallet-plugin-anchor';
import { WalletPluginCloudWallet } from '@wharfkit/wallet-plugin-cloudwallet';
import type { WaxClientConfig } from './online';

const ATOMICASSETS = 'atomicassets';
const ATOMICMARKET = 'atomicmarket';
const WAX_SETTLEMENT_SYMBOL = '8,WAX';

export class WaxClient {
  private kit: SessionKit;
  private session: Session | null = null;
  readonly cfg: WaxClientConfig;

  constructor(cfg: WaxClientConfig) {
    this.cfg = cfg;
    this.kit = new SessionKit({
      appName: 'World of ClaudeCraft',
      chains: [{ id: cfg.chainId, url: cfg.rpcUrl }],
      ui: new WebRenderer(),
      walletPlugins: [new WalletPluginAnchor(), new WalletPluginCloudWallet()],
    });
  }

  /** The connected WAX account name, or null if not connected. */
  get account(): string | null {
    return this.session ? String(this.session.actor) : null;
  }

  /** Restore a prior session silently (no wallet popup). Returns the account. */
  async restore(): Promise<string | null> {
    try {
      const restored = await this.kit.restore();
      if (restored) this.session = restored;
    } catch {
      /* nothing to restore */
    }
    return this.account;
  }

  /** Open the wallet chooser and log in. Returns the connected account name. */
  async connect(): Promise<string> {
    const { session } = await this.kit.login();
    this.session = session;
    return String(session.actor);
  }

  async disconnect(): Promise<void> {
    if (this.session) await this.kit.logout(this.session);
    this.session = null;
  }

  private require(): Session {
    if (!this.session) throw new Error('wallet not connected');
    return this.session;
  }

  private async transactId(actions: object[]): Promise<string> {
    const session = this.require();
    // WharfKit serializes each action against the on-chain ABI; the shapes here
    // match the atomicassets/atomicmarket/eosio.token ABIs. Cast past the strict
    // AnyAction type since we build plain action objects.
    const result: any = await session.transact({ actions: actions as never }, { broadcast: true });
    const id = result?.response?.transaction_id ?? result?.resolved?.transaction?.id;
    if (!id) throw new Error('transaction broadcast returned no id');
    return String(id);
  }

  private transfer(to: string, quantity: string, memo: string, contract = this.cfg.feeTokenContract): object {
    const session = this.require();
    return {
      account: contract,
      name: 'transfer',
      authorization: [session.permissionLevel],
      data: { from: String(session.actor), to, quantity, memo },
    };
  }

  /**
   * Prove wallet ownership for linking: a dust self-transfer carrying the link
   * nonce in its memo. The server confirms the on-chain memo + sender. Returns
   * the txid to post to /api/wax/link.
   */
  async proveOwnership(nonce: string): Promise<string> {
    const me = String(this.require().actor);
    return this.transactId([this.transfer(me, '0.00000001 WAX', `link:${nonce}`)]);
  }

  /** Pay the mint fee to the game account (memo binds it to the character). */
  async payMintFee(characterId: number): Promise<string> {
    return this.transactId([this.transfer(this.cfg.gameAccount, this.cfg.mintFee, `mint:${characterId}`)]);
  }

  /**
   * Atomic redeem: pay the redeem fee AND hand the NFT to the game account in a
   * single transaction, both from the connected wallet. Returns the txid.
   */
  async redeem(assetId: string): Promise<string> {
    const session = this.require();
    const me = String(session.actor);
    return this.transactId([
      this.transfer(this.cfg.gameAccount, this.cfg.redeemFee, `redeem:${assetId}`),
      {
        account: ATOMICASSETS,
        name: 'transfer',
        authorization: [session.permissionLevel],
        data: { from: me, to: this.cfg.gameAccount, asset_ids: [assetId], memo: `redeem:${assetId}` },
      },
    ]);
  }

  /**
   * List a character NFT for sale on AtomicMarket: announce the sale (with our
   * marketplace as maker, so we earn the maker fee) and escrow the asset to the
   * market contract. `price` is a full asset string, e.g. "120.00000000 WAX".
   */
  async listForSale(assetId: string, price: string): Promise<string> {
    const session = this.require();
    const me = String(session.actor);
    return this.transactId([
      {
        account: ATOMICMARKET,
        name: 'announcesale',
        authorization: [session.permissionLevel],
        data: {
          seller: me,
          asset_ids: [assetId],
          listing_price: price,
          settlement_symbol: WAX_SETTLEMENT_SYMBOL,
          maker_marketplace: this.cfg.marketplace || '',
        },
      },
      {
        account: ATOMICASSETS,
        name: 'transfer',
        authorization: [session.permissionLevel],
        data: { from: me, to: ATOMICMARKET, asset_ids: [assetId], memo: 'sale' },
      },
    ]);
  }

  /**
   * Buy a listed character NFT: deposit the WAX price into AtomicMarket then
   * purchase the sale (with our marketplace as taker). `price` is the listed
   * asset string. Returns the txid.
   */
  async buy(saleId: string, price: string): Promise<string> {
    const session = this.require();
    return this.transactId([
      this.transfer(ATOMICMARKET, price, 'deposit'),
      {
        account: ATOMICMARKET,
        name: 'purchasesale',
        authorization: [session.permissionLevel],
        data: {
          buyer: String(session.actor),
          sale_id: saleId,
          intended_delphi_median: 0,
          taker_marketplace: this.cfg.marketplace || '',
        },
      },
    ]);
  }
}
