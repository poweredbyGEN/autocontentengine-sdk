// ── Types ────────────────────────────────────────────────────────────────────

/** Configuration options for the GenClient. */
export interface GenClientOptions {
  /** API key for authentication (sent as X-API-Key header). */
  apiKey: string;
  /** Base URL for the API. Defaults to "https://api.gen.pro/v1". */
  baseUrl?: string;
  /** Optional custom fetch implementation. Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
}

/** Error response from the GEN API. */
export class GenApiError extends Error {
  /** HTTP status code. */
  public readonly status: number;
  /** Human-readable error message from the API. */
  public readonly error: string;
  /** Machine-readable error code from the API. */
  public readonly errorCode: string;

  constructor(status: number, error: string, errorCode: string) {
    super(`GEN API Error ${status}: [${errorCode}] ${error}`);
    this.name = "GenApiError";
    this.status = status;
    this.error = error;
    this.errorCode = errorCode;
  }
}

/** Options for waitForGeneration polling. */
export interface WaitForGenerationOptions {
  /** Polling interval in milliseconds. Defaults to 2000. */
  pollIntervalMs?: number;
  /** Maximum time to wait in milliseconds. Defaults to 300000 (5 minutes). */
  timeoutMs?: number;
}

// ── Response types ───────────────────────────────────────────────────────────

export interface User {
  id: number | string;
  email: string;
  name: string;
  username: string;
  created_at: string;
}

export interface Workspace {
  id: number | string;
  name: string;
}

export interface Agent {
  id: number | string;
  name: string;
  description?: string;
  organization_id?: number | string;
  time_zone?: string;
  primary_avatar_id?: number | string;
  primary_avatar_url?: string;
  role?: string;
  default_user_voice?: UserVoice;
}

export interface UserVoice {
  id: number | string;
  name: string;
  gender: string;
  language: string;
  provider: string;
  url: string;
}

export interface Organization {
  id: number | string;
  uuid?: string;
  organization_id: number | string;
  name: string;
  avatar?: { url: string; thumbnail_url: string };
  user_role: string;
  credit: number;
  available_credit?: { generic: number; aura: number };
  total_members: number;
  credit_plan?: { id: number | string; name: string; cycle: string };
}

export interface Engine {
  id: number | string;
  title?: string;
  columns?: Column[];
  rows?: Row[];
  [key: string]: unknown;
}

export interface Row {
  id: number | string;
  position?: number;
  cells?: Cell[];
  [key: string]: unknown;
}

export interface Column {
  id: number | string;
  title: string;
  type?: string;
  position?: number;
  [key: string]: unknown;
}

export interface Cell {
  id: number | string;
  value?: string;
  [key: string]: unknown;
}

export interface Layer {
  id: number | string;
  name: string;
  type: string;
  position?: number;
  [key: string]: unknown;
}

export interface GenerationResult {
  generation_id: number | string;
  status: string;
}

export interface Generation {
  id: number | string;
  status: "pending" | "processing" | "completed" | "failed" | "stopped";
  user_job_type?: string;
  result?: string;
  output_resources?: OutputResource[];
  [key: string]: unknown;
}

export interface OutputResource {
  id: number | string;
  url: string;
  thumbnail_url?: string;
  object_type?: string;
}

export interface ContentResource {
  id: number | string;
  url: string;
  thumbnail_url?: string;
  file_name: string;
  content_type: string;
}

export interface ContentResourceDetail {
  content_resource: ContentResource;
  project_node?: { id: number | string };
  generator?: { id: number | string; status: string; type: string } | null;
}

// ── Parameter types ──────────────────────────────────────────────────────────

export interface CreateAgentParams {
  name: string;
  description?: string;
  time_zone?: string;
  organization_id?: string | number;
  eleven_lab_api_key?: string;
  hume_ai_api_key?: string;
}

export interface UpdateAgentParams {
  name?: string;
  description?: string;
  time_zone?: string;
  eleven_lab_api_key?: string;
  hume_ai_api_key?: string;
}

export interface UpdateOrganizationParams {
  name?: string;
}

export interface CreateColumnParams {
  title: string;
  type: string;
  position?: number;
}

export interface CreateLayerParams {
  name: string;
  type: string;
  position?: number;
}

export interface ListContentResourcesParams {
  type?: "image" | "video" | "audio" | "zip" | "safe_tensors";
  project_id?: string;
  page?: number;
}

// ── Client ───────────────────────────────────────────────────────────────────

/**
 * Client for the GEN Auto Content Engine API.
 *
 * @example
 * ```ts
 * import { GenClient } from "@poweredbygen/autocontentengine-sdk";
 *
 * const client = new GenClient({ apiKey: "ref_your_token_here" });
 * const me = await client.getMe();
 * console.log(me);
 * ```
 */
export class GenClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly _fetch: typeof globalThis.fetch;

