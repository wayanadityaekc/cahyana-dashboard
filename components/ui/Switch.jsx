'use client';

// The public site's switch (TransferPicker's return toggle), same string: a
// hidden checkbox + a pill track whose knob follows peer-checked.
export default function Switch({ checked, onChange, disabled, label, id }) {
  return (
    <label className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="peer absolute opacity-0 w-0 h-0"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="w-10 h-[23px] rounded-pill bg-line relative shrink-0 transition-[background] duration-200 peer-checked:bg-gold peer-focus-visible:[box-shadow:var(--focus-ring)] after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:w-[17px] after:h-[17px] after:rounded-[50%] after:bg-white after:transition-[left] after:duration-200 peer-checked:after:left-[20px]" />
    </label>
  );
}

