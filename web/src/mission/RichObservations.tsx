import type { missionOverview } from './overview';
import { SourceRecords } from './Records';
import { richSources } from './richEvidence';
type Model = Pick<
  ReturnType<typeof missionOverview>,
  'descriptive' | 'records' | 'excludedRecordIds'
>;
export function DescriptiveCards({ model }: { model: Model }) {
  return (
    <div className="m-rich-grid">
      {model.descriptive.map((c) => (
        <article
          className="m-observation"
          key={c.measurement}
          data-testid={`rich-${c.measurement}`}
        >
          <p className={`m-chip ${c.supported ? 'is-supported' : 'is-withheld'}`}>
            {c.supported ? 'Available paired records' : 'Comparison withheld'}
          </p>
          <h3>
            {c.measurement === 'vo2peak'
              ? 'Measured absolute VO₂peak'
              : 'Self-reported sleep duration'}
          </h3>
          {c.supported ? (
            <>
              <strong className="m-rich-value">
                {c.early!.value} → {c.late!.value} {c.early!.unit}
              </strong>
              <p>
                {c.difference! > 0 ? '+' : ''}
                {c.difference} {c.early!.unit} between two fictional transit records,{' '}
                {c.early!.timestamp.slice(0, 10)} and {c.late!.timestamp.slice(0, 10)}.
              </p>
              <p>
                {c.measurement === 'vo2peak'
                  ? 'The later recorded peak oxygen uptake was lower under matching declared acquisition conditions.'
                  : 'The later diary reports one hour less sleep over the equivalent reporting period.'}
              </p>
            </>
          ) : (
            <p>The selected records do not support a compatible current-context comparison.</p>
          )}
          <p>
            {c.measurement === 'vo2peak'
              ? 'Separate gas analysis, never estimated from wearable HR. No clinical fitness change, true VO₂max plateau, relative mL/kg/min or programme requirement satisfaction is established.'
              : 'Self-report over preceding 24-hour periods. Duration alone does not diagnose a sleep disorder or establish fatigue or performance impairment.'}
          </p>
          <details className="m-details">
            <summary>Inspect source and acquisition conditions</summary>
            <SourceRecords
              records={model.records.filter((r) => r.measurement === c.measurement)}
              excluded={model.excludedRecordIds}
            />
            <a href={richSources[c.measurement === 'vo2peak' ? 0 : 1].url}>
              {richSources[c.measurement === 'vo2peak' ? 0 : 1].label}
            </a>
            <p>{richSources[c.measurement === 'vo2peak' ? 0 : 1].boundary}</p>
          </details>
        </article>
      ))}
    </div>
  );
}
export function RichObservations({
  model,
  onInterpretation,
}: {
  model: ReturnType<typeof missionOverview>;
  onInterpretation: () => void;
}) {
  return (
    <section className="m-rich" aria-labelledby="available-title">
      <p className="m-eyebrow">Available fictional health observations</p>
      <h2 id="available-title">What the recorded evidence shows</h2>
      <p>
        Information coverage is {model.coverage.available} of {model.coverage.total} current review
        items, never a readiness score.
      </p>
      <DescriptiveCards model={model} />
      <div className="m-next-buttons">
        <button className="m-text-action" onClick={onInterpretation}>
          View available interpretations
        </button>
      </div>
    </section>
  );
}
