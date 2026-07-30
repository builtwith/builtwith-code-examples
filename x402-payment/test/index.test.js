"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  PACKAGE_AMOUNT_ATOMIC,
  enforcePurchasePolicy,
  ensureCreditKey,
  getCreditBalance,
  performLookup,
  purchaseCredits,
  updateEnvValue,
  validateCreditKey,
  validateDomain,
} = require("../index");

const PAYER = "0x1111111111111111111111111111111111111111";
const PAYEE = "0x1937E2d648b8f07A03429AE35f28C4942A756C94";
const CREDIT_KEY = "bw_credit_1234567890123456789012345678901234567890";

function mcpResponse(message, headers = {}) {
  return {
    response: {
      headers: new Headers(headers),
    },
    message,
    text: JSON.stringify(message),
  };
}

function paymentRequired(amount = PACKAGE_AMOUNT_ATOMIC.toString()) {
  return {
    x402Version: 2,
    error: "Payment required to access this tool",
    resource: {
      url: "mcp://tool/x402-credit-purchase",
      description: "2000 non-expiring BuiltWith API credits",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        amount,
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        payTo: PAYEE,
        maxTimeoutSeconds: 120,
        extra: { name: "USD Coin", version: "2" },
      },
    ],
  };
}

function challengeResponse(challenge = paymentRequired()) {
  return mcpResponse({
    jsonrpc: "2.0",
    id: 1,
    result: {
      content: [{ type: "text", text: JSON.stringify(challenge) }],
      structuredContent: challenge,
      isError: true,
    },
  });
}

function purchaseResponse(creditKey = CREDIT_KEY) {
  const result = {
    creditKey,
    payer: PAYER,
    creditsPurchased: 2000,
    price: "$99.00",
    isTopUp: false,
  };
  return mcpResponse({
    jsonrpc: "2.0",
    id: 1,
    result: {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    },
  });
}

test("validates domains and reusable credit keys", () => {
  assert.equal(validateDomain("Example.COM."), "example.com");
  assert.throws(() => validateDomain("not a domain"), /Invalid root domain/);
  assert.equal(validateCreditKey(CREDIT_KEY), true);
  assert.equal(validateCreditKey("too-short"), false);
  assert.equal(validateCreditKey(`${CREDIT_KEY}\nINJECTED=1`), false);
});

test("purchase policy accepts only the fixed 2,000-credit package", () => {
  const accepted = enforcePurchasePolicy(paymentRequired());
  assert.equal(accepted.length, 1);
  assert.throws(
    () => enforcePurchasePolicy(paymentRequired("99000001")),
    /Refusing changed package quote/,
  );
  assert.throws(
    () =>
      enforcePurchasePolicy({
        ...paymentRequired(),
        resource: { url: "mcp://tool/x402-domain-lookup" },
      }),
    /unexpected resource/,
  );
});

test("updates only BUILTWITH_CREDIT_KEY while preserving an existing env file", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "builtwith-x402-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const envPath = path.join(directory, ".env");
  fs.writeFileSync(
    envPath,
    "# wallet\r\nEVM_PRIVATE_KEY=keep-this\r\nBUILTWITH_CREDIT_KEY=old-key\r\nOTHER=value\r\n",
  );

  updateEnvValue("BUILTWITH_CREDIT_KEY", CREDIT_KEY, envPath);
  const updated = fs.readFileSync(envPath, "utf8");
  assert.match(updated, /EVM_PRIVATE_KEY=keep-this/);
  assert.match(updated, new RegExp(`BUILTWITH_CREDIT_KEY=${CREDIT_KEY}`));
  assert.match(updated, /OTHER=value/);
  assert.equal((updated.match(/BUILTWITH_CREDIT_KEY=/g) || []).length, 1);
  assert.ok(updated.includes("\r\n"));
});

test("appends BUILTWITH_CREDIT_KEY to an env file that does not contain it", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "builtwith-x402-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const envPath = path.join(directory, ".env");
  fs.writeFileSync(envPath, "EVM_PRIVATE_KEY=keep-this");

  updateEnvValue("BUILTWITH_CREDIT_KEY", CREDIT_KEY, envPath);
  assert.equal(
    fs.readFileSync(envPath, "utf8"),
    `EVM_PRIVATE_KEY=keep-this\nBUILTWITH_CREDIT_KEY=${CREDIT_KEY}\n`,
  );
});

