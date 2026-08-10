// ============================================================
// ProposalFormatter — Formats proposals for different outputs
// ============================================================

import type { ProposalContent, ExportFormat } from '@/types/proposal';

class ProposalFormatter {
  format(content: ProposalContent, format: ExportFormat, companyName: string): { content: string; mimeType: string; fileExtension: string } {
    switch (format) {
      case 'html':
        return { content: this.toHTML(content, companyName), mimeType: 'text/html', fileExtension: 'html' };
      case 'markdown':
        return { content: this.toMarkdown(content, companyName), mimeType: 'text/markdown', fileExtension: 'md' };
      case 'json':
        return { content: this.toJSON(content, companyName), mimeType: 'application/json', fileExtension: 'json' };
      case 'pdf':
        return { content: this.toHTML(content, companyName), mimeType: 'text/html', fileExtension: 'html' };
      case 'docx':
        return { content: this.toMarkdown(content, companyName), mimeType: 'text/markdown', fileExtension: 'md' };
      case 'presentation':
        return { content: this.toPresentation(content, companyName), mimeType: 'text/html', fileExtension: 'html' };
      default:
        return { content: this.toHTML(content, companyName), mimeType: 'text/html', fileExtension: 'html' };
    }
  }

  private toHTML(content: ProposalContent, companyName: string): string {
    const sections: string[] = [];

    sections.push(`<html><head><meta charset="utf-8"><title>Proposal for ${companyName}</title></head><body>`);
    sections.push(`<h1>Proposal for ${companyName}</h1>`);

    sections.push(`<h2>Executive Summary</h2><p>${content.executive_summary}</p>`);

    sections.push('<h2>Company Overview</h2>');
    sections.push(`<p>${content.company_overview}</p>`);

    sections.push('<h2>Problem Analysis</h2>');
    for (const pain of content.problem_analysis) {
      sections.push(`<h3>${pain.pain_point}</h3><p><strong>Severity:</strong> ${pain.severity}</p><p>${pain.description}</p><p><strong>Proposed Solution:</strong> ${pain.proposed_solution}</p>`);
    }

    sections.push('<h2>Business Objectives</h2><ul>');
    for (const obj of content.business_objectives) {
      sections.push(`<li>${obj}</li>`);
    }
    sections.push('</ul>');

    sections.push('<h2>Recommended Strategy</h2>');
    sections.push(`<p>${content.recommended_strategy}</p>`);

    sections.push('<h2>Solution Recommendations</h2>');
    for (const sol of content.solution_recommendations) {
      sections.push(`<h3>${sol.service_name}</h3><p>${sol.description}</p><p><strong>Rationale:</strong> ${sol.rationale}</p>`);
      sections.push('<ul>');
      for (const d of sol.deliverables) sections.push(`<li>${d}</li>`);
      sections.push('</ul>');
    }

    sections.push('<h2>Implementation Roadmap</h2>');
    for (const phase of content.implementation_roadmap) {
      sections.push(`<h3>Phase ${phase.phase}: ${phase.title}</h3><p>${phase.description}</p><p><strong>Duration:</strong> ${phase.duration_weeks} weeks</p>`);
    }

    sections.push('<h2>Pricing</h2>');
    sections.push(`<p><strong>Model:</strong> ${content.pricing.model.replace(/_/g, ' ')}</p>`);
    sections.push('<table border="1" cellpadding="8"><tr><th>Item</th><th>Description</th><th>Price</th></tr>');
    for (const item of content.pricing.line_items) {
      sections.push(`<tr><td>${item.name}</td><td>${item.description}</td><td>$${item.total.toLocaleString()}</td></tr>`);
    }
    sections.push('</table>');
    sections.push(`<p><strong>Subtotal:</strong> $${content.pricing.subtotal.toLocaleString()}</p>`);
    if (content.pricing.discount > 0) sections.push(`<p><strong>Discount:</strong> -$${content.pricing.discount.toLocaleString()}</p>`);
    sections.push(`<p><strong>Total:</strong> $${content.pricing.total.toLocaleString()} ${content.pricing.currency}</p>`);
    sections.push(`<p><strong>Payment Terms:</strong> ${content.pricing.payment_terms}</p>`);

    sections.push('<h2>Expected ROI</h2>');
    sections.push(`<p><strong>Investment:</strong> $${content.roi.investment.toLocaleString()}</p>`);
    sections.push(`<p><strong>Projected Total Value:</strong> $${content.roi.total_projected_value.toLocaleString()}</p>`);
    sections.push(`<p><strong>ROI:</strong> ${content.roi.roi_percentage.toFixed(1)}x</p>`);
    sections.push(`<p><strong>Payback Period:</strong> ${content.roi.payback_period_months} months</p>`);

    sections.push('<h2>Risk Assessment</h2>');
    sections.push(`<p><strong>Overall Risk:</strong> ${content.risk_assessment.overall_risk}</p>`);
    for (const risk of content.risk_assessment.risks) {
      sections.push(`<h3>${risk.risk}</h3><p>Probability: ${Math.round(risk.probability * 100)}% | Impact: ${Math.round(risk.impact * 100)}%</p><p><strong>Mitigation:</strong> ${risk.mitigation}</p>`);
    }

    sections.push('<h2>Competitive Differentiation</h2>');
    for (const comp of content.competitive_differentiation) {
      sections.push(`<h3>vs. ${comp.competitor}</h3><p>${comp.our_advantage}</p>`);
    }

    sections.push('<h2>Case Studies</h2>');
    for (const cs of content.case_studies) {
      sections.push(`<h3>${cs.title}</h3><p><strong>Client:</strong> ${cs.client} | <strong>Industry:</strong> ${cs.industry}</p><p><strong>Challenge:</strong> ${cs.challenge}</p><p><strong>Solution:</strong> ${cs.solution}</p>`);
      sections.push('<ul>');
      for (const r of cs.results) sections.push(`<li>${r}</li>`);
      sections.push('</ul>');
    }

    sections.push('<h2>Team Recommendation</h2>');
    for (const member of content.team_recommendation) {
      sections.push(`<h3>${member.role}</h3><p>${member.responsibility}</p>`);
    }

    sections.push('<h2>FAQs</h2>');
    for (const faq of content.faqs) {
      sections.push(`<h3>${faq.question}</h3><p>${faq.answer}</p>`);
    }

    sections.push(`<h2>Call to Action</h2><p>${content.call_to_action}</p>`);
    sections.push('</body></html>');

    return sections.join('\n');
  }

