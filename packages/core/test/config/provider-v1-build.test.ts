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
})
