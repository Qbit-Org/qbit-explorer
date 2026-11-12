import { Request, Response } from 'express';
import config from '../config';

export function handleError(req: Request, res: Response, statusCode: number, errorMessage: string | unknown): void {
  if (req.accepts('json')) {
    res.status(statusCode).json({ error: errorMessage });
  } else {
    res.status(statusCode).send(errorMessage);
  }
}

// A transaction lookup can fail as "not found" in two ways depending on MEMPOOL_BACKEND:
//
// Core RPC ("none"/"electrum" modes) rejects with an Error whose message varies with txindex state:
// - "No such mempool or blockchain transaction. Use gettransaction for wallet transactions." (txindex enabled and synced)
// - "No such mempool transaction. Use -txindex or provide a block hash to enable blockchain transaction queries." (txindex disabled)
// - "No such mempool transaction. Blockchain transactions are still in the process of being indexed." (txindex still building)
// Only the first rules the transaction out. The other two say that Core can't look outside its mempool
// (isTxIndexUnavailableError), not that the transaction doesn't exist.
//
// esplora mode surfaces electrs's HTTP 404 as an axios error ("Request failed with
// status code 404") carrying response.status === 404.
//
// Core's first answer and electrs's 404 map to HTTP 404.
export function isTxNotFoundError(e: unknown): boolean {
  if (isTxNotInMempoolOrChainError(e)) {
    return true;
  }
  return (e as { response?: { status?: number } })?.response?.status === 404;
}

// Core's answer for a transaction outside its mempool while txindex is disabled or still building (see above)
export function isTxIndexUnavailableError(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith('No such mempool transaction.');
}

// What a route answers, with 503, when Core can't look a transaction up for want of txindex
export const TXINDEX_UNAVAILABLE = 'Looking up a transaction outside the mempool needs qbitd\'s txindex, which is disabled or still building';

// Whether Core has ruled a transaction out. Of the "No such mempool" answers above, only the one for a synced
// txindex does: the other two only say the transaction is not in the mempool, while txindex is disabled or
// still building.
export function isTxNotInMempoolOrChainError(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith('No such mempool or blockchain transaction');
}

// A block lookup fails as "not found" as Core RPC error -5 ("Block not found") in "none"/"electrum"
// modes, and as electrs's HTTP 404 in esplora mode. Both must map to HTTP 404.
//
// In esplora mode only electrs's 404 counts. There a route can ask Core about a block electrs has already
// returned, as block/:hash's getblockstats and getblockheader do, and Core's -5 then means that Core is behind
// (a fallback electrs ahead of the local node, say), not that the block doesn't exist.
export function isBlockNotFoundError(e: unknown): boolean {
  if (config.MEMPOOL.BACKEND !== 'esplora' && (e as { code?: unknown })?.code === -5) {
    return true;
  }
  return (e as { response?: { status?: number } })?.response?.status === 404;
}

// A block lookup by height fails as "not found" as above, or, in "none"/"electrum" modes, as Core RPC error -8,
// which getblockhash answers for a height above the tip ("Block height out of range"). Other RPCs answer -8 for
// other bad parameters, so only a lookup by height may read it as "not found".
export function isBlockHeightNotFoundError(e: unknown): boolean {
  return isBlockNotFoundError(e) || (config.MEMPOOL.BACKEND !== 'esplora' && (e as { code?: unknown })?.code === -8);
}

// Answers a failed lookup: 503 when Core needs txindex to answer it, 404 with notFound when isNotFound, the check for
// the kind of object the route looks up, matches, and 500 with failure for anything else. So a route that fetches
// more than its own object keeps the other failures a 500: block/:hash, for one, also fetches the block's coinbase
// transaction.
export function handleLookupError(req: Request, res: Response, e: unknown, isNotFound: (e: unknown) => boolean,
  notFound: string, failure: string): void {
  if (isTxIndexUnavailableError(e)) {
    handleError(req, res, 503, TXINDEX_UNAVAILABLE);
    return;
  }
  if (isNotFound(e)) {
    handleError(req, res, 404, notFound);
    return;
  }
  handleError(req, res, 500, failure);
}

// What a route that sends transactions to qbitd answers, with 503, when qbitd can't take the call now
export const QBITD_UNAVAILABLE = 'qbitd is unavailable, try again later';

// qbitd's codes for a node that can't serve calls yet (Qbit-Org/qbit v1.0.0 src/rpc/protocol.h). Every RPC answers
// RPC_IN_WARMUP, -28, while qbitd starts. RPC_CLIENT_IN_INITIAL_DOWNLOAD, -10, comes only from importmempool in
// v1.0.0, but means the same.
const RPC_NOT_READY_CODES = [-28, -10];

