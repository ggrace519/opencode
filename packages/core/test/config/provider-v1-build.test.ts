import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { ConfigProviderV1 } from "@opencode-ai/core/v1/config/provider"

describe("ConfigProviderV1.buildOpenAICompatible", () => {
  test("emits exactly npm, name, options.baseURL, and models", () => {
    const info = ConfigProviderV1.buildOpenAICompatible({
      name: "My Provider",
      baseURL: "https://api.example.com/v1",
      modelIDs: ["model-a", "model-b"],
    })

    expect(info).toEqual({
      npm: "@ai-sdk/openai-compatible",
      name: "My Provider",
      options: { baseURL: "https://api.example.com/v1" },
      models: {
        "model-a": { name: "model-a" },
        "model-b": { name: "model-b" },
      },
    })
  })

  test("never writes the api key or provider-level api url into config", () => {
    const info = ConfigProviderV1.buildOpenAICompatible({
      name: "Secure",
      baseURL: "https://api.example.com/v1",
      modelIDs: ["m"],
    })

    expect(info.options).not.toHaveProperty("apiKey")
    expect(info).not.toHaveProperty("api")
    // No secret should appear anywhere in the serialized block.
    expect(JSON.stringify(info)).not.toContain("apiKey")
  })

  test("handles a single model", () => {
    const info = ConfigProviderV1.buildOpenAICompatible({
      name: "Solo",
      baseURL: "https://host/v1",
      modelIDs: ["only"],
    })
    expect(Object.keys(info.models ?? {})).toEqual(["only"])
  })

  test("produces an object that validates against the ConfigProviderV1.Info schema", () => {
    const info = ConfigProviderV1.buildOpenAICompatible({
      name: "Valid",
      baseURL: "https://host/v1",
      modelIDs: ["a"],
    })
    // Round-trips through the canonical schema without error.
    expect(() => Schema.decodeUnknownSync(ConfigProviderV1.Info)(info)).not.toThrow()
  })

  test("a model id of __proto__ becomes an own property, not a prototype write", () => {
    const info = ConfigProviderV1.buildOpenAICompatible({
      name: "Proto",
      baseURL: "https://host/v1",
      modelIDs: ["__proto__", "real"],
    })
    expect(Object.keys(info.models ?? {}).sort()).toEqual(["__proto__", "real"])
    expect(info.models?.["__proto__"]).toEqual({ name: "__proto__" })
    // And it still serializes/round-trips as data.
    expect(() => Schema.decodeUnknownSync(ConfigProviderV1.Info)(JSON.parse(JSON.stringify(info)))).not.toThrow()
  })
})

describe("ConfigProviderV1.normalizeProviderID", () => {
  test("accepts valid ids and strips @ai-sdk/ and whitespace", () => {
    expect(ConfigProviderV1.normalizeProviderID("  myco ")).toBe("myco")
    expect(ConfigProviderV1.normalizeProviderID("@ai-sdk/openai-compatible")).toBe("openai-compatible")
    expect(ConfigProviderV1.normalizeProviderID("a1_b-c")).toBe("a1_b-c")
  })

  test("rejects ids that would break provider/model splitting or lookup", () => {
    for (const bad of ["acme/proxy", "Acme", "has space", "-leading", "", "dot.id", "up/DOWN"]) {
      expect(ConfigProviderV1.normalizeProviderID(bad)).toBeUndefined()
    }
  })
})

describe("ConfigProviderV1.normalizeBaseURL", () => {
  test("accepts and trims http(s) URLs", () => {
    expect(ConfigProviderV1.normalizeBaseURL("https://api.example.com/v1")).toBe("https://api.example.com/v1")
    expect(ConfigProviderV1.normalizeBaseURL("  http://localhost:8080/v1  ")).toBe("http://localhost:8080/v1")
  })

  test("rejects non-http(s) and malformed URLs", () => {
    for (const bad of ["", "ftp://host/v1", "not a url", "file:///etc/passwd"]) {
      expect(ConfigProviderV1.normalizeBaseURL(bad)).toBeUndefined()
    }
  })

  test("rejects URLs that embed a secret (userinfo or query), to keep secrets out of config", () => {
    expect(ConfigProviderV1.normalizeBaseURL("https://user:sk-123@host/v1")).toBeUndefined()
    expect(ConfigProviderV1.normalizeBaseURL("https://host/v1?api_key=sk-123")).toBeUndefined()
    expect(ConfigProviderV1.normalizeBaseURL("https://host/v1?token=abc")).toBeUndefined()
    // A benign query param is allowed.
    expect(ConfigProviderV1.normalizeBaseURL("https://host/v1?region=us")).toBe("https://host/v1?region=us")
  })
})

describe("ConfigProviderV1.parseModelIDs", () => {
  test("splits, trims, drops empties, de-dupes", () => {
    expect(ConfigProviderV1.parseModelIDs(" a , b ,, a ,c ")).toEqual(["a", "b", "c"])
    expect(ConfigProviderV1.parseModelIDs("")).toEqual([])
    expect(ConfigProviderV1.parseModelIDs(" , , ")).toEqual([])
  })
})
