// The dashboard's copy of the push events, for the DEMO only - the demo never
// talks to cahyana-api, so it cannot ask. The live Settings panel reads the
// list from the API (/admin/push/config), which is the source of truth
// (cahyana-api/push.js EVENTS). Keep the two in step.
export const DEMO_PUSH_EVENTS = [
  { id: 'booking', label: 'New booking', on: true },
  { id: 'attention', label: 'Payment needs attention', on: true },
  { id: 'chat', label: 'Chat messages', on: true },
  { id: 'review', label: 'New review', on: false },
  { id: 'leads', label: 'Stopped-at-payment digest', on: false },
];
