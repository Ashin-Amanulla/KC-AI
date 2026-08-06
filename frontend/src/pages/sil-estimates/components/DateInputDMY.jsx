import { useState, useEffect } from 'react';

export function DateInputDMY({ value, onChange, className, placeholder }) {
  const fmtDMY = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return '';
    return `${d}/${m}/${y}`;
  };

  const [text, setText] = useState(fmtDMY(value));

  useEffect(() => {
    setText(fmtDMY(value));
  }, [value]);

  function handleChange(e) {
    const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(formatted);

    if (digits.length === 8) {
      const d = Number(digits.slice(0, 2));
      const m = Number(digits.slice(2, 4));
      const y = Number(digits.slice(4, 8));
      const iso = `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
      const test = new Date(iso + 'T00:00:00Z');
      const isReal =
        !isNaN(test) &&
        test.getUTCFullYear() === y &&
        test.getUTCMonth() + 1 === m &&
        test.getUTCDate() === d;
      if (isReal) onChange(iso);
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder={placeholder || 'DD/MM/YYYY'}
      value={text}
      onChange={handleChange}
      className={className}
    />
  );
}
