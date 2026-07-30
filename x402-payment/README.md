# BuiltWith prepaid domain lookups with x402

A small Node.js CommonJS app that buys a reusable package of BuiltWith API
credits with one x402 payment, stores the returned secret key locally, and uses
one credit per `x402-domain-lookup` MCP call.

## What you need

- Node.js 22 or newer.
- 99 USDC on **Base mainnet** when purchasing or topping up.
- The private key for that funded account. Prefer a dedicated low-balance
  account.

You do **not** need a BuiltWith API key, Base RPC key, Coinbase key, MetaMask
password, or MetaMask seed phrase.

## Setup

1. Copy `.env.example` to `.env`.
2. Put the funded account's private key in `EVM_PRIVATE_KEY`.
3. Install and run:

```powershell
npm install
npm run quote
npm run lookup -- example.com
```

`npm run quote` is free and never signs or sends a payment.

On the first lookup, the app obtains the current package quote and verifies it
against its hard-coded safety policy. It will accept only 2,000 non-expiring
credits for exactly 99 USDC on Base, paid to the configured BuiltWith address.
It then displays:

```text
Purchase 2,000 non-expiring BuiltWith API credits for 99.00 USDC on Base? Type YES to confirm:
```

Nothing is signed unless you type the uppercase word `YES` in an interactive
terminal. After settlement, the app writes the returned bearer key to
`BUILTWITH_CREDIT_KEY` in the gitignored `.env` file and immediately continues
the requested lookup.

Future lookups check the key's free balance endpoint and send the stored key in
the MCP tool arguments. They do not make an on-chain payment. When the balance
reaches zero, the app offers to top up the same key with another confirmed
2,000-credit package.

## Payment and credential safety

The app accepts only:

- x402 v2 `exact`
- Base mainnet (`eip155:8453`)
- native Base USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- BuiltWith's configured payee
- the `x402-credit-purchase` MCP resource
- exactly 99 USDC for exactly 2,000 credits

`.env` is excluded by `.gitignore`. Both `EVM_PRIVATE_KEY` and
`BUILTWITH_CREDIT_KEY` are secrets. Do not paste either value into source code,
terminal commands, chat, issues, or commits.

If the `.env` update unexpectedly fails after a successful payment, the app
prints the returned `BUILTWITH_CREDIT_KEY=...` line once so it can be saved
manually instead of losing the purchased credential.
