# @poweredbygen/autocontentengine-sdk

TypeScript SDK for the GEN Auto Content Engine API.

## Installation

```bash
npm install @poweredbygen/autocontentengine-sdk
```

## Quick Start

```ts
import { GenClient } from "@poweredbygen/autocontentengine-sdk";

const client = new GenClient({
  apiKey: "ref_your_api_key_here",
});

// Get your profile
const me = await client.getMe();
console.log(me.name);

// List your agents
const agents = await client.listAgents();

// Create an engine
const engine = await client.createEngine(agents[0].id, "My Content Engine");

// Add a row
const row = await client.createRow(agents[0].id, engine.id);

// Generate text content
const gen = await client.generateContent(
  agents[0].id,
  engine.id,
  row.cells![0].id,
  "text_generation",
  { model: "gemini", prompt: "Write a 30-second script about AI" }
);

// Wait for generation to complete (polls every 2s, 5 min timeout)
const result = await client.waitForGeneration(gen.generation_id);
console.log(result.result);
```

## Configuration

```ts
const client = new GenClient({
  apiKey: "ref_...",                         // Required
  baseUrl: "https://api.gen.pro/v1",        // Optional (this is the default)
});
```

## API Methods

### Discovery

| Method | Description |
|--------|-------------|
| `getMe()` | Get authenticated user profile |
| `listWorkspaces()` | List all workspaces |
| `listAgents(workspaceId?)` | List agents, optionally by workspace |

### Agents

| Method | Description |
|--------|-------------|
| `createAgent(params)` | Create a new agent |
| `getAgent(agentId)` | Get agent details |
| `updateAgent(agentId, params)` | Update an agent |
| `deleteAgent(agentId)` | Soft-delete an agent |

### Organizations

| Method | Description |
|--------|-------------|
| `listOrganizations()` | List all organizations |
| `createOrganization(name)` | Create an organization |
| `getOrganization(orgId)` | Get organization details |
| `updateOrganization(orgId, params)` | Update an organization |
| `deleteOrganization(orgId)` | Delete an organization (irreversible) |

### Engines

| Method | Description |
|--------|-------------|
| `createEngine(agentId, title)` | Create a new content engine |
| `getEngine(agentId, engineId)` | Get engine with all data |
| `cloneEngine(agentId, engineId, targetAgentId?)` | Clone an engine |

### Rows

| Method | Description |
|--------|-------------|
| `listRows(agentId, engineId)` | List all rows |
| `createRow(agentId, engineId)` | Create a new row |
| `duplicateRow(agentId, engineId, rowId)` | Duplicate a row |

### Columns

| Method | Description |
|--------|-------------|
| `listColumns(agentId, engineId)` | List all columns |
| `createColumn(agentId, engineId, params)` | Create a new column |

### Cells

| Method | Description |
|--------|-------------|
| `getCell(agentId, engineId, cellId)` | Get cell value and metadata |
| `updateCell(agentId, engineId, cellId, value)` | Update cell value |

### Layers

| Method | Description |
|--------|-------------|
| `createLayer(agentId, engineId, cellId, params)` | Create a video layer |
| `deleteLayer(agentId, engineId, cellId, layerId)` | Delete a layer |

### Generations

| Method | Description |
|--------|-------------|
| `generateContent(agentId, engineId, cellId, generationType, data?)` | Start AI generation |
| `generateLayer(agentId, engineId, cellId, layerId)` | Generate a layer |
| `getGeneration(generationId)` | Check generation status |
| `stopGeneration(generationId)` | Stop and refund a generation |
| `waitForGeneration(generationId, options?)` | Poll until complete |

### Content Resources

| Method | Description |
|--------|-------------|
| `listContentResources(agentId, params?)` | List files |
| `getContentResource(agentId, resourceId)` | Get file details |
| `deleteContentResource(agentId, resourceId)` | Delete a file |

## Generation Types

| Type | `generationType` value | Key `data` fields |
|------|----------------------|-------------------|
| Text | `text_generation` | `model`, `prompt` |
| Image | `gemini_image_generation` | `prompt`, `model`, `aspect_ratio` |
| Image (Midjourney) | `midjourney` | `prompt` |
| Video (Veo) | `gemini_video_generation` | `prompt`, `model`, `duration` |
| Video (Sora) | `sora2_video_generation` | `prompt`, `duration` |
| Video (Kling) | `kling` | `prompt`, `model`, `duration` |
| Video (Seedance) | `seedance_video_generation` | `prompt`, `model` |
| Speech | `eleven_labs` | `voice_id`, `script` |
| Lipsync | `lipsync` | `model`, `video_content_resource_id`, `audio_content_resource_id` |
| Captions | `captions` | `audio_content_resource_id` |

## Error Handling

```ts
import { GenClient, GenApiError } from "@poweredbygen/autocontentengine-sdk";

try {
  await client.getAgent("nonexistent");
} catch (err) {
  if (err instanceof GenApiError) {
    console.log(err.status);    // 404
    console.log(err.error);     // "Not found"
    console.log(err.errorCode); // "not_found"
  }
}
```

## License

MIT