test("confirmed purchase sends MCP payment metadata and persists returned key", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "builtwith-x402-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const envPath = path.join(directory, ".env");
  fs.writeFileSync(envPath, "EVM_PRIVATE_KEY=not-used-in-mock\n");
  const requests = [];
  let persisted = "";

  const key = await purchaseCredits(
    { address: PAYER },
    "",
    {
      envPath,
      postMcp: async request => {
        requests.push(request);
        return requests.length === 1 ? challengeResponse() : purchaseResponse();
      },
      confirm: async isTopUp => {
        assert.equal(isTopUp, false);
        return true;
      },
      createPaymentPayload: async () => ({ x402Version: 2, payload: { signature: "mock" } }),
      persist: value => {
        persisted = value;
      },
    },
  );

  assert.equal(key, CREDIT_KEY);
  assert.equal(persisted, CREDIT_KEY);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].params.arguments.credits, 2000);
  assert.equal(requests[0].params.arguments.payer, PAYER);
  assert.deepEqual(
    requests[1].params._meta["x402/payment"],
    { x402Version: 2, payload: { signature: "mock" } },
  );
});

test("declined purchase never creates or submits a payment payload", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "builtwith-x402-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const envPath = path.join(directory, ".env");
  fs.writeFileSync(envPath, "");
  let posts = 0;
  let payloadCreated = false;

  await assert.rejects(
    purchaseCredits(
      { address: PAYER },
      "",
      {
        envPath,
        postMcp: async () => {
          posts += 1;
          return challengeResponse();
        },
        confirm: async () => false,
        createPaymentPayload: async () => {
          payloadCreated = true;
          return {};
        },
      },
    ),
    /Purchase cancelled/,
  );

  assert.equal(posts, 1);
  assert.equal(payloadCreated, false);
});

test("top-up reuses the existing key and identifies the confirmation as a top-up", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "builtwith-x402-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const envPath = path.join(directory, ".env");
  fs.writeFileSync(envPath, "");
  const requests = [];

  const key = await purchaseCredits(
    { address: PAYER },
    CREDIT_KEY,
    {
      envPath,
      postMcp: async request => {
        requests.push(request);
        return requests.length === 1 ? challengeResponse() : purchaseResponse(CREDIT_KEY);
      },
      confirm: async isTopUp => {
        assert.equal(isTopUp, true);
        return true;
      },
      createPaymentPayload: async () => ({ x402Version: 2, payload: { signature: "mock" } }),
      persist: () => {},
    },
  );

  assert.equal(key, CREDIT_KEY);
  assert.equal(requests[0].params.arguments.creditKey, CREDIT_KEY);
  assert.equal(requests[1].params.arguments.creditKey, CREDIT_KEY);
});

test("a valid positive balance reuses the stored key without loading a wallet", async () => {
  let accountLoaded = false;
  const postMcp = async request => {
    assert.equal(request.params.name, "x402-credit-balance");
    return mcpResponse({
      jsonrpc: "2.0",
      id: 1,
      result: {
        structuredContent: {
          payer: PAYER,
          purchasedCredits: 2000,
          usedCredits: 1,
          pendingCredits: 0,
          availableCredits: 1999,
          creditsExpire: false,
        },
      },
    });
  };

  const key = await ensureCreditKey(
    CREDIT_KEY,
    () => {
      accountLoaded = true;
      throw new Error("wallet should not be loaded");
    },
    { postMcp },
  );

  assert.equal(key, CREDIT_KEY);
  assert.equal(accountLoaded, false);
});

test("invalid balance responses are recognized without purchasing", async () => {
  const balance = await getCreditBalance(
    CREDIT_KEY,
    async () =>
      mcpResponse({
        jsonrpc: "2.0",
        id: 1,
        result: {
          content: [{ type: "text", text: JSON.stringify({ error: "Invalid or revoked prepaid credit key." }) }],
          isError: true,
        },
      }),
  );
  assert.deepEqual(balance, { valid: false });
});

test("lookup sends the stored key and returns remaining-credit metadata", async () => {
  let request;
  const result = await performLookup(
    "example.com",
    CREDIT_KEY,
    async value => {
      request = value;
      return mcpResponse({
        jsonrpc: "2.0",
        id: 1,
        result: {
          structuredContent: { domain: "example.com", technologies: [] },
          _meta: { builtwithCredits: { charged: 1, available: 1999 } },
        },
      });
    },
  );

  assert.equal(request.params.name, "x402-domain-lookup");
  assert.deepEqual(request.params.arguments, {
    domain: "example.com",
    liveOnly: true,
    creditKey: CREDIT_KEY,
  });
  assert.deepEqual(result, { domain: "example.com", technologies: [] });
});
