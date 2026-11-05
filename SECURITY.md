# Security policy

qbit-explorer is the block explorer and API behind mempool.qbit.org and
mempool-testnet.qbit.org. It does not hold user keys or funds, but people rely
on what it shows them. We treat any issue that could show users false chain
data, run an attacker's code in their browser, or give access to the servers,
node, or database behind an instance as a priority.

## Reporting a vulnerability

**Do not open a public issue, pull request, or discussion for a security
problem.**

Report it privately by email to **contact@qbit.org**, with
`qbit-explorer security` in the subject. This is the only reporting channel
for now: GitHub private vulnerability reporting is not yet enabled for this
repository. Email is not encrypted, so keep the first message short and we
will reply to agree a private way to continue.

Once private vulnerability reporting is enabled, you will also be able to
report through GitHub:

1. Go to the repository's **Security** tab.
2. Choose **Report a vulnerability**.
3. Fill in the advisory form.

Please include:

- the affected commit, or the page or API URL on a public instance;
- the component and file paths involved, such as a frontend component, a
  REST endpoint, a WebSocket message, or a deployment config;
- what an attacker needs (for example, a crafted transaction in a block, a
  malicious link, or network access to an instance);
- the impact: what the attacker can do that they should not be able to; and
- steps to reproduce, ideally against a local regtest stack
  ([docs/qbit-local-dev.md](docs/qbit-local-dev.md)), with the request,
  transaction, or txid that triggers the issue.

A report does not need all of this to be useful. Send what you have.

Send a separate report for each distinct issue, so each one can be tracked and
fixed on its own.

**Never send private keys, seed phrases, passwords, RPC credentials, or other
secrets**, even your own. If you need to share a sensitive file, ask us first
and we will arrange a secure way to send it.

## What to expect

- We acknowledge your report within 3 business days.
- We confirm or reject the issue, and give it a severity, within 10 business
  days, or tell you what more we need.
- We fix confirmed issues as fast as their severity calls for. How long a fix
  takes depends on the issue, so we do not promise a fixed date.
- We publish an advisory after the fix is on `main` and running on the public
  instances, and other operators have had a reasonable chance to update.

We will keep you updated as we work on the issue. We credit reporters in the
published advisory unless you ask us not to.

We do not currently run a paid bug bounty.

### Issues that also affect upstream

Much of this code comes from
[mempool/mempool](https://github.com/mempool/mempool). If an issue also
affects upstream, we coordinate with the upstream project, following its
[security policy](https://github.com/mempool/mempool/security/policy), before
anything is disclosed. This can move the disclosure date, and we will tell you
if it does.

## Scope

In scope:

- the web frontend in `frontend/`, including how it displays chain data;
- the backend in `backend/` and its REST and WebSocket API, including the
  block-template module in `rust/`;
- the deployment configs in this repository, such as the Docker images and
  the nginx configs; and
- issues on mempool.qbit.org and mempool-testnet.qbit.org that come from this
  code or these configs.

Report these to their own repositories instead:

- qbit node (`qbitd`): [Qbit-Org/qbit](https://github.com/Qbit-Org/qbit)
- Indexer: [Qbit-Org/qbit-electrs](https://github.com/Qbit-Org/qbit-electrs)

Out of scope:

- issues that need a compromised operating system or browser;
- missing security headers or best-practice notes with no demonstrated impact;
- denial of service by traffic volume against the public instances; and
- findings from automated scanners without a working attack path.

## Supported versions

We fix security issues on the `main` branch. There are no release branches,
so self-hosted instances should update to the latest `main`.

## Testing rules

- Test against your own instance, ideally a local regtest stack.
- Do not put attack payloads on mainnet or testnet4, where the public
  instances would show them to other people.
- Do not try to reach the servers, nodes, or databases behind the public
  instances.
- Do not run denial-of-service attacks or automated scans against the public
  instances.
- Keep the issue and its details private until we confirm that a fix has
  shipped, or until we agree a disclosure date with you in writing.
- Do not sell or share an unfixed issue with anyone else, and do not make your
  report conditional on payment or other terms.

As far as we have the authority to do so, we treat research that follows this
policy as authorized, and we will not take legal action over accidental,
good-faith breaches of it. We keep all legal remedies for serious breaches of
this policy or of the law. If a concern comes up, we will first try to resolve
it with you directly.

This policy does not authorize testing of systems that other parties own, and
it does not bind them.
