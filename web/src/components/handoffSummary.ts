import type { HandoffItem } from './ReviewHandoff';

/**
 * Reads the opening "Review handoff" section of the Markdown that the shared report generator
 * produced, so the on-screen preview always describes the exact file that will be downloaded.
 * If the expected section is absent the preview is omitted rather than guessed.
 */
export function handoffSummary(report: string): HandoffItem[] {
  // Generated structure is matched only at the start of a line. Question text is quoted ("> ")
  // by the report generator, so a typed heading or metadata label can never be mistaken for it.
  const lines = report.split('\n');
  const end = lines.findIndex((l) => l === '## Supporting detail and provenance');
  const opening = end < 0 ? lines : lines.slice(0, end);
  const section = (heading: string) => {
    const start = opening.indexOf(`### ${heading}`);
    if (start < 0) return undefined;
    const rest = opening.slice(start + 1);
    const stop = rest.findIndex((l) => l.startsWith('### ') || l.startsWith('Scope: '));
    return (stop < 0 ? rest : rest.slice(0, stop)).filter((l) => l.trim());
  };
  const block = section('Selected review question');
  if (!block?.length) return [];
  const question = block.filter((l) => l.startsWith('>')).map((l) => l.replace(/^> ?/, ''));
  const meta = block.filter((l) => !l.startsWith('>'));
  const items: HandoffItem[] = [
    { label: 'Question', value: question.filter((l) => l.trim()).join(' ') },
  ];

  let selectedTitle: string | undefined;
  const selected = meta.find((l) => l.startsWith('Selected finding: '));
  const parsed = selected?.slice('Selected finding: '.length).match(/^(.*?) — (.*?)\.(?: (.*))?$/);
  if (parsed) {
    selectedTitle = parsed[1];
    const value = parsed[3] && /^[+−\d]/.test(parsed[3]) ? ` · ${parsed[3]}` : '';
    items.push({ label: 'Selected finding', value: `${parsed[1]} · ${parsed[2]}${value}` });
  }
  const marked = meta.find((l) => l.startsWith('Marked for qualified review: '));
  if (marked)
    items.push({
      label: 'Marked for review',
      value: marked.slice('Marked for qualified review: '.length),
    });

  const issues = (section('Important unresolved evidence issues') ?? [])
    .filter((l) => l.startsWith('- '))
    .map((l) => ({ title: l.slice(2, l.indexOf(': ')), text: l }));
  const own = issues.find((i) => i.title === selectedTitle);
  if (own) {
    const requirements = [...own.text.matchAll(/Required: ([^.]+)\./g)].map((m) => m[1]);
    if (requirements.length)
      items.push({
        label: 'Unresolved requirement',
        value: requirements.join('; '),
        tone: 'issue',
      });
    const original = own.text.match(/Excluded original record\(s\): ([^.]+)\./)?.[1];
    if (original) items.push({ label: 'Excluded original', value: original, tone: 'issue' });
    const excludedCopy = own.text.match(/Excluded dependent copy: (.+?); supplies/)?.[1];
    if (excludedCopy)
      items.push({ label: 'Excluded dependent copy', value: excludedCopy, tone: 'issue' });
    const copy = own.text.match(/ Dependent copy: (.+?); supplies/)?.[1];
    if (copy)
      items.push({ label: 'Dependent copy', value: `${copy}; not independent`, tone: 'issue' });
  }
  const others = issues.filter((i) => i !== own).map((i) => i.title);
  if (others.length)
    items.push({
      label: own ? 'Other unresolved issues' : 'Unresolved issues',
      value: others.join('; '),
      tone: 'issue',
    });

  const supported = (section('Relevant supported findings') ?? []).filter((l) =>
    l.startsWith('- '),
  ).length;
  items.push({
    label: 'Supported comparisons',
    value: supported ? `${supported}, each with its own direct records` : 'None',
  });

  const next = section('Next review action')?.join(' ');
  if (next) items.push({ label: 'Next review action', value: next.split('. ')[0] });
  return items;
}
