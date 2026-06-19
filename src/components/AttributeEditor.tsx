import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { Attribute, AttributeType } from '../types';
import { BUILTIN_PRIMITIVES } from '../types';
import TypePicker from './TypePicker';

/** New attribute rows start as the first built-in primitive. */
const DEFAULT_TYPE: AttributeType = { kind: 'primitive', name: BUILTIN_PRIMITIVES[0] };

interface AttributeEditorProps {
  value: Attribute[];
  onChange: (next: Attribute[]) => void;
}

/**
 * Editor for a list of typed attributes — used both for an element's payload
 * and for a custom type's fields. Each row is a name plus a type picker; rows
 * can be reordered and removed. Blank-name rows are dropped on save by callers.
 */
export default function AttributeEditor({ value, onChange }: AttributeEditorProps) {
  const setItem = (index: number, item: Attribute) => onChange(value.map((cur, i) => (i === index ? item : cur)));
  const add = () => onChange([...value, { name: '', type: DEFAULT_TYPE }]);
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));
  const move = (index: number, delta: number) => {
    const next = [...value];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div>
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((attr, index) => (
            <li key={index} className="flex items-center gap-1">
              <div className="flex flex-col">
                <button
                  type="button"
                  title="Move up"
                  aria-label="Move up"
                  disabled={index === 0}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  title="Move down"
                  aria-label="Move down"
                  disabled={index === value.length - 1}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={12} />
                </button>
              </div>

              <input
                value={attr.name}
                placeholder="name"
                className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 font-mono text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400"
                onChange={(event) => setItem(index, { ...attr, name: event.target.value })}
                onKeyDown={(event) => event.stopPropagation()}
              />
              <TypePicker value={attr.type} onChange={(type) => setItem(index, { ...attr, type })} />

              <button
                type="button"
                title="Remove"
                aria-label="Remove"
                className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-rose-300"
                onClick={() => remove(index)}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
        onClick={add}
      >
        <Plus size={12} /> Attribute
      </button>
    </div>
  );
}
