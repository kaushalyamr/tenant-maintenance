'use client';

import { useState } from 'react';

function Choice({ name, value, onChange, options, hint }) {
  return (
    <fieldset>
      <legend className="label">{hint}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(name, option.value)}
              className={`min-h-11 rounded-xl border px-4 text-sm font-semibold transition ${
                active
                  ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-brand-500 hover:bg-brand-50'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

const YES_NO = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

const FLOW_OPTIONS = [
  { value: 'drip', label: 'Drips' },
  { value: 'steady', label: 'A stream' },
  { value: 'gushing', label: 'Spraying out' },
  { value: 'pooling', label: 'Pooled on the floor' },
  { value: 'unsure', label: 'Cannot tell' },
];

const SHUTOFF_OPTIONS = [
  { value: 'yes', label: 'I can reach it' },
  { value: 'no', label: 'Cannot reach it' },
  { value: 'unknown', label: 'Do not know' },
];

export const EMPTY_SIGNALS = {
  waterPresent: null,
  flow: null,
  spreading: null,
  nearElectrical: null,
  ceilingOrWallDamage: null,
  sourceKnown: null,
  hotWaterOrBrown: null,
  sewage: null,
  gasOrSmoke: null,
  shutoffAccessible: null,
  vulnerableOccupant: null,
  affectedUnits: 1,
  callerSummary: '',
};

export function IntakeForm({ signals, onChange, onSummaryChange, onSubmit, busy, errorSlot }) {
  const [touched, setTouched] = useState(false);
  const set = (key, value) => onChange(key, value);

  const missing = Object.entries(signals).filter(
    ([key, value]) => key !== 'callerSummary' && key !== 'affectedUnits' && value === null,
  );

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (missing.length === 0 && !busy) onSubmit();
      }}
    >
      <section className="card space-y-4 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-brand-700">The water</h3>
        <Choice name="waterPresent" value={signals.waterPresent} onChange={set} options={YES_NO} hint="Is water coming out right now?" />
        <Choice name="flow" value={signals.flow} onChange={set} options={FLOW_OPTIONS} hint="How is it coming out?" />
        <Choice name="spreading" value={signals.spreading} onChange={set} options={YES_NO} hint="Is it spreading across the floor?" />
        <Choice name="hotWaterOrBrown" value={signals.hotWaterOrBrown} onChange={set} options={YES_NO} hint="Is the water hot, rusty or brown?" />
        <Choice name="sewage" value={signals.sewage} onChange={set} options={YES_NO} hint="Is sewage or drain water coming back up?" />
        <Choice name="gasOrSmoke" value={signals.gasOrSmoke} onChange={set} options={YES_NO} hint="Do you smell gas, or see smoke?" />
      </section>

      <section className="card space-y-4 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-brand-700">The room</h3>
        <Choice name="nearElectrical" value={signals.nearElectrical} onChange={set} options={YES_NO} hint="Is the water near a socket, wire or appliance?" />
        <Choice name="ceilingOrWallDamage" value={signals.ceilingOrWallDamage} onChange={set} options={YES_NO} hint="Is a ceiling or wall stained, bulging or wet?" />
        <Choice name="sourceKnown" value={signals.sourceKnown} onChange={set} options={YES_NO} hint="Can you see which pipe or fixture it is coming from?" />
        <Choice name="shutoffAccessible" value={signals.shutoffAccessible} onChange={set} options={SHUTOFF_OPTIONS} hint="Can you reach and turn a shutoff valve?" />
      </section>

      <section className="card space-y-4 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-brand-700">Who and how much</h3>
        <Choice name="vulnerableOccupant" value={signals.vulnerableOccupant} onChange={set} options={YES_NO} hint="Is a child, an older person or someone with limited mobility in the unit?" />
        <div>
          <label className="label" htmlFor="affectedUnits">
            How many units are wet?
          </label>
          <input
            id="affectedUnits"
            className="input"
            type="number"
            min="1"
            max="5000"
            value={signals.affectedUnits}
            onChange={(event) => onChange('affectedUnits', Number(event.target.value))}
          />
          <p className="mt-1 text-xs text-slate-500">More than one points at a shared riser, which the engine treats as an emergency.</p>
        </div>
        <div>
          <label className="label" htmlFor="callerSummary">
            What did the caller say? (optional)
          </label>
          <textarea
            id="callerSummary"
            className="input min-h-24"
            rows="3"
            maxLength="1000"
            placeholder="Water spraying from under the kitchen sink and reaching the wall socket."
            value={signals.callerSummary}
            onChange={(event) => onSummaryChange(event.target.value)}
          />
        </div>
      </section>

      {touched && missing.length > 0 ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {missing.length} question{missing.length > 1 ? 's are' : ' question is'} still unanswered. The engine will not guess a
          severity.
        </p>
      ) : null}

      {errorSlot}

      <button type="submit" className="btn-primary w-full text-base" disabled={busy || missing.length > 0}>
        {busy ? 'Triaging the call…' : 'Triage this call'}
      </button>
    </form>
  );
}
