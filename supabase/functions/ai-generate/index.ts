import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Provider = "openai" | "gemini" | "anthropic";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, provider } = body as { action: string; provider?: Provider };
    const targetProvider: Provider = provider ?? "openai";

    if (targetProvider === "gemini") {
      return await handleGeminiRequest(action, body);
    }

    if (targetProvider === "anthropic") {
      return await handleAnthropicRequest(action, body);
    }

    return await handleOpenAIRequest(action, body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================
// OpenAI handlers
// ============================================================

async function handleOpenAIRequest(action: string, body: Record<string, unknown>): Promise<Response> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  if (!OPENAI_API_KEY) {
    return jsonError("OpenAI API key not configured. Set OPENAI_API_KEY in edge function secrets.", 503);
  }

  switch (action) {
    case "generate_text":
      return await openaiGenerateText(body, OPENAI_API_KEY);
    case "generate_structured":
      return await openaiGenerateStructured(body, OPENAI_API_KEY);
    case "generate_stream":
      return await openaiGenerateStream(body, OPENAI_API_KEY);
    case "generate_embeddings":
      return await openaiGenerateEmbeddings(body, OPENAI_API_KEY);
    default:
      return jsonError(`Unknown action: ${action}`, 400);
  }
}

async function openaiGenerateText(body: Record<string, unknown>, apiKey: string): Promise<Response> {
  const model = body.model as string ?? "gpt-4o";
  const systemPrompt = body.system_prompt as string | undefined;
  const userPrompt = body.user_prompt as string;
  const temperature = body.temperature as number ?? 0.7;
  const maxTokens = body.max_tokens as number | undefined;
  const tools = body.tools as unknown[] | undefined;
  const images = body.images as unknown[] | undefined;

  const messages: Record<string, unknown>[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });

  const userContent = images && images.length > 0
    ? [{ type: "text", text: userPrompt }, ...images]
    : userPrompt;
  messages.push({ role: "user", content: userContent });

  const requestBody: Record<string, unknown> = { model, messages, temperature };
  if (maxTokens) requestBody.max_tokens = maxTokens;
  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = "auto";
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: "OpenAI request failed" } }));
    return jsonError(error.error?.message ?? `OpenAI error (${response.status})`, response.status);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  return jsonResponse({
    content: choice?.message?.content ?? "",
    tool_calls: choice?.message?.tool_calls,
    finish_reason: choice?.finish_reason ?? "stop",
    prompt_tokens: data.usage?.prompt_tokens ?? 0,
    completion_tokens: data.usage?.completion_tokens ?? 0,
    total_tokens: data.usage?.total_tokens ?? 0,
    model: data.model ?? model,
  });
}

async function openaiGenerateStructured(body: Record<string, unknown>, apiKey: string): Promise<Response> {
  const model = body.model as string ?? "gpt-4o";
  const systemPrompt = body.system_prompt as string | undefined;
  const userPrompt = body.user_prompt as string;
  const temperature = body.temperature as number ?? 0.3;
  const maxTokens = body.max_tokens as number | undefined;

  const messages: Record<string, unknown>[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userPrompt });

  const requestBody: Record<string, unknown> = {
    model, messages, temperature,
    response_format: { type: "json_object" },
  };
  if (maxTokens) requestBody.max_tokens = maxTokens;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: "OpenAI request failed" } }));
    return jsonError(error.error?.message ?? `OpenAI error (${response.status})`, response.status);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const rawContent = choice?.message?.content ?? "";

  let structuredData: Record<string, unknown> = {};
  try {
    structuredData = JSON.parse(rawContent);
  } catch {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { structuredData = JSON.parse(jsonMatch[0]); } catch { /* leave empty */ }
    }
  }

  return jsonResponse({
    structured_data: structuredData,
    raw: rawContent,
    prompt_tokens: data.usage?.prompt_tokens ?? 0,
    completion_tokens: data.usage?.completion_tokens ?? 0,
    model: data.model ?? model,
  });
}

