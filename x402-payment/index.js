"use strict";

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");

const ENV_PATH = process.env.BUILTWITH_ENV_PATH
  ? path.resolve(process.env.BUILTWITH_ENV_PATH)
  : path.join(__dirname, ".env");

require("dotenv").config({ path: ENV_PATH, quiet: true });

const { x402Client } = require("@x402/core/client");
const {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
} = require("@x402/core/http");
const { ExactEvmScheme } = require("@x402/evm/exact/client");
const { privateKeyToAccount } = require("viem/accounts");

const MCP_URL = process.env.BUILTWITH_MCP_URL || "https://api.builtwith.com/mcp";
const BASE_NETWORK = "eip155:8453";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const DEFAULT_BUILTWITH_PAYEE = "0x1937E2d648b8f07A03429AE35f28C4942A756C94";
const EXPECTED_PAY_TO = process.env.EXPECTED_PAY_TO || DEFAULT_BUILTWITH_PAYEE;
const PACKAGE_CREDITS = 2_000;
const PACKAGE_AMOUNT_ATOMIC = 99_000_000n;
const CREDIT_KEY_ENV = "BUILTWITH_CREDIT_KEY";
const PRICING_TOOL = "x402-pricing";
const PURCHASE_TOOL = "x402-credit-purchase";
const BALANCE_TOOL = "x402-credit-balance";
const LOOKUP_TOOL = "x402-domain-lookup";

class ToolCallError extends Error {
  constructor(message, payload) {
    super(message);
    this.name = "ToolCallError";
    this.payload = payload;
  }
}

function usage() {
  console.log(`Usage:
  node index.js <root-domain>
  node index.js --quote

Examples:
  node index.js example.com
  npm run quote

If no usable prepaid key is stored, a lookup offers to purchase 2,000
non-expiring credits for 99 USDC. No purchase occurs unless you type YES.`);
}

function normalizePrivateKey(value) {
  if (!value) {
    throw new Error(
      "EVM_PRIVATE_KEY is missing. It is required only to purchase or top up credits.",
    );
  }

  const key = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("EVM_PRIVATE_KEY must be 32 bytes: 64 hexadecimal characters, optionally prefixed with 0x.");
  }
  return key;
}

function parseUsdcToAtomic(value) {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) {
    throw new Error("USDC amount must be positive and have no more than 6 decimal places.");
  }

  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

function validateDomain(value) {
  const domain = value.trim().toLowerCase().replace(/\.$/, "");
  if (
    domain.length > 253 ||
    !domain.includes(".") ||
    !/^[a-z0-9.-]+$/.test(domain) ||
    domain.split(".").some((label) => !label || label.length > 63 || label.startsWith("-") || label.endsWith("-"))
  ) {
    throw new Error(`Invalid root domain: ${value}`);
  }
  return domain;
}

function validateCreditKey(value) {
  return typeof value === "string" && value.length >= 32 && value.length <= 256 && !/[\r\n]/.test(value);
}

function parseMcpResponse(text, contentType) {
  if (contentType.includes("text/event-stream")) {
    const messages = [];
    for (const block of text.split(/\r?\n\r?\n/)) {
      const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      if (data && data !== "[DONE]") messages.push(JSON.parse(data));
    }
    if (!messages.length) throw new Error(`BuiltWith returned an empty MCP event stream: ${text.slice(0, 300)}`);
    return messages.at(-1);
  }

  return JSON.parse(text);
}

