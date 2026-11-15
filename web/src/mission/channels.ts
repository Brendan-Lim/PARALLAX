/** HR has a separate Level 1 synthetic JSON adapter; other channel mappings remain contracts only. */
import { currentVersions } from './identity';
export const monitoringPolicyVersion = currentVersions.monitoringPolicy;
export const channelContracts = [
  {
    id: 'astro-hr',
    measurement: 'device-heart-rate',
    unit: 'bpm',
    datatype: 19,
    qualityDatatype: 1000,
    context:
      'Activity and workload when known, acquisition setting, device/record identity, source timestamp and clock basis, receipt time and sample-aligned quality.',
    limitation:
      'A vendor HR value may retain the last valid result during invalid detection. A timestamp alone does not prove fresh physiology. This channel cannot replace the cycling pair, establish VO2max or define a danger threshold.',
  },
  {
    id: 'astro-breathing',
    measurement: 'breathing-rate',
    unit: 'breaths/min',
    datatype: 33,
    qualityDatatype: 1001,
    context:
      'Activity, acquisition context, source clock and sample-aligned quality; firmware/version must be verified.',
    limitation: 'No respiratory requirement is designated here; unknown quality remains unknown.',
  },
  {
    id: 'astro-spo2',
    measurement: 'oxygen-saturation',
    unit: '%',
    datatype: 66,
    qualityDatatype: 1002,
    context: 'Source timestamp, signal/perfusion status, model and sample-aligned quality.',
    limitation:
      'A device estimate with accuracy limitations; no personal alarm threshold or substitute for functional assessment.',
  },
  {
    id: 'astro-systolic-estimate',
    measurement: 'systolic-pressure-estimate',
    unit: 'mmHg',
    datatype: 98,
    qualityDatatype: 1005,
    context: 'PTT-derived origin, source timestamp, model/version and sample-aligned quality.',
    limitation: 'Systolic estimate only; cannot supply cuff pressure, diastolic pressure or MAP.',
  },
] as const;
export const channelSource = {
  id: 'astro-datatypes',
  reference: 'Hexoskin/Astroskin API 3.3.x documentation, datatype definitions',
  url: 'https://astro.hexoskin.com/docs/resource/datatype/',
  locator: 'Datatypes 19/1000, 33/1001, 66/1002 and 98/1005; JSON engineering units',
  population: 'Commercial documented device formats; no flight-system export or hardware tested.',
  finding: 'The vendor documents scalar channels and separate quality fields.',
  boundary:
    'A compatible format mapping is not a connected device, licensed access or validated clinical monitoring. Native binary scaling differs from JSON engineering units.',
  consequence:
    'HR/quality documented-format parsing uses synthetic fixtures; other channels and hardware remain unimplemented.',
};