// The RPC client's own errors when qbitd's answer isn't a JSON-RPC reply (rpc-api/jsonrpc.ts): an empty 401 for a
// wrong login, 403 for an address rpcallowip doesn't allow, or 503 "Work queue depth exceeded". Their codes, -32602
// and -32603, aren't qbitd's.
const RPC_NO_REPLY = /^(Invalid params, response status code: \d+|Problem parsing JSON response from server)$/;

// Whether a call to qbitd's RPC failed for want of qbitd rather than because of what it sent: qbitd couldn't be
// reached or didn't answer in time, which the RPC client reports with a string code such as ECONNREFUSED or
// ETIMEDOUT, gave no JSON-RPC reply, or isn't ready yet.
export function isRpcUnavailableError(e: unknown): boolean {
  const code = (e as { code?: unknown })?.code;
  if (typeof code === 'string') {
    return true;
  }
  if (typeof code === 'number' && RPC_NOT_READY_CODES.includes(code)) {
    return true;
  }
  return e instanceof Error && RPC_NO_REPLY.test(e.message);
}

// Answers a failed call to qbitd from a route that sends it transactions. 503 when qbitd couldn't take the call, so
// that a wallet tries again later instead of dropping the transaction, and otherwise 400 with qbitd's code, as qbitd
// turned the transactions down, or with failure when the error has no code.
export function handleRpcError(req: Request, res: Response, e: unknown, rpc: string, failure: string): void {
  if (isRpcUnavailableError(e)) {
    handleError(req, res, 503, QBITD_UNAVAILABLE);
    return;
  }
  const { message, code } = (e ?? {}) as { message?: unknown, code?: unknown };
  handleError(req, res, 400, (message && code) ? `${rpc} RPC error: ` + JSON.stringify({ code }) : failure);
}

// electrs's reason for an after_txid it cannot find, which the electrum backend answers with too
export const AFTER_TXID_NOT_FOUND = 'after_txid not found';

// An address lookup can fail because of the request in several ways depending on MEMPOOL_BACKEND:
//
// electrum mode checks the address with the node's validateaddress RPC first and rejects with
// Error('Invalid Bitcoin address'). It rejects an after_txid that is neither in the address's history
// nor known to the node with Error(AFTER_TXID_NOT_FOUND), as esplora mode's 422 below.
//
// esplora mode surfaces electrs's HTTP errors as axios errors ("Request failed with status code 400")
// carrying response.status, with electrs's plain-text reason as response.data. electrs answers 400 for
// nearly every failure, including its own database and node errors, so only these are the request's fault:
// - 400 "invalid qbit ...", "qbit address ..." or "qbit P2MR address ..." (qbit_address::Error): the address
//   does not parse. Other "qbit ..." errors are electrs's own, such as a block it cannot decode.
// - 400 "Too many ..." (TooManyUtxos, TooManyTxs): more unspent outputs or history than electrs is configured
//   to serve, which maps to the 413 the electrum backend's "too long" gets.
// - 422 "after_txid not found": the transaction left the mempool, and the address page reloads on it.
//
// Returns the status and reason to answer with, or undefined for any other error.
export function getAddressLookupError(e: unknown): { status: number, reason: string } | undefined {
  if (e instanceof Error && e.message === 'Invalid Bitcoin address') {
    return { status: 400, reason: e.message };
  }
  if (e instanceof Error && e.message === AFTER_TXID_NOT_FOUND) {
    return { status: 422, reason: e.message };
  }
  const response = (e as { response?: { status?: number, data?: unknown } })?.response;
  const reason = typeof response?.data === 'string' ? response.data : '';
  if (response?.status === 422 && reason === 'after_txid not found') {
    return { status: 422, reason };
  }
  if (response?.status === 400 && /^(invalid qbit |qbit (P2MR )?address )/.test(reason)) {
    return { status: 400, reason };
  }
  if (response?.status === 400 && reason.startsWith('Too many ')) {
    return { status: 413, reason };
  }
  return undefined;
}

// qbit-electrs answers an address prefix search with 400 "address search disabled" unless it runs with
// --address-search (src/rest.rs): it has no prefix index, so there are no suggestions to give.
export function isAddressSearchDisabledError(e: unknown): boolean {
  const response = (e as { response?: { status?: number, data?: unknown } })?.response;
  return response?.status === 400 && typeof response.data === 'string' &&
    response.data.trim().toLowerCase().includes('address search disabled');
}

// Whether an esplora request failed because of the request: electrs has no such object (404), rejected
// the request in a way getAddressLookupError recognizes, or has no address prefix index. Anything else is
// the host's failure, including electrs's other 400s and any answer from a proxy or allowlist in front of it.
export function isEsploraRequestError(e: unknown): boolean {
  return (e as { response?: { status?: number } })?.response?.status === 404 || getAddressLookupError(e) !== undefined ||
    isAddressSearchDisabledError(e);
}