async function openaiGenerateStream(body: Record<string, unknown>, apiKey: string): Promise<Response> {
  const model = body.model as string ?? "gpt-4o";
  const systemPrompt = body.system_prompt as string | undefined;
  const userPrompt = body.user_prompt as string;
  const temperature = body.temperature as number ?? 0.7;
  const maxTokens = body.max_tokens as number | undefined;

  const messages: Record<string, unknown>[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userPrompt });

  const requestBody: Record<string, unknown> = { model, messages, temperature, stream: true };
  if (maxTokens) requestBody.max_tokens = maxTokens;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok || !response.body) {
    const error = await response.json().catch(() => ({ error: { message: "Stream failed" } }));
    return jsonError(error.error?.message ?? `OpenAI stream error (${response.status})`, response.status);
  }

  const transformedStream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const encoder = new TextEncoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(transformedStream, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
}

async function openaiGenerateEmbeddings(body: Record<string, unknown>, apiKey: string): Promise<Response> {
  const model = body.model as string ?? "text-embedding-3-small";
  const input = body.input as string | string[];

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: "Embeddings failed" } }));
    return jsonError(error.error?.message ?? `OpenAI embeddings error (${response.status})`, response.status);
  }

  const data = await response.json();
  const embeddings = (data.data ?? []).map((d: { embedding: number[] }) => d.embedding);

  return jsonResponse({
    embeddings,
    prompt_tokens: data.usage?.prompt_tokens ?? 0,
    model: data.model ?? model,
  });
}

// ============================================================
// Gemini handlers
// ============================================================

async function handleGeminiRequest(action: string, body: Record<string, unknown>): Promise<Response> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  if (!GEMINI_API_KEY) {
    return jsonError("Gemini API key not configured. Set GEMINI_API_KEY in edge function secrets.", 503);
  }

  switch (action) {
    case "generate_text":
      return await geminiGenerateText(body, GEMINI_API_KEY);
    case "generate_structured":
      return await geminiGenerateStructured(body, GEMINI_API_KEY);
    case "generate_stream":
      return await geminiGenerateStream(body, GEMINI_API_KEY);
    default:
      return jsonError(`Unknown action: ${action}`, 400);
  }
}

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function geminiModelEndpoint(model: string, apiKey: string, suffix = ""): string {
  const streamSuffix = suffix ? `:${suffix}` : "";
  return `${GEMINI_BASE_URL}/models/${model}${streamSuffix}?key=${apiKey}`;
}

function buildGeminiContents(
  systemPrompt: string | undefined,
  userPrompt: string,
  images: unknown[] | undefined,
): Record<string, unknown> {
  const parts: Record<string, unknown>[] = [];

  if (images && images.length > 0) {
    for (const img of images) {
      const imageObj = img as { image_url?: { url: string } };
      if (imageObj?.image_url?.url) {
        const url = imageObj.image_url.url;
        const inlineMatch = url.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
        if (inlineMatch) {
          parts.push({ inline_data: { mime_type: inlineMatch[1], data: inlineMatch[2] } });
        }
      }
    }
  }

  parts.push({ text: userPrompt });
  return { role: "user", parts };
}

async function geminiGenerateText(body: Record<string, unknown>, apiKey: string): Promise<Response> {
  const model = body.model as string ?? "gemini-1.5-pro";
  const systemPrompt = body.system_prompt as string | undefined;
  const userPrompt = body.user_prompt as string;
  const temperature = body.temperature as number ?? 0.7;
  const maxTokens = body.max_tokens as number | undefined;
  const tools = body.tools as unknown[] | undefined;
  const images = body.images as unknown[] | undefined;

  const requestBody: Record<string, unknown> = {
    contents: [buildGeminiContents(systemPrompt, userPrompt, images)],
    generationConfig: { temperature },
  };
  if (systemPrompt) {
    requestBody.systemInstruction = { parts: [{ text: systemPrompt }] };
  }
  if (maxTokens) (requestBody.generationConfig as Record<string, unknown>).maxOutputTokens = maxTokens;
  if (tools && tools.length > 0) {
    requestBody.tools = [{
      functionDeclarations: tools.map((t) => {
        const tool = t as { function: { name: string; description: string; parameters: Record<string, unknown> } };
        return tool.function;
      }),
    }];
  }

  const response = await fetch(geminiModelEndpoint(model, apiKey, "generateContent"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: "Gemini request failed" } }));
    return jsonError(error.error?.message ?? `Gemini error (${response.status})`, response.status);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const content = candidate?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("") ?? "";
  const toolCalls = candidate?.content?.parts
    ?.filter((p: { functionCall?: unknown }) => p.functionCall)
    .map((p: { functionCall: { name: string; args: Record<string, unknown> } }, i: number) => ({
      id: `call_${i}`,
      type: "function" as const,
      function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args ?? {}) },
    }));

  return jsonResponse({
    content,
    tool_calls: toolCalls?.length ? toolCalls : undefined,
    finish_reason: candidate?.finishReason ?? "stop",
    prompt_tokens: data.usageMetadata?.promptTokenCount ?? 0,
    completion_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    total_tokens: data.usageMetadata?.totalTokenCount ?? 0,
    model,
  });
}

