# Contributing to qbit-explorer

Thank you for helping improve qbit-explorer. This guide explains how to set up
the project, make a change, and get it merged.

Found a security problem? Do not open an issue. Follow
[SECURITY.md](SECURITY.md) instead.

## Before you start

- **Bugs:** open an issue with the bug report form. It asks for the network,
  the page URL, your browser, and the steps to reproduce.
- **Small fixes** such as typos, docs, or tests: open a pull request directly.
- **Larger changes:** open an issue first so we can agree on the approach.
  This matters most for weight, vsize, or fee math, address and script
  decoding, values that come from qbit consensus such as subsidy and
  difficulty, database migrations, and deployment configs.
- **Node or indexer bugs** belong in their own repositories: see
  [Changes outside this repository](#changes-outside-this-repository).

## Set up and validate

[AGENTS.md](AGENTS.md) is the reference for working in this repository. Use
it rather than a copy here:

- "Fast Start" and [docs/qbit-local-dev.md](docs/qbit-local-dev.md) install
  the toolchains and run the stack against a local qbit regtest node. You need
  Node.js at the version in [`.nvmrc`](.nvmrc), Rust at the version in
  [`rust/gbt/rust-toolchain`](rust/gbt/rust-toolchain) (the backend builds
  the Rust module when you install it), and Docker for the MariaDB test
  database.
- [Local Validation Gates](AGENTS.md#local-validation-gates) lists the lint,
  test, and build commands for the backend and the frontend.
- [Test Mapping by Area](AGENTS.md#test-mapping-by-area) lists the minimum
  checks for each kind of change, and the qbit evidence to attach.

## Make a change

1. Fork the repository and create a branch from `main`.
2. Keep each pull request focused on one change. Small changes that can be
   checked against qbit regtest or testnet4 are the easiest to review.
3. Add or update tests for any behavior you change.
4. Run the gates for the parts you touched, plus the checks that Test Mapping
   by Area lists for your change.
5. Open a pull request against `main` and fill in the template, including the
   commands you ran and any qbit evidence.

### Commit messages

Start the subject with the area you changed, then a short summary:

```text
Transactions: recognise P2MR PQC signatures instead of marking inputs unsigned
Backend: return 404 (not 500) for unknown transactions on all Core not-found variants
Mining: the pool is now Qbit Pool
```

Use the body to explain why the change is needed.

Every commit on `main` and `1.x.x` must carry a verified signature, and pull
requests merge with a merge commit: squash and rebase merges are off. You
don't need to sign your own commits. When a pull request is ready, a
maintainer squashes it into one commit, signs it and merges it, so the branch
gets one commit for each pull request, under GitHub's merge commit. That
commit's subject is the pull request's title, so write the title in the same
style. Leave "Allow edits by maintainers" on, so the maintainer can push the
signed commit to your branch. If your fork can't offer that, a maintainer
opens the same change from a branch in this repository. An open pull request
usually shows a failing `signed-landing` check until the maintainer has done
that, which is expected. The check starts reporting once its workflow has been
promoted to `main`. The rulesets that enforce this are in
[`.github/rulesets/`](.github/rulesets/).

## Review

- GitHub asks the code owners in [`.github/CODEOWNERS`](.github/CODEOWNERS)
  to review each pull request.
- Reviewers follow [Review Expectations](AGENTS.md#review-expectations) in
  AGENTS.md. In short: qbit constants are checked against the qbit source,
  weight and vsize changes must keep `vsize == weight` (qbit's witness scale
  factor is 1), and upstream behavior stays unless qbit needs it changed.
- New dependencies need a clear reason. We keep the dependency set small and
  review every addition.

## Upstream changes

qbit-explorer is a fork of mempool/mempool, and it stays close to upstream so
that upstream fixes can still be applied:

- Keep upstream behavior unless qbit needs something different, and avoid
  reformatting or renaming upstream code that your change does not need to
  touch. Every extra difference makes later cherry-picks harder.
- To bring in an upstream fix, cherry-pick it as the README's
  [Upstream](README.md#upstream) section describes. Use `git cherry-pick -x`,
  and name the upstream commit SHA in the pull request description. If you
  had to adapt the change, say what differs from upstream.

## Changes outside this repository

Some of what the explorer shows comes from other projects:

- qbit node (`qbitd`): [Qbit-Org/qbit](https://github.com/Qbit-Org/qbit)
- Indexer: [Qbit-Org/qbit-electrs](https://github.com/Qbit-Org/qbit-electrs)

Fix node and indexer bugs there first. Once the fix is merged, open a pull
request here if the explorer needs to change too.

The header and footer render from the qbit.org design contract, vendored in
`frontend/src/resources/qbit-design/`. Do not edit those files by hand.
`node scripts/sync-qbit-design.mjs`, run from `frontend/`, rewrites them from
qbit.org.

## Translations

We are not taking translation contributions yet. Upstream's Transifex project
is not used here, so please do not pull translations from it.

The language menu offers English only. The English source strings are in
`frontend/src/locale/messages.xlf`, and `npm run i18n-extract-from-source`,
run from `frontend/`, regenerates that file from the source. The translation
files for other languages (`messages.<lang>.xlf`) are upstream mempool's and
have not been updated for qbit.

Each unit in a translation file keeps the English text it translates. CI
fails when that text differs from the unit with the same id in `messages.xlf`,
or when the translation uses a placeholder that English doesn't have. That
happens when you change the English of a message with a custom `@@` id, which
keeps its id. Then run `node scripts/check-translations.mjs --fix` from
`frontend/`: it removes those units, and the build shows your English text in
every language.

## License

Contributions are licensed under the same terms as the rest of the project:
the GNU Affero General Public License, version 3 (see [LICENSE](LICENSE) and
[COPYING.md](COPYING.md)). By opening a pull request, you agree to license
your contribution under those terms. You do not need to sign a contributor
license agreement or add a sign-off line to your commits.
