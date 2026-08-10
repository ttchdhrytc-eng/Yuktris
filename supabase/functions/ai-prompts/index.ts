import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const name = url.searchParams.get("name");

    if (req.method === "GET") {
      if (name) {
        // Get all versions of a specific prompt
        const { data, error } = await supabase
          .from("ai_prompts")
          .select("*")
          .eq("prompt_name", name)
          .order("version", { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ error: "Failed to fetch prompt." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ prompts: data ?? [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get all active prompts
      const { data, error } = await supabase
        .from("ai_prompts")
        .select("*")
        .eq("is_active", true)
        .order("prompt_name", { ascending: true });

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch prompts." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ prompts: data ?? [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST") {
      const body = await req.json();
      const {
        prompt_name,
        description,
        system_prompt,
        user_prompt_template,
        temperature = 0.7,
        max_tokens = null,
        provider_override = null,
        model_override = null,
      } = body;

      // Get latest version
      const { data: existing } = await supabase
        .from("ai_prompts")
        .select("version")
        .eq("prompt_name", prompt_name)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const newVersion = existing ? (existing as { version: number }).version + 1 : 1;

      // Deactivate previous active version
      if (existing) {
        await supabase
          .from("ai_prompts")
          .update({ is_active: false })
          .eq("prompt_name", prompt_name)
          .eq("is_active", true);
      }

      const { data, error } = await supabase
        .from("ai_prompts")
        .insert({
          prompt_name,
          version: newVersion,
          description: description ?? null,
          system_prompt,
          user_prompt_template: user_prompt_template ?? null,
          temperature,
          max_tokens,
          provider_override,
          model_override,
          is_active: true,
        })
        .select("*")
        .maybeSingle();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ prompt: data }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to manage prompts.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