async function geminiGenerateStructured(body: Record<string, unknown>, apiKey: string): Promise<Response> {
  const model = body.model as string ?? "gemini-1.5-pro";
  const systemPrompt = body.system_prompt as string | undefined;
  const userPrompt = body.user_prompt as string;
  const temperature = body.temperature as number ?? 0.3;
  const maxTokens = body.max_tokens as number | undefined;
  const schema = body.schema as Record<string, unknown> | undefined;

  const generationConfig: Record<string, unknown> = { temperature };
  if (maxTokens) generationConfig.maxOutputTokens = maxTokens;
  if (schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = schema;
  }

  const requestBody: Record<string, unknown> = {
    contents: [buildGeminiContents(systemPrompt, userPrompt, undefined)],
    generationConfig,
  };
  if (systemPrompt) {
    requestBody.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const response = await fetch(geminiModelEndpoint(model, apiKey, "generateContent"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: "Gemini request failed" } }));
    return jsonError(error.error?.message ?? `Gemini error (${response.status})`, response.status);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const rawContent = candidate?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("") ?? "";

  let structuredData: Record<string, unknown> = {};
  try {
    structuredData = JSON.parse(rawContent);
  } catch {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { structuredData = JSON.parse(jsonMatch[0]); } catch { /* leave empty */ }
    }
  }

  return jsonResponse({
    structured_data: structuredData,
    raw: rawContent,
    prompt_tokens: data.usageMetadata?.promptTokenCount ?? 0,
    completion_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    model,
  });
}

async function geminiGenerateStream(body: Record<string, unknown>, apiKey: string): Promise<Response> {
  const model = body.model as string ?? "gemini-1.5-pro";
  const systemPrompt = body.system_prompt as string | undefined;
  const userPrompt = body.user_prompt as string;
  const temperature = body.temperature as number ?? 0.7;
  const maxTokens = body.max_tokens as number | undefined;

  const generationConfig: Record<string, unknown> = { temperature };
  if (maxTokens) generationConfig.maxOutputTokens = maxTokens;

  const requestBody: Record<string, unknown> = {
    contents: [buildGeminiContents(systemPrompt, userPrompt, undefined)],
    generationConfig,
  };
  if (systemPrompt) {
    requestBody.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const response = await fetch(geminiModelEndpoint(model, apiKey, "streamGenerateContent"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok || !response.body) {
    const error = await response.json().catch(() => ({ error: { message: "Gemini stream failed" } }));
    return jsonError(error.error?.message ?? `Gemini stream error (${response.status})`, response.status);
  }

  // Gemini streams JSON objects (array of chunks). We transform to SSE
  // "data: {...}" lines matching the OpenAI streaming format the frontend expects.
  const transformedStream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Gemini streams a JSON array; extract individual {...} objects
          let start = buffer.indexOf("{");
          while (start !== -1) {
            let depth = 0;
            let end = -1;
            for (let i = start; i < buffer.length; i++) {
              if (buffer[i] === "{") depth++;
              else if (buffer[i] === "}") {
                depth--;
                if (depth === 0) { end = i; break; }
              }
            }
            if (end === -1) break; // incomplete object, wait for more data

            const jsonStr = buffer.slice(start, end + 1);
            buffer = buffer.slice(end + 1);

            try {
              const chunk = JSON.parse(jsonStr);
              const text = chunk.candidates?.[0]?.content?.parts
                ?.map((p: { text?: string }) => p.text ?? "")
                .join("") ?? "";
              if (text) {
                const sseData = JSON.stringify({
                  choices: [{ delta: { content: text } }],
                });
                controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
              }
            } catch { /* skip malformed */ }

            start = buffer.indexOf("{");
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(transformedStream, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
}

// ============================================================
// Anthropic (Claude) handlers
// ============================================================

const ANTHROPIC_API_BASE = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

async function handleAnthropicRequest(action: string, body: Record<string, unknown>): Promise<Response> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

  if (!ANTHROPIC_API_KEY) {
    return jsonError("Anthropic API key not configured. Set ANTHROPIC_API_KEY in edge function secrets.", 503);
  }

  switch (action) {
    case "generate_text":
      return await anthropicGenerateText(body, ANTHROPIC_API_KEY);
    case "generate_structured":
      return await anthropicGenerateStructured(body, ANTHROPIC_API_KEY);
    case "generate_stream":
      return await anthropicGenerateStream(body, ANTHROPIC_API_KEY);
    default:
      return jsonError(`Unknown action: ${action}`, 400);
  }
}

async function anthropicGenerateText(body: Record<string, unknown>, apiKey: string): Promise<Response> {
  const model = body.model as string ?? "claude-3-5-sonnet-20241022";
  const systemPrompt = body.system_prompt as string | undefined;
  const userPrompt = body.user_prompt as string;
  const temperature = body.temperature as number ?? 0.7;
  const maxTokens = body.max_tokens as number ?? 4096;

  const requestBody: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: "user", content: userPrompt }],
  };
  if (systemPrompt) requestBody.system = systemPrompt;

  const response = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: "Anthropic request failed" } }));
    return jsonError(error.error?.message ?? `Anthropic error (${response.status})`, response.status);
  }

  const data = await response.json();
  const content = (data.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");

  return jsonResponse({
    content,
    finish_reason: data.stop_reason ?? "stop",
    prompt_tokens: data.usage?.input_tokens ?? 0,
    completion_tokens: data.usage?.output_tokens ?? 0,
    total_tokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
    model: data.model ?? model,
  });
}

