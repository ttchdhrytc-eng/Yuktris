import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function toHTML(content: Record<string, unknown>, companyName: string): string {
  const parts: string[] = [];
  parts.push(`<html><head><meta charset="utf-8"><title>Proposal for ${companyName}</title></head><body>`);
  parts.push(`<h1>Proposal for ${companyName}</h1>`);
  parts.push(`<h2>Executive Summary</h2><p>${content.executive_summary ?? ''}</p>`);
  parts.push(`<h2>Company Overview</h2><p>${content.company_overview ?? ''}</p>`);

  const painPoints = (content.problem_analysis as Record<string, unknown>[]) ?? [];
  if (painPoints.length > 0) {
    parts.push('<h2>Problem Analysis</h2>');
    for (const p of painPoints) {
      parts.push(`<h3>${p.pain_point}</h3><p>${p.description}</p><p><strong>Solution:</strong> ${p.proposed_solution}</p>`);
    }
  }

  const solutions = (content.solution_recommendations as Record<string, unknown>[]) ?? [];
  if (solutions.length > 0) {
    parts.push('<h2>Solution Recommendations</h2>');
    for (const s of solutions) {
      parts.push(`<h3>${s.service_name}</h3><p>${s.description}</p>`);
    }
  }

  const pricing = content.pricing as { total?: number; line_items?: { name: string; total: number }[]; payment_terms?: string } | undefined;
  if (pricing) {
    parts.push('<h2>Pricing</h2><table border="1" cellpadding="8"><tr><th>Item</th><th>Price</th></tr>');
    for (const item of (pricing.line_items ?? [])) {
      parts.push(`<tr><td>${item.name}</td><td>$${item.total.toLocaleString()}</td></tr>`);
    }
    parts.push('</table>');
    parts.push(`<p><strong>Total:</strong> $${(pricing.total ?? 0).toLocaleString()}</p>`);
    parts.push(`<p><strong>Terms:</strong> ${pricing.payment_terms ?? ''}</p>`);
  }

  const roi = content.roi as { investment?: number; total_projected_value?: number; roi_percentage?: number; payback_period_months?: number } | undefined;
  if (roi) {
    parts.push('<h2>Expected ROI</h2>');
    parts.push(`<p><strong>Investment:</strong> $${(roi.investment ?? 0).toLocaleString()}</p>`);
    parts.push(`<p><strong>Projected Value:</strong> $${(roi.total_projected_value ?? 0).toLocaleString()}</p>`);
    parts.push(`<p><strong>ROI:</strong> ${(roi.roi_percentage ?? 0).toFixed(1)}x</p>`);
    parts.push(`<p><strong>Payback:</strong> ${roi.payback_period_months ?? 0} months</p>`);
  }

  parts.push(`<h2>Call to Action</h2><p>${content.call_to_action ?? ''}</p>`);
  parts.push('</body></html>');
  return parts.join('\n');
}

function toMarkdown(content: Record<string, unknown>, companyName: string): string {
  const lines: string[] = [];
  lines.push(`# Proposal for ${companyName}\n`);
  lines.push(`## Executive Summary\n${content.executive_summary ?? ''}\n`);
  lines.push(`## Company Overview\n${content.company_overview ?? ''}\n`);

  const painPoints = (content.problem_analysis as Record<string, unknown>[]) ?? [];
  for (const p of painPoints) {
    lines.push(`### ${p.pain_point}\n${p.description}\n**Solution:** ${p.proposed_solution}\n`);
  }

  const solutions = (content.solution_recommendations as Record<string, unknown>[]) ?? [];
  for (const s of solutions) {
    lines.push(`### ${s.service_name}\n${s.description}\n`);
  }

  const pricing = content.pricing as { total?: number; payment_terms?: string } | undefined;
  if (pricing) {
    lines.push(`## Pricing\n**Total:** $${(pricing.total ?? 0).toLocaleString()}\n**Terms:** ${pricing.payment_terms ?? ''}\n`);
  }

  const roi = content.roi as { roi_percentage?: number; payback_period_months?: number } | undefined;
  if (roi) {
    lines.push(`## ROI\n**ROI:** ${(roi.roi_percentage ?? 0).toFixed(1)}x\n**Payback:** ${roi.payback_period_months ?? 0} months\n`);
  }

  lines.push(`## Call to Action\n${content.call_to_action ?? ''}\n`);
  return lines.join('\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { version_id, format } = await req.json();

    if (!version_id || !format) {
      return new Response(JSON.stringify({ error: "version_id and format are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/proposal_versions?id=eq.${version_id}&select=content,proposal_project_id,workspace_id,version_number`, { headers });
    const data = await res.json();

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ error: "Version not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const version = data[0];
    const content = version.content;

    // Get company name
    const projRes = await fetch(`${SUPABASE_URL}/rest/v1/proposal_projects?id=eq.${version.proposal_project_id}&select=company_id`, { headers });
    const projData = await projRes.json();
    const companyId = projData?.[0]?.company_id;

    let companyName = "Unknown";
    if (companyId) {
      const compRes = await fetch(`${SUPABASE_URL}/rest/v1/company_intelligence?id=eq.${companyId}&select=company_name`, { headers });
      const compData = await compRes.json();
      companyName = compData?.[0]?.company_name ?? "Unknown";
    }

    let exportedContent = '';
    let mimeType = '';
    let fileExtension = '';

    switch (format) {
      case 'html':
      case 'pdf':
        exportedContent = toHTML(content, companyName);
        mimeType = 'text/html';
        fileExtension = 'html';
        break;
      case 'markdown':
      case 'docx':
        exportedContent = toMarkdown(content, companyName);
        mimeType = 'text/markdown';
        fileExtension = 'md';
        break;
      case 'json':
        exportedContent = JSON.stringify({ company_name: companyName, ...content }, null, 2);
        mimeType = 'application/json';
        fileExtension = 'json';
        break;
      case 'presentation':
        exportedContent = toHTML(content, companyName);
        mimeType = 'text/html';
        fileExtension = 'html';
        break;
      default:
        exportedContent = toHTML(content, companyName);
        mimeType = 'text/html';
        fileExtension = 'html';
    }

    // Save asset
    await fetch(`${SUPABASE_URL}/rest/v1/proposal_assets`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        workspace_id: version.workspace_id,
        proposal_version_id: version_id,
        asset_type: format,
        content: exportedContent,
        file_size: exportedContent.length,
        metadata: { company_name: companyName, version_number: version.version_number },
      }),
    });

    return new Response(JSON.stringify({
      version_id,
      format,
      mime_type: mimeType,
      file_extension: fileExtension,
      content: exportedContent,
      file_size: exportedContent.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
