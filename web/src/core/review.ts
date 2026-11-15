import { featuredScenarioFor } from '../data/scenarios';
import { evaluate, formatNumber, signed, comparisonSummary } from './engine';
import { measures, statusLabels, type CasePacket, type Finding, type Measure } from './model';
import { healthActions, currentActionState } from './actions';
import { missionContext, type MissionPhase } from './context';
import type { Session } from './session';
import { sources } from '../data/science';

/**
 * User-entered question text is quoted line by line, so it can never begin a report heading or a
 * metadata line. The on-screen handoff preview relies on this boundary.
 */
export const quote = (text: string) =>
  text
    .split('\n')
    .map((line) => (line.trim() ? `> ${line.trimEnd()}` : '>'))
    .join('\n');

export function reviewMarkdown(
  packet: CasePacket,
  unavailable: string[],
  marked: string[],
  note: string,
  generatedAt = new Date().toISOString(),
  workflow?: Pick<Session, 'missionPhase' | 'receipts' | 'planCompleted'> & {
    selected?: Finding['id'];
  },
): string {
  const findings = evaluate(packet, unavailable);
  const phase: MissionPhase = workflow?.missionPhase ?? 'transition';
  const context = missionContext(packet, phase);
  const actions = healthActions(packet, unavailable, phase);
  const selected =
    findings.find((f) => f.id === workflow?.selected) ??
    findings.find((f) => marked.includes(f.id)) ??
    findings.find((f) => f.status === 'insufficient' || f.status === 'unresolved');
  const unresolved = findings.filter(
    (f) => f.status === 'insufficient' || f.status === 'unresolved',
  );
  const scenario = featuredScenarioFor(packet, unavailable);
  const next = actions.find((a) => a.findingIds.includes(selected?.id ?? 'task'));
  const handoff = `## Review handoff

Fictional case: ${scenario?.title ?? packet.case.title} (${packet.case.id})
Review context: ${context.label}; ${context.identity}

### Selected review question

${quote(note.trim() || (selected ? `What evidence supports the ${selected.title.toLowerCase()}?` : 'No additional question entered.'))}

${selected ? `Selected finding: ${selected.title} — ${statusLabels[selected.status]}. ${comparisonSummary(selected)}` : ''}
${
  marked.length
    ? `Marked for qualified review: ${findings
        .filter((f) => marked.includes(f.id))
        .map((f) => f.title)
        .join('; ')}`
    : ''
}

### Important unresolved evidence issues

${
  unresolved.length
    ? unresolved
        .map(
          (f) =>
            `- ${f.title}: ${f.explanation} ${f.requirements.map((r) => `Required: ${r}.`).join(' ')} ${f.issues.join(' ')}${
              f.unavailable.some((r) => r.form === 'direct')
                ? ` Excluded original record(s): ${f.unavailable
                    .filter((r) => r.form === 'direct')
                    .map((r) => r.id)
                    .join(', ')}.`
                : ''
            }${
              f.unavailable.some((r) => r.form === 'derived')
                ? ` Excluded dependent copy: ${f.unavailable
                    .filter((r) => r.form === 'derived')
                    .map((r) => `${r.id} depends on ${r.derivedFrom.join(', ')}`)
                    .join('; ')}; supplies no independent support.`
                : ''
            }${f.excluded.length ? ` Dependent copy: ${f.excluded.map((r) => `${r.id} depends on ${r.derivedFrom.join(', ')}`).join('; ')}; supplies no independent support.` : ''}`,
        )
        .join('\n')
    : 'No missing or incompatible record requirement in the current narrow comparisons.'
}

### Affected comparisons

${unresolved.length ? unresolved.map((f) => `- ${f.title}: ${statusLabels[f.status]}; comparison withheld.`).join('\n') : 'All available narrow comparisons have their required direct records.'}

### Relevant supported findings

${
  findings
    .filter((f) => f.status === 'supported')
    .map(
      (f) =>
        `- ${f.title}: ${comparisonSummary(f)}. Supported by its own compatible direct records.`,
    )
    .join('\n') || 'No supported comparison.'
}

### Next review action

${next ? `${next.title}. ${next.reason}` : 'Inspect the current source requirements with a qualified reviewer.'}

Scope: all individual observations are fictional. These checks do not establish clinical significance, overall function or medical clearance. No transmission or NASA endorsement is implied. This Markdown file is a readable handoff; it does not restore an editable application session.

## Supporting detail and provenance
`;
  const actionText = actions
    .map(
      (a) =>
        `### ${a.title}\n\nApplicability: ${a.applicability}\n\nCategory: ${a.category}; finding: ${a.findingIds.join(', ')}; review state: ${currentActionState(a, workflow?.receipts ?? {})}\n\n${a.reason}\n\nLimit: ${a.limitation}\n\nSources: ${a.sourceIds.map((id) => sources.find((s) => s.id === id)?.url).join(', ')}`,
    )
    .join('\n\n');
  const sections = findings.map((f: Finding) => {
    const c = f.comparison;
    const values = c
      ? `\n- Baseline: ${formatNumber(c.baseline.value)} ${measures[f.id as Measure].unit} (${c.baseline.id})\n- Follow-up: ${formatNumber(c.followup.value)} ${measures[f.id as Measure].unit} (${c.followup.id})\n- Change: ${signed(c.absolute)} ${c.changeUnit}${c.relative !== null ? `; ${signed(c.relative)}% relative` : measures[f.id as Measure].relative && c.baseline.value === 0 ? '; relative percentage undefined: baseline is zero; absolute change supported' : '; relative percentage not used for this measurement'}`
      : '';
    return `## ${f.title}\n\nStatus: ${statusLabels[f.status]}\n\n${f.explanation}${values}\n${f.evidence.map((r) => `- Available record: ${r.id}; source ${r.sourceId} / ${r.sourceRecord}; session ${r.session}; protocol ${r.protocol}; window ${r.window}; timestamp ${r.timestamp ?? 'unknown'}${r.acquisition ? '; acquisition ' + JSON.stringify(r.acquisition) : ''}`).join('\n')}\n${f.unavailable.map((r) => (r.form === 'derived' ? `- Simulated unavailable dependent copy: ${r.id} (original retained); depends on ${r.derivedFrom.join(', ')}` : `- Simulated unavailable record: ${r.id} (original retained)`)).join('\n')}\n${f.excluded.map((r) => `- Derived record excluded from independent support: ${r.id}; depends on ${r.derivedFrom.join(', ')}`).join('\n')}\n${f.requirements.map((r) => `- Required: ${r}`).join('\n')}\n${f.issues.map((r) => `- Unresolved issue: ${r}`).join('\n')}\n${f.limitations.map((r) => `- Limitation: ${r}`).join('\n')}\n${marked.includes(f.id) ? '\nMarked for qualified review; this is not medical resolution.\n' : ''}`;
  });
  return `# PARALLAX — Synthetic demonstration review\n\nReport generated: ${generatedAt}\nCase: ${packet.case.id} — ${scenario?.title ?? packet.case.title}\n\n${handoff}\nAll individual observations are fictional synthetic demonstration data. No actual NASA participant is represented. Evidence removal is a simulated availability experiment. This report is not diagnosis, treatment, triage, readiness assessment or medical clearance. Nothing has been transmitted to mission control.\n\n## Mission context\n\n${context.identity}\nReview context: ${context.label}\n${context.explanation}\nAcquisition: ${context.acquisition}\n${context.boundary}\n\n${sections.join('\n\n')}\n\n## Evidence-aware health actions\n\n${actionText}\n\n## Existing synthetic plan\n\nPLAN-DEMO-01 activity: ${workflow?.planCompleted ? 'recorded completed' : 'not recorded completed'}. Completion is an activity record, not evidence of function or medical clearance. No prescription is generated.\n\nFor an actual suspected emergency follow established mission emergency procedures and qualified medical support.\n\n## Review question\n\n${quote(note.trim() || 'No additional question entered.')}\n\n## Scientific context — separate from individual observations\n\n${sources.map((s) => `- ${s.title} — ${s.publisher}. ${s.locator}. ${s.url}\n  ${s.statement} ${s.boundary}`).join('\n')}\n\nStudy-level evidence cannot replace missing case observations. The prototype is not medically validated or endorsed by NASA.\n`;
}
