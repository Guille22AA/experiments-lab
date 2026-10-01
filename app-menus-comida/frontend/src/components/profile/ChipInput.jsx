// Editable list of short texts shown as chips (e.g. likes, dislikes).
import { Plus, X } from 'lucide-react';
import { useId, useState } from 'react';

export default function ChipInput({ label, values, onChange, placeholder }) {
  const [text, setText] = useState('');
  const inputId = useId();

  function add() {
    const value = text.trim();
    if (value && !values.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      onChange([...values, value]);
    }
    setText('');
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      {values.length > 0 && (
        <div className="chip-group">
          {values.map((value) => (
            <span key={value} className="chip">
              {value}
              <button
                type="button"
                className="chip-remove"
                onClick={() => onChange(values.filter((v) => v !== value))}
                aria-label={`Quitar ${value}`}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="inline-add">
        <input
          id={inputId}
          className="input"
          value={text}
          placeholder={placeholder}
          maxLength={120}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault(); // do not submit the whole form
              add();
            }
          }}
        />
        <button type="button" className="button secondary" onClick={add} aria-label={`Añadir a ${label}`}>
          <Plus size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