async function postMcp(body, extraHeaders = {}) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let message = null;
  if (text) {
    try {
      message = parseMcpResponse(text, response.headers.get("content-type") || "");
    } catch (error) {
      if (response.ok) throw error;
    }
  }

  if (!response.ok && response.status !== 402) {
    throw new Error(`BuiltWith MCP returned HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  return { response, message, text };
}

function createToolRequest(name, argumentsValue) {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name,
      arguments: argumentsValue,
    },
  };
}

function parseContentJson(message) {
  const result = message?.result;
  if (result?.structuredContent) return result.structuredContent;

  const textContent = result?.content?.find((item) => item.type === "text")?.text;
  if (!textContent) return null;
  try {
    return JSON.parse(textContent);
  } catch {
    return textContent;
  }
}

function getPaymentRequired(mcpResponse) {
  const header = mcpResponse.response.headers.get("payment-required");
  if (header) return decodePaymentRequiredHeader(header);

  const embedded = parseContentJson(mcpResponse.message);
  if (embedded?.x402Version && Array.isArray(embedded.accepts)) return embedded;
  const wrapped = embedded?.["x402/error"]?.data;
  if (wrapped?.x402Version && Array.isArray(wrapped.accepts)) return wrapped;
  return null;
}

function unwrapToolResult(message) {
  if (message?.error) {
    throw new ToolCallError(`MCP error ${message.error.code}: ${message.error.message}`, message.error);
  }

  const result = message?.result;
  const parsed = parseContentJson(message);
  if (result?.isError) {
    const messageText =
      parsed && typeof parsed === "object" && typeof parsed.error === "string"
        ? parsed.error
        : typeof parsed === "string"
          ? parsed
          : JSON.stringify(parsed);
    throw new ToolCallError(messageText || "BuiltWith tool call failed.", parsed);
  }
  return parsed ?? result;
}

function enforcePurchasePolicy(paymentRequired) {
  if (paymentRequired.x402Version !== 2) throw new Error("Refusing purchase: BuiltWith did not quote x402 v2.");
  if (paymentRequired.resource?.url !== `mcp://tool/${PURCHASE_TOOL}`) {
    throw new Error(`Refusing purchase for unexpected resource: ${paymentRequired.resource?.url || "(missing)"}`);
  }

  const allowed = paymentRequired.accepts.filter((requirement) => {
    const amount = requirement.amount && /^\d+$/.test(requirement.amount)
      ? BigInt(requirement.amount)
      : -1n;
    return (
      requirement.scheme === "exact" &&
      requirement.network === BASE_NETWORK &&
      requirement.asset?.toLowerCase() === BASE_USDC.toLowerCase() &&
      requirement.payTo?.toLowerCase() === EXPECTED_PAY_TO.toLowerCase() &&
      amount === PACKAGE_AMOUNT_ATOMIC
    );
  });

  if (!allowed.length) {
    const quote = paymentRequired.accepts[0] || {};
    throw new Error(
      `Refusing changed package quote. Expected ${PACKAGE_AMOUNT_ATOMIC} atomic USDC on Base to ` +
        `${EXPECTED_PAY_TO}; received ${quote.amount || "?"} on ${quote.network || "unknown network"} ` +
        `to ${quote.payTo || "unknown"}.`,
    );
  }
  return allowed;
}

function createPaymentClient(account, allowedRequirements) {
  const client = new x402Client((version, candidates) => {
    if (version !== 2) throw new Error(`Unsupported x402 version: ${version}`);
    const selected = candidates.find((candidate) =>
      allowedRequirements.some(
        (allowed) =>
          candidate.scheme === allowed.scheme &&
          candidate.network === allowed.network &&
          candidate.asset.toLowerCase() === allowed.asset.toLowerCase() &&
          candidate.payTo.toLowerCase() === allowed.payTo.toLowerCase() &&
          candidate.amount === allowed.amount,
      ),
    );
    if (!selected) throw new Error("The package quote changed after policy validation.");
    return selected;
  });

  client.register(BASE_NETWORK, new ExactEvmScheme(account));
  return client;
}

function assertCredentialStoreWritable(envPath = ENV_PATH) {
  const directory = path.dirname(envPath);
  fs.accessSync(directory, fs.constants.W_OK);
  if (fs.existsSync(envPath)) fs.accessSync(envPath, fs.constants.R_OK | fs.constants.W_OK);
}

