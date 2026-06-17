import { beforeEach, describe, expect, it, vi } from 'vitest';

// db.ts builds a pg Pool and requires DATABASE_URL at import time; stub both so
// the module loads and every query goes through a spy we can assert against.
const dbMock = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn() }));
vi.hoisted(() => {
  process.env.DATABASE_URL = 'postgres://test/test';
});
vi.mock('pg', () => ({
  Pool: function Pool() {
    return { query: dbMock.query, connect: dbMock.connect };
  },
}));

import {
  createAccount, createCharacterCapped, deleteCharacter, openPlaySession, touchLogin,
  linkWaxAccount, getWaxLink, accountForWaxAccount, getCharacterByAssetId,
  setCharacterMinted, redeemCharacterToAccount, recordNftOperation, nftOperationByTxid,
} from '../server/db';
import { REALM } from '../server/realm';

beforeEach(() => {
  dbMock.query.mockReset();
  dbMock.connect.mockReset();
});

function clientStub() {
  const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 } as any);
  const release = vi.fn();
  return { query, release };
}

describe('deleteCharacter', () => {
  it('scopes the delete to the current realm so cross-realm characters are safe', async () => {
    dbMock.query.mockResolvedValueOnce({ rowCount: 1 } as any);

    await deleteCharacter(7, 42);

    const [sql, params] = dbMock.query.mock.calls[0];
    expect(sql).toMatch(/realm/i);
    expect(params).toContain(REALM);
    // id + account + realm — the same three predicates getCharacter/renameCharacter use
    expect(params).toEqual(expect.arrayContaining([42, 7, REALM]));
  });

  it('reports whether a row was actually deleted', async () => {
    dbMock.query.mockResolvedValueOnce({ rowCount: 0 } as any);
    expect(await deleteCharacter(7, 42)).toBe(false);

    dbMock.query.mockResolvedValueOnce({ rowCount: 1 } as any);
    expect(await deleteCharacter(7, 42)).toBe(true);
  });
});

describe('account and session request metadata', () => {
  it('stores account creation IP and user agent when registering', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [{ id: 7, username: 'alice', password_hash: 'hash' }] } as any);

    await createAccount('alice', 'hash', { ip: '203.0.113.4', userAgent: 'Mozilla/5.0' });

    const [sql, params] = dbMock.query.mock.calls[0];
    expect(sql).toMatch(/created_ip/);
    expect(sql).toMatch(/created_user_agent/);
    expect(params).toEqual(['alice', 'hash', '203.0.113.4', 'Mozilla/5.0']);
  });

  it('updates last login IP and user agent when logging in', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [] } as any);

    await touchLogin(7, { ip: '203.0.113.5', userAgent: 'Mozilla/5.0' });

    const [sql, params] = dbMock.query.mock.calls[0];
    expect(sql).toMatch(/last_login_ip/);
    expect(sql).toMatch(/last_login_user_agent/);
    expect(params).toEqual([7, '203.0.113.5', 'Mozilla/5.0']);
  });

  it('stores play session IP and user agent when entering the world', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [{ id: 99 }] } as any);

    await openPlaySession(7, 42, 'Alice', { ip: '203.0.113.6', userAgent: 'Mozilla/5.0' });

    const [sql, params] = dbMock.query.mock.calls[0];
    expect(sql).toMatch(/ip_address/);
    expect(sql).toMatch(/user_agent/);
    expect(params).toEqual([7, 42, 'Alice', '203.0.113.6', 'Mozilla/5.0']);
  });
});

