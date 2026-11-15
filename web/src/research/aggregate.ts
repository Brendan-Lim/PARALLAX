/** Published groups never enter the individual-assessment evaluator or mission state. */
import register from '../../../docs/science/CLEMENT2024_TANDEM.json';
import { requireValid } from '../mission/validation';
export { register as tandemRegister };
export type StudyGroup = 'Control' | 'Exercise' | 'LBNP' | 'Seated';
export type EyesCondition = 'eyes-closed' | 'eyes-open';
export function compareAggregate(group: StudyGroup, before: EyesCondition, after: EyesCondition) {
  const pre = register.rows.find((row) => row.group === group && row.condition === before);
  const post = register.rows.find((row) => row.group === group && row.condition === after);
  requireValid(pre && post, 'Unsupported group or acquisition condition.');
  const arithmetic = Math.round((post.afterMean - pre.beforeMean) * 100) / 100;
  const matched = before === after;
  return {
    origin: 'published-scientific-aggregate' as const,
    source: register.id,
    group,
    before: pre,
    after: post,
    unit: 'percentage points' as const,
    matched,
    supportedDifference: matched ? arithmetic : null,
    illustrativeArithmetic: matched ? null : arithmetic,
    reason: matched
      ? 'Same group, endpoint and eyes condition. Difference of rounded published group means.'
      : 'Comparison withheld: eyes condition changed. Arithmetic across conditions is a constructed teaching counterexample, not an observed physiological improvement.',
  };
}