function updateEnvValue(name, value, envPath = ENV_PATH) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error(`Invalid environment variable name: ${name}`);
  if (typeof value !== "string" || /[\r\n]/.test(value)) throw new Error(`Invalid value for ${name}.`);

  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const newline = existing.includes("\r\n") ? "\r\n" : "\n";
  const entry = `${name}=${value}`;
  const expression = new RegExp(`^${name}=.*$`, "m");
  let updated;
  if (expression.test(existing)) {
    updated = existing.replace(expression, entry);
  } else {
    const separator = existing && !existing.endsWith("\n") && !existing.endsWith("\r") ? newline : "";
    updated = `${existing}${separator}${entry}${newline}`;
  }

  const temporary = `${envPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporary, updated, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(temporary, envPath);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary);
  }
}

async function confirmPackagePurchase(isTopUp = false) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("A 99 USDC purchase requires an interactive terminal and explicit confirmation.");
  }

  const action = isTopUp
    ? "Top up this BuiltWith key with 2,000 non-expiring credits"
    : "Purchase 2,000 non-expiring BuiltWith API credits";
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await terminal.question(`${action} for 99.00 USDC on Base? Type YES to confirm: `);
    return answer.trim() === "YES";
  } finally {
    terminal.close();
  }
}

function getReceipt(mcpResponse) {
  const receiptHeader =
    mcpResponse.response.headers.get("payment-response") ||
    mcpResponse.response.headers.get("x-payment-response");
  return (
    mcpResponse.message?.result?._meta?.["x402/payment-response"] ||
    (receiptHeader ? decodePaymentResponseHeader(receiptHeader) : null)
  );
}

async function purchaseCredits(account, existingKey = "", dependencies = {}) {
  const post = dependencies.postMcp || postMcp;
  const confirm = dependencies.confirm || confirmPackagePurchase;
  const persist = dependencies.persist || ((key) => updateEnvValue(CREDIT_KEY_ENV, key));
  const createPayload = dependencies.createPaymentPayload;
  const args = {
    credits: PACKAGE_CREDITS,
    payer: account.address,
    ...(existingKey ? { creditKey: existingKey } : {}),
  };
  const request = createToolRequest(PURCHASE_TOOL, args);
  const initial = await post(request);
  const paymentRequired = getPaymentRequired(initial);
  if (!paymentRequired) {
    throw new Error("BuiltWith did not return an x402 package quote.");
  }

  const allowedRequirements = enforcePurchasePolicy(paymentRequired);
  assertCredentialStoreWritable(dependencies.envPath || ENV_PATH);
  const approved = await confirm(Boolean(existingKey));
  if (!approved) throw new Error("Purchase cancelled; no payment was authorized.");

  const selected = allowedRequirements[0];
  console.error(
    `Authorizing ${(Number(selected.amount) / 1_000_000).toFixed(2)} USDC on Base from ${account.address}...`,
  );
  const paymentPayload = createPayload
    ? await createPayload(paymentRequired, allowedRequirements)
    : await createPaymentClient(account, allowedRequirements).createPaymentPayload(paymentRequired);
  const paidRequest = {
    ...request,
    params: {
      ...request.params,
      _meta: {
        ...request.params._meta,
        "x402/payment": paymentPayload,
      },
    },
  };
  const paid = await post(paidRequest);
  const result = unwrapToolResult(paid.message);
  if (!validateCreditKey(result?.creditKey)) {
    throw new Error("Payment settled but BuiltWith did not return a valid reusable credit key.");
  }

  const receipt = getReceipt(paid);
  if (receipt) {
    console.error(`Payment settled${receipt.transaction ? `: ${receipt.transaction}` : "."}`);
  }

  process.env[CREDIT_KEY_ENV] = result.creditKey;
  try {
    if (dependencies.persist) {
      persist(result.creditKey);
    } else {
      updateEnvValue(CREDIT_KEY_ENV, result.creditKey, dependencies.envPath || ENV_PATH);
    }
    console.error(`Saved ${CREDIT_KEY_ENV} in ${dependencies.envPath || ENV_PATH}.`);
  } catch (error) {
    console.error(`WARNING: The purchase succeeded, but the credit key could not be saved: ${error.message}`);
    console.error(`Save this line in ${dependencies.envPath || ENV_PATH} now:`);
    console.error(`${CREDIT_KEY_ENV}=${result.creditKey}`);
  }

  return result.creditKey;
}

async function getCreditBalance(creditKey, post = postMcp) {
  try {
    const response = await post(createToolRequest(BALANCE_TOOL, { creditKey }));
    return { valid: true, ...unwrapToolResult(response.message) };
  } catch (error) {
    if (error instanceof ToolCallError && /Invalid or revoked prepaid credit key/i.test(error.message)) {
      return { valid: false };
    }
    throw error;
  }
}

function createLazyAccount() {
  let account;
  return () => {
    if (!account) account = privateKeyToAccount(normalizePrivateKey(process.env.EVM_PRIVATE_KEY));
    return account;
  };
}

async function ensureCreditKey(storedKey, getAccount, dependencies = {}) {
  const post = dependencies.postMcp || postMcp;
  if (!validateCreditKey(storedKey)) {
    if (storedKey) console.error("Stored BUILTWITH_CREDIT_KEY is malformed; a new package is required.");
    return purchaseCredits(getAccount(), "", dependencies);
  }

  const balance = await getCreditBalance(storedKey, post);
  if (!balance.valid) {
    console.error("Stored BuiltWith credit key is invalid or revoked; a new package is required.");
    return purchaseCredits(getAccount(), "", dependencies);
  }
  if (Number(balance.availableCredits) > 0) return storedKey;

  console.error("Stored BuiltWith credit key has no available credits.");
  const account = getAccount();
  const canTopUp =
    typeof balance.payer === "string" &&
    balance.payer.toLowerCase() === account.address.toLowerCase();
  if (!canTopUp) {
    console.error("The current wallet did not purchase this key, so a new key will be created.");
  }
  return purchaseCredits(account, canTopUp ? storedKey : "", dependencies);
}

async function performLookup(domain, creditKey, post = postMcp) {
  const request = createToolRequest(LOOKUP_TOOL, {
    domain,
    liveOnly: true,
    creditKey,
  });
  const response = await post(request);
  const result = unwrapToolResult(response.message);
  const credits = response.message?.result?._meta?.builtwithCredits;
  if (credits && Number.isFinite(Number(credits.available))) {
    console.error(`Credit used; ${credits.available} remaining.`);
  }
  return result;
}

function isRecoverableCreditError(error) {
  return (
    error instanceof ToolCallError &&
    (/Insufficient prepaid credits/i.test(error.message) ||
      /Invalid or revoked prepaid credit key/i.test(error.message))
  );
}

async function showQuote() {
  const response = await postMcp(createToolRequest(PRICING_TOOL, { credits: PACKAGE_CREDITS }));
  console.log(JSON.stringify(unwrapToolResult(response.message), null, 2));
}

async function lookup(domainInput) {
  const domain = validateDomain(domainInput);
  const getAccount = createLazyAccount();
  let creditKey = await ensureCreditKey(process.env[CREDIT_KEY_ENV] || "", getAccount);

  try {
    console.log(JSON.stringify(await performLookup(domain, creditKey), null, 2));
  } catch (error) {
    if (!isRecoverableCreditError(error)) throw error;
    console.error(`${error.message} Rechecking the stored key.`);
    creditKey = await ensureCreditKey(creditKey, getAccount);
    console.log(JSON.stringify(await performLookup(domain, creditKey), null, 2));
  }
}

async function main() {
  const argument = process.argv[2];
  if (!argument || argument === "--help" || argument === "-h") {
    usage();
    process.exitCode = argument ? 0 : 1;
    return;
  }

  if (argument === "--quote") {
    await showQuote();
    return;
  }
  await lookup(argument);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  PACKAGE_AMOUNT_ATOMIC,
  PACKAGE_CREDITS,
  ToolCallError,
  enforcePurchasePolicy,
  ensureCreditKey,
  getCreditBalance,
  parseMcpResponse,
  parseUsdcToAtomic,
  performLookup,
  purchaseCredits,
  updateEnvValue,
  validateCreditKey,
  validateDomain,
};
