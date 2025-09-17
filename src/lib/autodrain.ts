// src/lib/autodrain.ts
export type Cadence = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export function addCadence(date: Date, cadence: Cadence) {
  const d = new Date(date);
  if (cadence === 'DAILY') d.setDate(d.getDate() + 1);
  else if (cadence === 'WEEKLY') d.setDate(d.getDate() + 7);
  else {
    // MONTHLY – auf selben Tag im Folgemonat, overflow-safe
    const day = d.getDate();
    d.setMonth(d.getMonth() + 1);
    if (d.getDate() < day) d.setDate(0); // letzter Tag des Vormonats
  }
  return d;
}
