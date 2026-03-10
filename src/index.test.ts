import { describe, it, expect, vi, beforeEach } from "vitest";
import { GenClient, GenApiError } from "./index.js";

function mockFetch(
  status: number,
  body: unknown,
  headers?: Record<string, string>
): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Headers(headers),
  }) as unknown as typeof globalThis.fetch;
}

describe("GenClient", () => {
  describe("constructor", () => {
    it("should throw if apiKey is empty", () => {
      expect(() => new GenClient({ apiKey: "" })).toThrow("apiKey is required");
    });

    it("should use default base URL", () => {
      const fetchFn = mockFetch(200, { id: 1 });
      const client = new GenClient({ apiKey: "test-key", fetch: fetchFn });
      client.getMe();
      expect(fetchFn).toHaveBeenCalledWith(
        "https://api.gen.pro/v1/me",
        expect.any(Object)
      );
    });

    it("should accept custom base URL and strip trailing slash", () => {
      const fetchFn = mockFetch(200, { id: 1 });
      const client = new GenClient({
        apiKey: "test-key",
        baseUrl: "https://custom.api.com/v2/",
        fetch: fetchFn,
      });
      client.getMe();
      expect(fetchFn).toHaveBeenCalledWith(
        "https://custom.api.com/v2/me",
        expect.any(Object)
      );
    });
  });

  describe("authentication", () => {
    it("should send X-API-Key header", async () => {
      const fetchFn = mockFetch(200, { id: 1 });
      const client = new GenClient({ apiKey: "my-secret-key", fetch: fetchFn });
      await client.getMe();
      expect(fetchFn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ "X-API-Key": "my-secret-key" }),
        })
      );
    });
  });

  describe("error handling", () => {
    it("should throw GenApiError on 401", async () => {
      const fetchFn = mockFetch(401, {
        error: "Invalid API key",
        error_code: "unauthorized",
      });
      const client = new GenClient({ apiKey: "bad-key", fetch: fetchFn });
      await expect(client.getMe()).rejects.toThrow(GenApiError);
      await expect(client.getMe()).rejects.toMatchObject({
        status: 401,
        error: "Invalid API key",
        errorCode: "unauthorized",
      });
    });

    it("should throw GenApiError on 404", async () => {
      const fetchFn = mockFetch(404, {
        error: "Not found",
        error_code: "not_found",
      });
      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      await expect(client.getAgent("999")).rejects.toThrow(GenApiError);
    });

    it("should handle non-JSON error responses", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      }) as unknown as typeof globalThis.fetch;
      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      await expect(client.getMe()).rejects.toThrow(GenApiError);
    });
  });

  describe("discovery", () => {
    let client: GenClient;
    let fetchFn: ReturnType<typeof mockFetch>;

    beforeEach(() => {
      fetchFn = mockFetch(200, []);
      client = new GenClient({ apiKey: "key", fetch: fetchFn });
    });

    it("getMe should GET /me", async () => {
      const fetchFn2 = mockFetch(200, {
        id: 1,
        email: "test@example.com",
        name: "Test",
      });
      const c = new GenClient({ apiKey: "key", fetch: fetchFn2 });
      const result = await c.getMe();
      expect(result).toEqual({
        id: 1,
        email: "test@example.com",
        name: "Test",
      });
    });

    it("listWorkspaces should GET /workspaces", async () => {
      await client.listWorkspaces();
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining("/workspaces"),
        expect.objectContaining({ method: "GET" })
      );
    });

    it("listAgents should include workspace_id when provided", async () => {
      await client.listAgents("ws-123");
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining("/agents?workspace_id=ws-123"),
        expect.any(Object)
      );
    });

    it("listAgents should not include workspace_id when omitted", async () => {
      await client.listAgents();
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringMatching(/\/agents$/),
        expect.any(Object)
      );
    });
  });

  describe("agents", () => {
    it("createAgent should POST /agents with body", async () => {
      const fetchFn = mockFetch(200, { agent: { id: 1, name: "Test Agent" } });
      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      const result = await client.createAgent({
        name: "Test Agent",
        organization_id: "org-1",
      });
      expect(result.agent.name).toBe("Test Agent");
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining("/agents"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            agent: { name: "Test Agent" },
            organization_id: "org-1",
          }),
        })
      );
    });

    it("deleteAgent should DELETE /agents/:id", async () => {
      const fetchFn = mockFetch(200, {});
      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      await client.deleteAgent("42");
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining("/agents/42"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("engines", () => {
    it("createEngine should POST /autocontentengine with agent_id query and title body", async () => {
      const fetchFn = mockFetch(200, { id: 1, title: "My Engine" });
      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      await client.createEngine("agent-1", "My Engine");
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining("/autocontentengine?agent_id=agent-1"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ spreadsheet: { title: "My Engine" } }),
        })
      );
    });

    it("getEngine should GET /autocontentengine/:id with agent_id", async () => {
      const fetchFn = mockFetch(200, { id: 5 });
      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      await client.getEngine("a1", "e5");
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining("/autocontentengine/e5?agent_id=a1"),
        expect.objectContaining({ method: "GET" })
      );
    });

    it("cloneEngine should POST clone endpoint with optional target_agent_id", async () => {
      const fetchFn = mockFetch(200, { id: 6 });
      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      await client.cloneEngine("a1", "e5", "a2");
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining("/autocontentengine/e5/clone?agent_id=a1"),
        expect.objectContaining({
          body: JSON.stringify({ target_agent_id: "a2" }),
        })
      );
    });
  });

  describe("generations", () => {
    it("generateContent should POST generate endpoint with correct body", async () => {
      const fetchFn = mockFetch(200, {
        generation_id: 99,
        status: "pending",
      });
      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      const result = await client.generateContent(
        "a1",
        "e1",
        "c1",
        "text_generation",
        { model: "gemini", prompt: "Hello" }
      );
      expect(result.generation_id).toBe(99);
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining(
          "/autocontentengine/e1/cells/c1/generate?agent_id=a1"
        ),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            generation_type: "text_generation",
            data: { model: "gemini", prompt: "Hello" },
          }),
        })
      );
    });

    it("stopGeneration should POST /generations/:id/stop", async () => {
      const fetchFn = mockFetch(200, {});
      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      await client.stopGeneration("gen-42");
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining("/generations/gen-42/stop"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("waitForGeneration should resolve when status is completed", async () => {
      let callCount = 0;
      const fetchFn = vi.fn().mockImplementation(() => {
        callCount++;
        const status =
          callCount <= 2 ? "processing" : "completed";
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            Promise.resolve(
              JSON.stringify({
                id: 1,
                status,
                result: status === "completed" ? "done" : null,
              })
            ),
        });
      }) as unknown as typeof globalThis.fetch;

      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      const result = await client.waitForGeneration("gen-1", {
        pollIntervalMs: 10,
        timeoutMs: 5000,
      });
      expect(result.status).toBe("completed");
      expect(callCount).toBe(3);
    });

    it("waitForGeneration should throw on failed generation", async () => {
      const fetchFn = mockFetch(200, { id: 1, status: "failed" });
      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      await expect(
        client.waitForGeneration("gen-1", {
          pollIntervalMs: 10,
          timeoutMs: 1000,
        })
      ).rejects.toThrow(GenApiError);
    });

    it("waitForGeneration should throw on timeout", async () => {
      const fetchFn = mockFetch(200, { id: 1, status: "processing" });
      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      await expect(
        client.waitForGeneration("gen-1", {
          pollIntervalMs: 10,
          timeoutMs: 50,
        })
      ).rejects.toThrow("timed out");
    });
  });

  describe("content resources", () => {
    it("listContentResources should build query params correctly", async () => {
      const fetchFn = mockFetch(200, []);
      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      await client.listContentResources("a1", {
        type: "video",
        page: 2,
      });
      const url = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toContain("agent_id=a1");
      expect(url).toContain("type=video");
      expect(url).toContain("page=2");
    });

    it("deleteContentResource should DELETE /content_resources/:id", async () => {
      const fetchFn = mockFetch(200, {});
      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      await client.deleteContentResource("a1", "r42");
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining("/content_resources/r42?agent_id=a1"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("cells", () => {
    it("updateCell should PATCH with spreadsheet_cell body", async () => {
      const fetchFn = mockFetch(200, { id: 1, value: "new" });
      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      await client.updateCell("a1", "e1", "c1", "new value");
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining("/autocontentengine/e1/cells/c1?agent_id=a1"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ spreadsheet_cell: { value: "new value" } }),
        })
      );
    });
  });

  describe("layers", () => {
    it("createLayer should POST with video_layer body", async () => {
      const fetchFn = mockFetch(200, { id: 1, name: "overlay", type: "text" });
      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      await client.createLayer("a1", "e1", "c1", {
        name: "overlay",
        type: "text",
        position: 0,
      });
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining(
          "/autocontentengine/e1/cells/c1/layers?agent_id=a1"
        ),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            video_layer: { name: "overlay", type: "text", position: 0 },
          }),
        })
      );
    });

    it("deleteLayer should DELETE layer endpoint", async () => {
      const fetchFn = mockFetch(200, {});
      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      await client.deleteLayer("a1", "e1", "c1", "l1");
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining(
          "/autocontentengine/e1/cells/c1/layers/l1?agent_id=a1"
        ),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("organizations", () => {
    it("createOrganization should POST with name", async () => {
      const fetchFn = mockFetch(200, { organization_id: 1 });
      const client = new GenClient({ apiKey: "key", fetch: fetchFn });
      const result = await client.createOrganization("My Org");
      expect(result.organization_id).toBe(1);
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining("/organizations"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ organization: { name: "My Org" } }),
        })
      );
    });
  });
});