  private toMarkdown(content: ProposalContent, companyName: string): string {
    const lines: string[] = [];

    lines.push(`# Proposal for ${companyName}\n`);
    lines.push(`## Executive Summary\n${content.executive_summary}\n`);

    lines.push(`## Company Overview\n${content.company_overview}\n`);

    lines.push('## Problem Analysis\n');
    for (const pain of content.problem_analysis) {
      lines.push(`### ${pain.pain_point}\n**Severity:** ${pain.severity}\n${pain.description}\n**Proposed Solution:** ${pain.proposed_solution}\n`);
    }

    lines.push('## Business Objectives\n');
    for (const obj of content.business_objectives) lines.push(`- ${obj}`);
    lines.push('');

    lines.push(`## Recommended Strategy\n${content.recommended_strategy}\n`);

    lines.push('## Solution Recommendations\n');
    for (const sol of content.solution_recommendations) {
      lines.push(`### ${sol.service_name}\n${sol.description}\n**Rationale:** ${sol.rationale}\n**Deliverables:**\n`);
      for (const d of sol.deliverables) lines.push(`- ${d}`);
      lines.push('');
    }

    lines.push('## Implementation Roadmap\n');
    for (const phase of content.implementation_roadmap) {
      lines.push(`### Phase ${phase.phase}: ${phase.title}\n${phase.description}\n**Duration:** ${phase.duration_weeks} weeks\n`);
    }

    lines.push('## Pricing\n');
    lines.push(`**Model:** ${content.pricing.model.replace(/_/g, ' ')}\n`);
    for (const item of content.pricing.line_items) {
      lines.push(`- ${item.name}: $${item.total.toLocaleString()}`);
    }
    lines.push(`\n**Subtotal:** $${content.pricing.subtotal.toLocaleString()}`);
    if (content.pricing.discount > 0) lines.push(`**Discount:** -$${content.pricing.discount.toLocaleString()}`);
    lines.push(`**Total:** $${content.pricing.total.toLocaleString()} ${content.pricing.currency}\n`);
    lines.push(`**Payment Terms:** ${content.pricing.payment_terms}\n`);

    lines.push('## Expected ROI\n');
    lines.push(`**Investment:** $${content.roi.investment.toLocaleString()}`);
    lines.push(`**Projected Total Value:** $${content.roi.total_projected_value.toLocaleString()}`);
    lines.push(`**ROI:** ${content.roi.roi_percentage.toFixed(1)}x`);
    lines.push(`**Payback Period:** ${content.roi.payback_period_months} months\n`);

    lines.push('## Risk Assessment\n');
    lines.push(`**Overall Risk:** ${content.risk_assessment.overall_risk}\n`);
    for (const risk of content.risk_assessment.risks) {
      lines.push(`### ${risk.risk}\nProbability: ${Math.round(risk.probability * 100)}% | Impact: ${Math.round(risk.impact * 100)}%\n**Mitigation:** ${risk.mitigation}\n`);
    }

    lines.push('## Competitive Differentiation\n');
    for (const comp of content.competitive_differentiation) {
      lines.push(`### vs. ${comp.competitor}\n${comp.our_advantage}\n`);
    }

    lines.push('## Case Studies\n');
    for (const cs of content.case_studies) {
      lines.push(`### ${cs.title}\n**Client:** ${cs.client} | **Industry:** ${cs.industry}\n**Challenge:** ${cs.challenge}\n**Solution:** ${cs.solution}\n**Results:**\n`);
      for (const r of cs.results) lines.push(`- ${r}`);
      lines.push('');
    }

    lines.push('## Team Recommendation\n');
    for (const member of content.team_recommendation) {
      lines.push(`### ${member.role}\n${member.responsibility}\n`);
    }

    lines.push('## FAQs\n');
    for (const faq of content.faqs) {
      lines.push(`### ${faq.question}\n${faq.answer}\n`);
    }

    lines.push(`## Call to Action\n${content.call_to_action}\n`);

    return lines.join('\n');
  }

