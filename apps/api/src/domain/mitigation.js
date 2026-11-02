export const MITIGATION_VERSION = 'mitigation-v1';

// Order the caller is walked through, most life-critical first.
export const SCRIPT_ORDER = Object.freeze([
  'life-safety-evacuate',
  'electrical-safety',
  'stop-water-main-shutoff',
  'stop-water-angle-stop',
  'sewage-avoid-contact',
  'contain-water',
  'document-damage',
]);

// `confirmation` is what the caller must record for each step. 'observed' steps
// are the ones the dispatcher relies on as liability evidence.
export const MITIGATION_SCRIPTS = Object.freeze({
  'life-safety-evacuate': {
    id: 'life-safety-evacuate',
    title: 'Make the place safe before touching anything else',
    risk: 'life_safety',
    acknowledgement:
      'I confirm I am following these steps and will call emergency services if anyone is in danger.',
    steps: [
      {
        id: 'leave-immediately',
        instruction:
          'Leave the affected area now. Do not stop to collect belongings.',
        confirmation: 'done',
      },
      {
        id: 'no-switches',
        instruction:
          'Do not operate light switches, doorbells, phones or appliances while you suspect gas or smoke.',
        confirmation: 'done',
      },
      {
        id: 'call-emergency',
        instruction:
          'From outside, call your local emergency number. Keep this line open for our dispatcher.',
        confirmation: 'done',
      },
      {
        id: 'all-out',
        instruction:
          'Get everyone, including pets and anyone who needs help, out and to a point away from the building.',
        confirmation: 'observed',
      },
    ],
  },
  'electrical-safety': {
    id: 'electrical-safety',
    title: 'Isolate electricity near the water',
    risk: 'electrical',
    acknowledgement:
      'I confirm I will not touch electrical equipment while standing in or next to water.',
    steps: [
      {
        id: 'dry-hands-path',
        instruction:
          'Only move toward the breaker panel if your hands and feet are dry and the path is clear of water.',
        confirmation: 'done',
      },
      {
        id: 'kill-circuit',
        instruction:
          'Switch off the breaker for the affected room. If you cannot tell which one, switch off the main breaker.',
        confirmation: 'done',
      },
      {
        id: 'unplug-safe',
        instruction:
          'Unplug appliances only if they are already dry and you can do it without reaching across water.',
        confirmation: 'done',
      },
      {
        id: 'power-off-confirmed',
        instruction:
          'Confirm the lights and outlets in the affected area are dead.',
        confirmation: 'observed',
      },
    ],
  },
  'stop-water-main-shutoff': {
    id: 'stop-water-main-shutoff',
    title: 'Shut off the building water supply',
    risk: 'water',
    acknowledgement:
      'I confirm I understand this stops water to the whole unit and I know where the valve is.',
    steps: [
      {
        id: 'locate-main',
        instruction:
          'Find the main shutoff. It is usually where the water pipe enters the building: a basement, utility cupboard, garage, or a pit near the street.',
        confirmation: 'done',
      },
      {
        id: 'identify-type',
        instruction:
          'Identify the valve: a round wheel handle, or a lever that turns a quarter turn.',
        confirmation: 'observed',
      },
      {
        id: 'turn-valve',
        instruction:
          'Wheel handle: turn clockwise until it stops hard. Lever: turn until it sits crosswise to the pipe. Do not force a seized valve — stop and tell the dispatcher.',
        confirmation: 'done',
      },
      {
        id: 'flow-stopped',
        instruction:
          'Watch the leak. Confirm the flow has dropped to a trickle or stopped. Open a low faucet to release the pressure and note whether it runs dry.',
        confirmation: 'observed',
      },
      {
        id: 'report-result',
        instruction:
          'Tell the dispatcher whether the water stopped, slowed or did not change.',
        confirmation: 'done',
      },
    ],
  },
  'stop-water-angle-stop': {
    id: 'stop-water-angle-stop',
    title: 'Isolate the single fixture instead',
    risk: 'water',
    acknowledgement:
      'I confirm I will only close valves serving the fixture that is leaking.',
    steps: [
      {
        id: 'locate-fixture-valve',
        instruction:
          'Find the small oval valve on the pipe below or behind the leaking fixture — under a sink or behind the toilet where the supply line meets the wall.',
        confirmation: 'observed',
      },
      {
        id: 'close-fixture-valve',
        instruction: 'Turn it clockwise until it stops.',
        confirmation: 'done',
      },
      {
        id: 'fixture-dry',
        instruction:
          'Run that faucet. Confirm nothing comes out, so you know the leak above is isolated water, not house pressure.',
        confirmation: 'observed',
      },
    ],
  },
  'sewage-avoid-contact': {
    id: 'sewage-avoid-contact',
    title: 'Keep everyone clear of sewage',
    risk: 'health',
    acknowledgement:
      'I confirm nobody will drink from, bathe in, or clean standing sewage water without protection.',
    steps: [
      {
        id: 'stop-drains',
        instruction:
          'Do not flush toilets, run dishwashers, washing machines, or any drain in the building.',
        confirmation: 'done',
      },
      {
        id: 'keep-out',
        instruction:
          'Keep children and pets out of the affected room. Close the door.',
        confirmation: 'done',
      },
      {
        id: 'ventilate',
        instruction:
          'Open windows in the affected area if the weather allows.',
        confirmation: 'done',
      },
      {
        id: 'no-contact',
        instruction:
          'Confirm nobody has touched the water. If someone has, wash with soap and clean water now.',
        confirmation: 'observed',
      },
    ],
  },
  'contain-water': {
    id: 'contain-water',
    title: 'Limit the damage while you wait',
    risk: 'property',
    acknowledgement:
      'I confirm I will not move structural items or cut anything myself.',
    steps: [
      {
        id: 'bucket-towels',
        instruction: 'Place a bucket under the drip and lay towels to channel water away.',
        confirmation: 'done',
      },
      {
        id: 'elevate',
        instruction:
          'Lift electronics, documents and furniture off the wet floor onto a dry surface.',
        confirmation: 'done',
      },
      {
        id: 'drain-ceiling',
        instruction:
          'If a ceiling is bulging, puncture it once with a screwdriver into a bucket to release the weight. Do not cut or widen it.',
        confirmation: 'done',
      },
      {
        id: 'contained',
        instruction: 'Confirm the water is now held where it will not spread further.',
        confirmation: 'observed',
      },
    ],
  },
  'document-damage': {
    id: 'document-damage',
    title: 'Record evidence for the claim',
    risk: 'evidence',
    acknowledgement:
      'I confirm the photos and video I upload show the actual condition of the property.',
    steps: [
      {
        id: 'wide-shot',
        instruction: 'Take one photo of the whole room so the location is clear.',
        confirmation: 'done',
      },
      {
        id: 'close-shot',
        instruction: 'Take a close photo of the source and of the worst damage.',
        confirmation: 'done',
      },
      {
        id: 'upload',
        instruction:
          'Upload the photos or a short video here so the contractor and the dispatcher both see them.',
        confirmation: 'done',
      },
      {
        id: 'serial-numbers',
        instruction:
          'Photograph make and model labels on any appliance affected by the water.',
        confirmation: 'done',
      },
    ],
  },
});

export function getScript(id) {
  return MITIGATION_SCRIPTS[id] ?? null;
}

export function orderScriptIds(ids) {
  const unique = [...new Set(ids.filter((id) => MITIGATION_SCRIPTS[id]))];
  return unique.sort(
    (a, b) => SCRIPT_ORDER.indexOf(a) - SCRIPT_ORDER.indexOf(b),
  );
}
