import type { ComponentChildren } from 'preact';

/* ── Segmented control, for mode switches like Quality / Target size ──────── */

export interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedProps<T>) {
  return (
    <div class="field">
      {label && <span class="label">{label}</span>}
      <div class="segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Slider with a live numeric readout ──────────────────────────────────── */

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  hint?: string;
  onChange: (value: number) => void;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  hint,
  onChange,
}: SliderProps) {
  const id = `slider-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div class="field">
      <div class="field__row">
        <label for={id}>{label}</label>
        <output class="mono" for={id}>
          {value}
          {suffix}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(e) => onChange(Number((e.currentTarget as HTMLInputElement).value))}
      />
      {hint && <span class="field__hint">{hint}</span>}
    </div>
  );
}

/* ── Number field ────────────────────────────────────────────────────────── */

export interface NumberFieldProps {
  label: string;
  value: number | '';
  min?: number;
  max?: number;
  suffix?: string;
  hint?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export function NumberField({
  label,
  value,
  min,
  max,
  suffix,
  hint,
  disabled,
  onChange,
}: NumberFieldProps) {
  const id = `num-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div class="field">
      <label for={id}>{label}</label>
      <div class="input-group">
        <input
          id={id}
          type="number"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onInput={(e) => {
            const raw = (e.currentTarget as HTMLInputElement).value;
            if (raw === '') return;
            onChange(Number(raw));
          }}
        />
        {suffix && <span class="input-group__suffix">{suffix}</span>}
      </div>
      {hint && <span class="field__hint">{hint}</span>}
    </div>
  );
}

/* ── Text field ──────────────────────────────────────────────────────────── */

export interface TextFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  hint?: string;
  onChange: (value: string) => void;
}

export function TextField({ label, value, placeholder, hint, onChange }: TextFieldProps) {
  const id = `txt-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div class="field">
      <label for={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onInput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
      />
      {hint && <span class="field__hint">{hint}</span>}
    </div>
  );
}

/* ── Colour picker with a hex field beside it ────────────────────────────── */

export interface ColorFieldProps {
  label: string;
  value: string;
  hint?: string;
  onChange: (value: string) => void;
  presets?: string[];
}

export function ColorField({ label, value, hint, onChange, presets }: ColorFieldProps) {
  const id = `col-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div class="field">
      <label for={id}>{label}</label>
      <div class="color-field">
        <input
          id={id}
          type="color"
          value={value}
          onInput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
        />
        <input
          type="text"
          class="color-field__hex mono"
          value={value}
          onInput={(e) => {
            const next = (e.currentTarget as HTMLInputElement).value;
            if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next);
          }}
        />
        {presets && (
          <div class="color-field__presets">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                class="color-swatch"
                style={{ background: preset }}
                aria-label={`Use ${preset}`}
                onClick={() => onChange(preset)}
              />
            ))}
          </div>
        )}
      </div>
      {hint && <span class="field__hint">{hint}</span>}
    </div>
  );
}

/* ── Checkbox ────────────────────────────────────────────────────────────── */

export interface CheckboxProps {
  label: string;
  checked: boolean;
  hint?: string;
  onChange: (checked: boolean) => void;
}

export function Checkbox({ label, checked, hint, onChange }: CheckboxProps) {
  return (
    <div class="field">
      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)}
        />
        <span>{label}</span>
      </label>
      {hint && <span class="field__hint" style="margin-left: 29px">{hint}</span>}
    </div>
  );
}

/* ── Select ──────────────────────────────────────────────────────────────── */

export interface SelectFieldProps<T extends string | number> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  hint?: string;
  onChange: (value: string) => void;
}

export function SelectField<T extends string | number>({
  label,
  value,
  options,
  hint,
  onChange,
}: SelectFieldProps<T>) {
  const id = `sel-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div class="field">
      <label for={id}>{label}</label>
      <select
        id={id}
        value={String(value)}
        onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value)}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <span class="field__hint">{hint}</span>}
    </div>
  );
}

/* ── Layout helpers ──────────────────────────────────────────────────────── */

export function ControlGrid({ children }: { children: ComponentChildren }) {
  return <div class="control-grid">{children}</div>;
}

export function ControlRow({ children }: { children: ComponentChildren }) {
  return <div class="control-row">{children}</div>;
}