  private toJSON(content: ProposalContent, companyName: string): string {
    return JSON.stringify({ company_name: companyName, ...content }, null, 2);
  }

  private toPresentation(content: ProposalContent, companyName: string): string {
    const slides: string[] = [];

    slides.push('<html><head><meta charset="utf-8"><title>Proposal Presentation</title></head><body>');
    slides.push(`<div style="text-align:center;padding:60px;"><h1>Proposal for ${companyName}</h1><p>${content.strategy.approach}</p></div>`);

    slides.push(`<div style="padding:40px;"><h2>Executive Summary</h2><p>${content.executive_summary}</p></div>`);

    slides.push('<div style="padding:40px;"><h2>Key Challenges</h2><ul>');
    for (const pain of content.problem_analysis.slice(0, 5)) {
      slides.push(`<li><strong>${pain.pain_point}</strong>: ${pain.description}</li>`);
    }
    slides.push('</ul></div>');

    slides.push('<div style="padding:40px;"><h2>Our Solutions</h2><ul>');
    for (const sol of content.solution_recommendations.slice(0, 5)) {
      slides.push(`<li><strong>${sol.service_name}</strong>: ${sol.description}</li>`);
    }
    slides.push('</ul></div>');

    slides.push(`<div style="padding:40px;"><h2>Investment & ROI</h2><p><strong>Investment:</strong> $${content.roi.investment.toLocaleString()}</p><p><strong>Projected Value:</strong> $${content.roi.total_projected_value.toLocaleString()}</p><p><strong>ROI:</strong> ${content.roi.roi_percentage.toFixed(1)}x</p><p><strong>Payback:</strong> ${content.roi.payback_period_months} months</p></div>`);

    slides.push(`<div style="text-align:center;padding:60px;"><h2>Call to Action</h2><p>${content.call_to_action}</p></div>`);
    slides.push('</body></html>');

    return slides.join('\n');
  }
}

export const proposalFormatter = new ProposalFormatter();
