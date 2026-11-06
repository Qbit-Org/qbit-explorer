import { Request, Response } from 'express';

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
// All share the "No such mempool" prefix.
//
// esplora mode surfaces electrs's HTTP 404 as an axios error ("Request failed with
// status code 404") carrying response.status === 404.
//
// Both must map to HTTP 404.
export function isTxNotFoundError(e: unknown): boolean {
  if (e instanceof Error && !!e.message && e.message.indexOf('No such mempool') > -1) {
    return true;
  }
  return (e as { response?: { status?: number } })?.response?.status === 404;
}

// A block lookup fails as "not found" as Core RPC error -5 ("Block not found") in "none"/"electrum"
// modes, and as electrs's HTTP 404 in esplora mode. Both must map to HTTP 404.
export function isBlockNotFoundError(e: unknown): boolean {
  if ((e as { code?: unknown })?.code === -5) {
    return true;
  }
  return (e as { response?: { status?: number } })?.response?.status === 404;
}

// An address lookup can fail because of the request in several ways depending on MEMPOOL_BACKEND:
//
// electrum mode checks the address with the node's validateaddress RPC first and rejects with
// Error('Invalid Bitcoin address').
//
// esplora mode surfaces electrs's HTTP errors as axios errors ("Request failed with status code 400")
// carrying response.status, with electrs's plain-text reason as response.data. electrs answers 400 for
// nearly every failure, including its own database and node errors, so only these are the request's fault:
// - 400 "invalid qbit ...", "qbit address ..." or "qbit P2MR address ..." (qbit_address::Error): the address
//   does not parse. Other "qbit ..." errors are electrs's own, such as a block it cannot decode.
// - 400 "Too many ..." (TooManyUtxos): more unspent outputs than electrs is configured to serve, which maps
//   to the 413 the electrum backend's "too long" gets.
// - 422 "after_txid not found": the transaction left the mempool, and the address page reloads on it.
//
// Returns the status and reason to answer with, or undefined for any other error.
export function getAddressLookupError(e: unknown): { status: number, reason: string } | undefined {
  if (e instanceof Error && e.message === 'Invalid Bitcoin address') {
    return { status: 400, reason: e.message };
  }
  const response = (e as { response?: { status?: number, data?: unknown } })?.response;
  const reason = typeof response?.data === 'string' ? response.data : '';
  if (response?.status === 422) {
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