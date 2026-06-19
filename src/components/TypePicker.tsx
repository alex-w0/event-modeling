import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, Check, ChevronsUpDown, Plus, Search } from 'lucide-react';
import type { AttributeType, ScalarType } from '../types';
import { BUILTIN_PRIMITIVES } from '../types';
import { typeLabel } from '../lib/schema';
import { useBoardTypes } from './TypesContext';

interface TypePickerProps {
  value: AttributeType;
  onChange: (next: AttributeType) => void;
}

const POPOVER_WIDTH = 224;
const DESIRED_HEIGHT = 360;
const VIEWPORT_MARGIN = 8;

interface PopoverPosition {
  left: number;
  top: number;
  maxHeight: number;
}

/**
 * Type picker for one attribute. The trigger shows the current type's label
 * (e.g. `Uuid`, `LineItem`, `Money[]`). Opening it reveals an "Array of"
 * toggle plus searchable lists of the built-in primitives and the board's
 * custom object types, and an inline action to create a new object type.
 *
 * The popover renders in a portal with fixed, viewport-aware positioning so it
 * escapes any `overflow` ancestor (e.g. the scrollable types manager) instead
 * of being clipped. Creation is inline (not via the shared prompt dialog) so
 * it can't trip the element editor's global Escape handler.
 */
export default function TypePicker({ value, onChange }: TypePickerProps) {
  const { customTypes, addCustomType } = useBoardTypes();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [pos, setPos] = useState<PopoverPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<HTMLInputElement>(null);

  const isArray = value.kind === 'array';
  const scalar: ScalarType = isArray ? value.of : value;

  const reset = () => {
    setOpen(false);
    setQuery('');
    setCreating(false);
    setDraft('');
    setCreateError(null);
  };

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - VIEWPORT_MARGIN;
    const spaceAbove = r.top - VIEWPORT_MARGIN;
    const openUp = spaceBelow < DESIRED_HEIGHT && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(DESIRED_HEIGHT, openUp ? spaceAbove : spaceBelow));
    const left = Math.max(VIEWPORT_MARGIN, Math.min(r.left, window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN));
    const top = openUp ? r.top - 4 - maxHeight : r.bottom + 4;
    setPos({ left, top, maxHeight });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();
    searchRef.current?.focus();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) reset();
    };
    // Reposition on any scroll (capture catches the manager's inner scroll too) or resize.
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (creating) draftRef.current?.focus();
  }, [creating]);

  const q = query.trim().toLowerCase();
  const filteredPrimitives = useMemo(
    () => (q ? BUILTIN_PRIMITIVES.filter((p) => p.toLowerCase().includes(q)) : BUILTIN_PRIMITIVES),
    [q],
  );
  const filteredTypes = useMemo(
    () => (q ? customTypes.filter((t) => t.name.toLowerCase().includes(q)) : customTypes),
    [customTypes, q],
  );

  const choose = (next: ScalarType) => {
    onChange(isArray ? { kind: 'array', of: next } : next);
    reset();
  };

  const toggleArray = () => {
    onChange(isArray ? value.of : { kind: 'array', of: value });
  };

  const startCreate = () => {
    setCreating(true);
    setDraft(query);
    setCreateError(null);
  };

  const commitCreate = () => {
    const result = addCustomType(draft);
    if ('error' in result) {
      setCreateError(result.error);
      return;
    }
    choose({ kind: 'object', ref: result.id, name: draft.trim() });
  };

  const isSelected = (candidate: ScalarType) =>
    scalar.kind === candidate.kind &&
    (candidate.kind === 'primitive'
      ? scalar.kind === 'primitive' && scalar.name === candidate.name
      : scalar.kind === 'object' && scalar.ref === candidate.ref);

  return (
    <div className="w-40 shrink-0">
      <button
        ref={triggerRef}
        type="button"
        className="flex w-full items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-left text-sm text-slate-100 outline-none hover:border-slate-500 focus:border-indigo-400"
        onClick={() => (open ? reset() : setOpen(true))}
      >
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{typeLabel(value, customTypes)}</span>
        <ChevronsUpDown size={14} className="shrink-0 text-slate-400" />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[60] flex flex-col overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-xl shadow-black/50"
            style={{ left: pos.left, top: pos.top, width: POPOVER_WIDTH, maxHeight: pos.maxHeight }}
          >
            <div className="flex shrink-0 items-center gap-1.5 border-b border-slate-700 px-2">
              <Search size={13} className="shrink-0 text-slate-500" />
              <input
                ref={searchRef}
                value={query}
                placeholder="Search types…"
                className="w-full bg-transparent py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
              />
            </div>

            <label className="flex shrink-0 cursor-pointer items-center gap-2 border-b border-slate-800 px-2.5 py-1.5 text-xs text-slate-300">
              <input type="checkbox" checked={isArray} onChange={toggleArray} className="accent-indigo-500" />
              Array of…
            </label>

            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {filteredPrimitives.length > 0 && (
                <p className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                  Primitives
                </p>
              )}
              {filteredPrimitives.map((name) => {
                const candidate: ScalarType = { kind: 'primitive', name };
                return (
                  <button
                    key={`p:${name}`}
                    type="button"
                    className={`flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-sm hover:bg-slate-800 ${
                      isSelected(candidate) ? 'bg-slate-800/60' : ''
                    }`}
                    onClick={() => choose(candidate)}
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-100">{name}</span>
                    {isSelected(candidate) && <Check size={14} className="shrink-0 text-indigo-400" />}
                  </button>
                );
              })}

              {filteredTypes.length > 0 && (
                <p className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                  Object types
                </p>
              )}
              {filteredTypes.map((type) => {
                const candidate: ScalarType = { kind: 'object', ref: type.id, name: type.name };
                return (
                  <button
                    key={`o:${type.id}`}
                    type="button"
                    className={`flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-sm hover:bg-slate-800 ${
                      isSelected(candidate) ? 'bg-slate-800/60' : ''
                    }`}
                    onClick={() => choose(candidate)}
                  >
                    <Box size={13} className="shrink-0 text-indigo-400" />
                    <span className="min-w-0 flex-1 truncate text-slate-100">{type.name}</span>
                    {isSelected(candidate) && <Check size={14} className="shrink-0 text-indigo-400" />}
                  </button>
                );
              })}

              {filteredPrimitives.length === 0 && filteredTypes.length === 0 && (
                <p className="px-2.5 py-2 text-xs text-slate-500">No matching types.</p>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-700 p-1.5">
              {creating ? (
                <div>
                  <input
                    ref={draftRef}
                    value={draft}
                    placeholder="New object type, e.g. LineItem"
                    className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400"
                    onChange={(event) => {
                      setDraft(event.target.value);
                      setCreateError(null);
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === 'Enter') commitCreate();
                      if (event.key === 'Escape') setCreating(false);
                    }}
                  />
                  {createError && <p className="mt-1 px-0.5 text-xs text-red-400">{createError}</p>}
                  <div className="mt-1.5 flex justify-end gap-1.5">
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs font-medium text-slate-400 hover:text-slate-200"
                      onClick={() => setCreating(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded bg-indigo-500 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-400"
                      onClick={commitCreate}
                    >
                      Create &amp; select
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white"
                  onClick={startCreate}
                >
                  <Plus size={12} /> New object type
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