async function anthropicGenerateStructured(body: Record<string, unknown>, apiKey: string): Promise<Response> {
  const model = body.model as string ?? "claude-3-5-sonnet-20241022";
  const systemPrompt = body.system_prompt as string | undefined;
  const userPrompt = body.user_prompt as string;
  const temperature = body.temperature as number ?? 0.3;
  const maxTokens = body.max_tokens as number ?? 4096;

  const structuredSystemPrompt = `${systemPrompt ?? ""}\n\nYou must respond with valid JSON only. No markdown, no explanation, just a JSON object.`.trim();

  const requestBody: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: "user", content: userPrompt }],
    system: structuredSystemPrompt,
  };

  const response = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: "Anthropic request failed" } }));
    return jsonError(error.error?.message ?? `Anthropic error (${response.status})`, response.status);
  }

  const data = await response.json();
  const rawContent = (data.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");

  let structuredData: Record<string, unknown> = {};
  try {
    structuredData = JSON.parse(rawContent);
  } catch {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { structuredData = JSON.parse(jsonMatch[0]); } catch { /* leave empty */ }
    }
  }

  return jsonResponse({
    structured_data: structuredData,
    raw: rawContent,
    prompt_tokens: data.usage?.input_tokens ?? 0,
    completion_tokens: data.usage?.output_tokens ?? 0,
    model: data.model ?? model,
  });
}

async function anthropicGenerateStream(body: Record<string, unknown>, apiKey: string): Promise<Response> {
  const model = body.model as string ?? "claude-3-5-sonnet-20241022";
  const systemPrompt = body.system_prompt as string | undefined;
  const userPrompt = body.user_prompt as string;
  const temperature = body.temperature as number ?? 0.7;
  const maxTokens = body.max_tokens as number ?? 4096;

  const requestBody: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: "user", content: userPrompt }],
    stream: true,
  };
  if (systemPrompt) requestBody.system = systemPrompt;

  const response = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok || !response.body) {
    const error = await response.json().catch(() => ({ error: { message: "Anthropic stream failed" } }));
    return jsonError(error.error?.message ?? `Anthropic stream error (${response.status})`, response.status);
  }

  // Transform Anthropic SSE format to OpenAI-compatible SSE format
  const transformedStream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "content_block_delta" && event.delta?.text) {
                const sseData = JSON.stringify({
                  choices: [{ delta: { content: event.delta.text } }],
                });
                controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
              }
            } catch { /* skip malformed */ }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(transformedStream, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
}

// ============================================================
// Helpers
// ============================================================

function jsonResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