describe('createCharacterCapped', () => {
  it('locks the account row and checks the realm-scoped character count before inserting', async () => {
    const client = clientStub();
    dbMock.connect.mockResolvedValue(client as any);
    client.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 7 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ n: 9 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{
        id: 42, account_id: 7, name: 'Captest', class: 'mage', level: 1, state: null, is_gm: false, force_rename: false,
      }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // COMMIT

    const row = await createCharacterCapped(7, 'Captest', 'mage', 10);

    expect(row?.id).toBe(42);
    expect(client.query.mock.calls[0][0]).toBe('BEGIN');
    expect(client.query.mock.calls[1][0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls[1][1]).toEqual([7]);
    expect(client.query.mock.calls[2][0]).toContain('count(*)::int');
    expect(client.query.mock.calls[2][1]).toEqual([7, REALM]);
    expect(client.query.mock.calls[3][0]).toMatch(/INSERT INTO characters/);
    expect(client.query.mock.calls[4][0]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('returns null and skips the insert when the account is already at the realm cap', async () => {
    const client = clientStub();
    dbMock.connect.mockResolvedValue(client as any);
    client.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 7 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ n: 10 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // ROLLBACK

    await expect(createCharacterCapped(7, 'Overflow', 'warrior', 10)).resolves.toBeNull();

    expect(client.query.mock.calls.map((c) => c[0])).toEqual([
      'BEGIN',
      'SELECT id FROM accounts WHERE id = $1 FOR UPDATE',
      'SELECT count(*)::int AS n FROM characters WHERE account_id = $1 AND realm = $2',
      'ROLLBACK',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and releases the client when the insert fails', async () => {
    const client = clientStub();
    dbMock.connect.mockResolvedValue(client as any);
    client.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 7 }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ n: 3 }], rowCount: 1 } as any)
      .mockRejectedValueOnce(new Error('duplicate name'))
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // ROLLBACK

    await expect(createCharacterCapped(7, 'Taken', 'rogue', 10)).rejects.toThrow(/duplicate name/);

    expect(client.query.mock.calls.map((c) => c[0])).toContain('ROLLBACK');
    expect(client.query.mock.calls.map((c) => c[0])).not.toContain('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

describe('WAX wallet links', () => {
  it('upserts a wallet on the account_id key so re-linking replaces the wallet', async () => {
    dbMock.query.mockResolvedValueOnce({ rowCount: 1 } as any);
    await linkWaxAccount(7, 'cooltestacct');
    const [sql, params] = dbMock.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO wax_links/);
    expect(sql).toMatch(/ON CONFLICT \(account_id\) DO UPDATE/);
    expect(params).toEqual([7, 'cooltestacct']);
  });

  it('reads the linked wallet and the reverse mapping', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [{ wax_account: 'cooltestacct' }] } as any);
    expect(await getWaxLink(7)).toBe('cooltestacct');

    dbMock.query.mockResolvedValueOnce({ rows: [{ account_id: 7 }] } as any);
    expect(await accountForWaxAccount('cooltestacct')).toBe(7);

    dbMock.query.mockResolvedValueOnce({ rows: [] } as any);
    expect(await accountForWaxAccount('nobody')).toBeNull();
  });
});

describe('character minting & redemption', () => {
  it('freezes the character, scoped to account+realm and guarded on not-yet-minted', async () => {
    dbMock.query.mockResolvedValueOnce({ rowCount: 1 } as any);
    expect(await setCharacterMinted(7, 42, '123456789')).toBe(true);
    const [sql, params] = dbMock.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE characters/);
    expect(sql).toMatch(/wax_minted = TRUE/);
    expect(sql).toMatch(/wax_minted = FALSE/); // the WHERE guard
    expect(params).toEqual([42, 7, '123456789', REALM]);
  });

  it('reports false when the mint guard matched no row (already minted)', async () => {
    dbMock.query.mockResolvedValueOnce({ rowCount: 0 } as any);
    expect(await setCharacterMinted(7, 42, '123456789')).toBe(false);
  });

  it('redeem reassigns the character to the new account and unfreezes it', async () => {
    dbMock.query.mockResolvedValueOnce({ rowCount: 1 } as any);
    expect(await redeemCharacterToAccount('123456789', 99)).toBe(true);
    const [sql, params] = dbMock.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE characters/);
    expect(sql).toMatch(/account_id = \$2/);
    expect(sql).toMatch(/wax_minted = FALSE/);
    expect(sql).toMatch(/nft_asset_id = NULL/);
    expect(params).toEqual(['123456789', 99, REALM]);
  });

  it('looks up a character by its minted asset id, realm-scoped', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [{ id: 42, name: 'Frosty' }] } as any);
    const row = await getCharacterByAssetId('123456789');
    expect(row?.id).toBe(42);
    const [sql, params] = dbMock.query.mock.calls[0];
    expect(sql).toMatch(/nft_asset_id = \$1/);
    expect(params).toEqual(['123456789', REALM]);
  });
});

describe('NFT fee ledger (idempotency)', () => {
  it('records a fee and reports success', async () => {
    dbMock.query.mockResolvedValueOnce({ rowCount: 1 } as any);
    const ok = await recordNftOperation({
      op: 'mint', accountId: 7, characterId: 42, assetId: '123456789', waxAccount: 'cooltestacct', feeTxid: 'tx_abc',
    });
    expect(ok).toBe(true);
    expect(dbMock.query.mock.calls[0][0]).toMatch(/INSERT INTO nft_operations/);
  });

  it('treats a duplicate fee_txid (23505) as an idempotent replay, returning false', async () => {
    dbMock.query.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
    const ok = await recordNftOperation({
      op: 'redeem', accountId: 7, characterId: null, assetId: '123456789', waxAccount: 'cooltestacct', feeTxid: 'tx_abc',
    });
    expect(ok).toBe(false);
  });

  it('finds a prior operation by fee_txid', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [{ id: 1, op: 'mint', fee_txid: 'tx_abc' }] } as any);
    const row = await nftOperationByTxid('tx_abc');
    expect(row?.op).toBe('mint');
  });
});