  constructor(options: GenClientOptions) {
    if (!options.apiKey) {
      throw new Error("apiKey is required");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.gen.pro/v1").replace(
      /\/$/,
      ""
    );
    this._fetch = options.fetch ?? globalThis.fetch;
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
      "Content-Type": "application/json",
    };

    const res = await this._fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!res.ok) {
      const errObj = data as Record<string, string> | undefined;
      const error =
        (errObj && typeof errObj === "object" && errObj.error) ||
        `HTTP ${res.status}`;
      const errorCode =
        (errObj && typeof errObj === "object" && errObj.error_code) ||
        "unknown_error";
      throw new GenApiError(res.status, error, errorCode);
    }

    return data as T;
  }

  private buildAgentQuery(agentId: string | number): string {
    return `?agent_id=${encodeURIComponent(String(agentId))}`;
  }

  // ── Discovery ────────────────────────────────────────────────────────────

  /**
   * Get the authenticated user's profile.
   * @returns The current user's profile information.
   */
  async getMe(): Promise<User> {
    return this.request<User>("GET", "/me");
  }

  /**
   * List all workspaces the authenticated user has access to.
   * @returns Array of workspaces.
   */
  async listWorkspaces(): Promise<Workspace[]> {
    return this.request<Workspace[]>("GET", "/workspaces");
  }

  /**
   * List agents, optionally filtered by workspace.
   * @param workspaceId - Optional workspace ID to filter agents.
   * @returns Array of agents.
   */
  async listAgents(workspaceId?: string | number): Promise<Agent[]> {
    const params = workspaceId
      ? `?workspace_id=${encodeURIComponent(String(workspaceId))}`
      : "";
    return this.request<Agent[]>("GET", `/agents${params}`);
  }

  // ── Agents ───────────────────────────────────────────────────────────────

  /**
   * Create a new agent.
   * @param params - Agent creation parameters (name required).
   * @returns The created agent.
   */
  async createAgent(params: CreateAgentParams): Promise<{ agent: Agent }> {
    const { organization_id, ...agentFields } = params;
    const body: Record<string, unknown> = { agent: agentFields };
    if (organization_id !== undefined) body.organization_id = organization_id;
    return this.request<{ agent: Agent }>("POST", "/agents", body);
  }

  /**
   * Get full details of a specific agent.
   * @param agentId - The agent ID.
   * @returns The agent details.
   */
  async getAgent(agentId: string | number): Promise<Agent> {
    return this.request<Agent>(
      "GET",
      `/agents/${encodeURIComponent(String(agentId))}`
    );
  }

  /**
   * Update an existing agent.
   * @param agentId - The agent ID to update.
   * @param params - Fields to update.
   * @returns The updated agent.
   */
  async updateAgent(
    agentId: string | number,
    params: UpdateAgentParams
  ): Promise<{ agent: Agent }> {
    return this.request<{ agent: Agent }>(
      "PATCH",
      `/agents/${encodeURIComponent(String(agentId))}`,
      { agent: params }
    );
  }

  /**
   * Delete an agent (soft-delete).
   * @param agentId - The agent ID to delete.
   */
  async deleteAgent(agentId: string | number): Promise<void> {
    await this.request<unknown>(
      "DELETE",
      `/agents/${encodeURIComponent(String(agentId))}`
    );
  }

  // ── Organizations ────────────────────────────────────────────────────────

  /**
   * List all organizations the authenticated user is a member of.
   * @returns Array of organizations with credits, role, and plan info.
   */
  async listOrganizations(): Promise<Organization[]> {
    return this.request<Organization[]>("GET", "/organizations");
  }

  /**
   * Create a new organization.
   * @param name - Display name for the organization.
   * @returns The created organization with its ID.
   */
  async createOrganization(
    name: string
  ): Promise<{ organization_id: number | string }> {
    return this.request<{ organization_id: number | string }>(
      "POST",
      "/organizations",
      { organization: { name } }
    );
  }

  /**
   * Get details of a specific organization.
   * @param orgId - The organization ID.
   * @returns The organization details.
   */
  async getOrganization(orgId: string | number): Promise<Organization> {
    return this.request<Organization>(
      "GET",
      `/organizations/${encodeURIComponent(String(orgId))}`
    );
  }

  /**
   * Update an organization (requires owner or manager role).
   * @param orgId - The organization ID to update.
   * @param params - Fields to update.
   * @returns The updated organization ID.
   */
  async updateOrganization(
    orgId: string | number,
    params: UpdateOrganizationParams
  ): Promise<{ organization_id: number | string }> {
    return this.request<{ organization_id: number | string }>(
      "PATCH",
      `/organizations/${encodeURIComponent(String(orgId))}`,
      { organization: params }
    );
  }

  /**
   * Permanently delete an organization and all associated data.
   * Requires owner role. This action is irreversible.
   * @param orgId - The organization ID to delete.
   */
  async deleteOrganization(orgId: string | number): Promise<void> {
    await this.request<unknown>(
      "DELETE",
      `/organizations/${encodeURIComponent(String(orgId))}`
    );
  }

  // ── Engines ──────────────────────────────────────────────────────────────

  /**
   * Create a new Auto Content Engine for an agent.
   * @param agentId - The agent ID to create the engine for.
   * @param title - Title for the new engine.
   * @returns The created engine with columns, rows, and cells.
   */
  async createEngine(
    agentId: string | number,
    title: string
  ): Promise<Engine> {
    return this.request<Engine>(
      "POST",
      `/autocontentengine${this.buildAgentQuery(agentId)}`,
      { spreadsheet: { title } }
    );
  }

  /**
   * Get details of a specific Auto Content Engine.
   * @param agentId - The agent ID that owns the engine.
   * @param engineId - The engine ID to retrieve.
   * @returns The engine with all nested data.
   */
  async getEngine(
    agentId: string | number,
    engineId: string | number
  ): Promise<Engine> {
    return this.request<Engine>(
      "GET",
      `/autocontentengine/${encodeURIComponent(String(engineId))}${this.buildAgentQuery(agentId)}`
    );
  }

  /**
   * Clone an existing engine, optionally to a different agent.
   * @param agentId - The agent ID that owns the source engine.
   * @param engineId - The engine ID to clone.
   * @param targetAgentId - Optional target agent ID (defaults to same agent).
   * @returns The cloned engine.
   */
  async cloneEngine(
    agentId: string | number,
    engineId: string | number,
    targetAgentId?: string | number
  ): Promise<Engine> {
    const body: Record<string, unknown> = {};
    if (targetAgentId !== undefined)
      body.target_agent_id = targetAgentId;
    return this.request<Engine>(
      "POST",
      `/autocontentengine/${encodeURIComponent(String(engineId))}/clone${this.buildAgentQuery(agentId)}`,
      body
    );
  }

  // ── Rows ─────────────────────────────────────────────────────────────────

  /**
   * List all rows in an Auto Content Engine.
   * @param agentId - The agent ID that owns the engine.
   * @param engineId - The engine ID.
   * @returns Array of rows.
   */
  async listRows(
    agentId: string | number,
    engineId: string | number
  ): Promise<Row[]> {
    return this.request<Row[]>(
      "GET",
      `/autocontentengine/${encodeURIComponent(String(engineId))}/rows${this.buildAgentQuery(agentId)}`
    );
  }

  /**
   * Create a new row in an Auto Content Engine.
   * @param agentId - The agent ID that owns the engine.
   * @param engineId - The engine ID.
   * @returns The created row.
   */
  async createRow(
    agentId: string | number,
    engineId: string | number
  ): Promise<Row> {
    return this.request<Row>(
      "POST",
      `/autocontentengine/${encodeURIComponent(String(engineId))}/rows${this.buildAgentQuery(agentId)}`,
      {}
    );
  }

  /**
   * Duplicate an existing row in an Auto Content Engine.
   * @param agentId - The agent ID that owns the engine.
   * @param engineId - The engine ID.
   * @param rowId - The row ID to duplicate.
   * @returns The duplicated row.
   */
  async duplicateRow(
    agentId: string | number,
    engineId: string | number,
    rowId: string | number
  ): Promise<Row> {
    return this.request<Row>(
      "POST",
      `/autocontentengine/${encodeURIComponent(String(engineId))}/rows/${encodeURIComponent(String(rowId))}/duplicate${this.buildAgentQuery(agentId)}`,
      {}
    );
  }

  // ── Columns ──────────────────────────────────────────────────────────────

  /**
   * List all columns in an Auto Content Engine.
   * @param agentId - The agent ID that owns the engine.
   * @param engineId - The engine ID.
   * @returns Array of columns.
   */
  async listColumns(
    agentId: string | number,
    engineId: string | number
  ): Promise<Column[]> {
    return this.request<Column[]>(
      "GET",
      `/autocontentengine/${encodeURIComponent(String(engineId))}/columns${this.buildAgentQuery(agentId)}`
    );
  }

  /**
   * Create a new column in an Auto Content Engine.
   * @param agentId - The agent ID that owns the engine.
   * @param engineId - The engine ID.
   * @param params - Column creation parameters (title and type required).
   * @returns The created column.
   */
  async createColumn(
    agentId: string | number,
    engineId: string | number,
    params: CreateColumnParams
  ): Promise<Column> {
    return this.request<Column>(
      "POST",
      `/autocontentengine/${encodeURIComponent(String(engineId))}/columns${this.buildAgentQuery(agentId)}`,
      { spreadsheet_column: params }
    );
  }

  // ── Cells ────────────────────────────────────────────────────────────────

  /**
   * Get the value and metadata of a specific cell.
   * @param agentId - The agent ID that owns the engine.
   * @param engineId - The engine ID.
   * @param cellId - The cell ID to retrieve.
   * @returns The cell data.
   */
  async getCell(
    agentId: string | number,
    engineId: string | number,
    cellId: string | number
  ): Promise<Cell> {
    return this.request<Cell>(
      "GET",
      `/autocontentengine/${encodeURIComponent(String(engineId))}/cells/${encodeURIComponent(String(cellId))}${this.buildAgentQuery(agentId)}`
    );
  }

  /**
   * Update the value of a specific cell.
   * @param agentId - The agent ID that owns the engine.
   * @param engineId - The engine ID.
   * @param cellId - The cell ID to update.
   * @param value - The new cell value.
   * @returns The updated cell.
   */
  async updateCell(
    agentId: string | number,
    engineId: string | number,
    cellId: string | number,
    value: string
  ): Promise<Cell> {
    return this.request<Cell>(
      "PATCH",
      `/autocontentengine/${encodeURIComponent(String(engineId))}/cells/${encodeURIComponent(String(cellId))}${this.buildAgentQuery(agentId)}`,
      { spreadsheet_cell: { value } }
    );
  }

  // ── Layers ───────────────────────────────────────────────────────────────

  /**
   * Create a new layer in a cell.
   * @param agentId - The agent ID that owns the engine.
   * @param engineId - The engine ID.
   * @param cellId - The cell ID to add the layer to.
   * @param params - Layer creation parameters (name and type required).
   * @returns The created layer.
   */
  async createLayer(
    agentId: string | number,
    engineId: string | number,
    cellId: string | number,
    params: CreateLayerParams
  ): Promise<Layer> {
    return this.request<Layer>(
      "POST",
      `/autocontentengine/${encodeURIComponent(String(engineId))}/cells/${encodeURIComponent(String(cellId))}/layers${this.buildAgentQuery(agentId)}`,
      { video_layer: params }
    );
  }

  /**
   * Delete a layer from a cell.
   * @param agentId - The agent ID that owns the engine.
   * @param engineId - The engine ID.
   * @param cellId - The cell ID.
   * @param layerId - The layer ID to delete.
   */
  async deleteLayer(
    agentId: string | number,
    engineId: string | number,
    cellId: string | number,
    layerId: string | number
  ): Promise<void> {
    await this.request<unknown>(
      "DELETE",
      `/autocontentengine/${encodeURIComponent(String(engineId))}/cells/${encodeURIComponent(String(cellId))}/layers/${encodeURIComponent(String(layerId))}${this.buildAgentQuery(agentId)}`
    );
  }

  // ── Generations ──────────────────────────────────────────────────────────

  /**
   * Trigger AI content generation for a cell.
   *
   * Returns a generation_id. Poll with {@link getGeneration} or use
   * {@link waitForGeneration} until status is "completed".
   *
   * @param agentId - The agent ID that owns the engine.
   * @param engineId - The engine ID.
   * @param cellId - The cell ID to generate content for.
   * @param generationType - The type of generation (e.g. "text_generation", "gemini_image_generation", "gemini_video_generation", etc.).
   * @param data - Optional generation-specific parameters (prompt, model, aspect_ratio, duration, voice_id, etc.).
   * @returns Object with generation_id and status.
   */
  async generateContent(
    agentId: string | number,
    engineId: string | number,
    cellId: string | number,
    generationType: string,
    data?: Record<string, unknown>
  ): Promise<GenerationResult> {
    const body: Record<string, unknown> = { generation_type: generationType };
    if (data) body.data = data;
    return this.request<GenerationResult>(
      "POST",
      `/autocontentengine/${encodeURIComponent(String(engineId))}/cells/${encodeURIComponent(String(cellId))}/generate${this.buildAgentQuery(agentId)}`,
      body
    );
  }

  /**
   * Trigger generation for a specific layer within a cell.
   * @param agentId - The agent ID that owns the engine.
   * @param engineId - The engine ID.
   * @param cellId - The cell ID.
   * @param layerId - The layer ID to generate.
   * @returns Object with generation_id and status.
   */
  async generateLayer(
    agentId: string | number,
    engineId: string | number,
    cellId: string | number,
    layerId: string | number
  ): Promise<GenerationResult> {
    return this.request<GenerationResult>(
      "POST",
      `/autocontentengine/${encodeURIComponent(String(engineId))}/cells/${encodeURIComponent(String(cellId))}/layers/${encodeURIComponent(String(layerId))}/generate${this.buildAgentQuery(agentId)}`,
      {}
    );
  }

  /**
   * Get the status and result of a generation job.
   *
   * Status flow: pending -> processing -> completed | failed | stopped.
   * On completion: text results in `result` field, media URLs in `output_resources`.
   *
   * @param generationId - The generation ID to check.
   * @returns The generation object with status and results.
   */
  async getGeneration(generationId: string | number): Promise<Generation> {
    return this.request<Generation>(
      "GET",
      `/generations/${encodeURIComponent(String(generationId))}`
    );
  }

  /**
   * Stop a running generation job. Credits are refunded.
   * @param generationId - The generation ID to stop.
   */
  async stopGeneration(generationId: string | number): Promise<void> {
    await this.request<unknown>(
      "POST",
      `/generations/${encodeURIComponent(String(generationId))}/stop`
    );
  }

  /**
   * Poll a generation until it completes, fails, or times out.
   *
   * @param generationId - The generation ID to wait for.
   * @param options - Polling interval and timeout configuration.
   * @returns The completed generation object.
   * @throws {GenApiError} If the generation fails.
   * @throws {Error} If the timeout is exceeded.
   */
  async waitForGeneration(
    generationId: string | number,
    options?: WaitForGenerationOptions
  ): Promise<Generation> {
    const pollInterval = options?.pollIntervalMs ?? 2000;
    const timeout = options?.timeoutMs ?? 300_000;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const gen = await this.getGeneration(generationId);

      if (gen.status === "completed") {
        return gen;
      }
      if (gen.status === "failed") {
        throw new GenApiError(
          422,
          `Generation ${generationId} failed`,
          "generation_failed"
        );
      }
      if (gen.status === "stopped") {
        throw new GenApiError(
          422,
          `Generation ${generationId} was stopped`,
          "generation_stopped"
        );
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(
      `Generation ${generationId} timed out after ${timeout}ms`
    );
  }

  // ── Content Resources ────────────────────────────────────────────────────

  /**
   * List content resources (files) belonging to an agent.
   * @param agentId - The agent whose resources to list.
   * @param params - Optional filters for type, project, and pagination.
   * @returns Array of content resources.
   */
  async listContentResources(
    agentId: string | number,
    params?: ListContentResourcesParams
  ): Promise<ContentResource[]> {
    const query = new URLSearchParams({
      agent_id: String(agentId),
    });
    if (params?.type) query.set("type", params.type);
    if (params?.project_id) query.set("project_id", params.project_id);
    if (params?.page !== undefined) query.set("page", String(params.page));
    return this.request<ContentResource[]>(
      "GET",
      `/content_resources?${query.toString()}`
    );
  }

  /**
   * Get full details of a content resource.
   * @param agentId - The agent that owns the resource.
   * @param resourceId - The content resource ID.
   * @returns The content resource with project node and generator info.
   */
  async getContentResource(
    agentId: string | number,
    resourceId: string | number
  ): Promise<ContentResourceDetail> {
    return this.request<ContentResourceDetail>(
      "GET",
      `/content_resources/${encodeURIComponent(String(resourceId))}${this.buildAgentQuery(agentId)}`
    );
  }

  /**
   * Permanently delete a content resource and its associated file.
   * @param agentId - The agent that owns the resource.
   * @param resourceId - The content resource ID to delete.
   */
  async deleteContentResource(
    agentId: string | number,
    resourceId: string | number
  ): Promise<void> {
    await this.request<unknown>(
      "DELETE",
      `/content_resources/${encodeURIComponent(String(resourceId))}${this.buildAgentQuery(agentId)}`
    );
  }
}
