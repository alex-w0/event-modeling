import { useEffect, useRef, useState } from 'react';
import { Boxes, Check, ChevronDown, ChevronRight, Pencil, Plus, X } from 'lucide-react';
import { BUILTIN_PRIMITIVES } from '../types';
import { useBoardTypes } from './TypesContext';
import AttributeEditor from './AttributeEditor';

interface TypesManagerProps {
  onClose: () => void;
}

const ICON_BUTTON = 'rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white';

/**
 * Management dialog for the board's type registry: the editable primitive list
 * and the reusable custom object types. A custom type's fields are themselves
 * attributes, so they're edited inline with the shared AttributeEditor.
 */
export default function TypesManager({ onClose }: TypesManagerProps) {
  const { customTypes, addCustomType, renameCustomType, updateCustomTypeAttributes, removeCustomType } =
    useBoardTypes();

  const [newType, setNewType] = useState('');
  const [typeError, setTypeError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [editingFields, setEditingFields] = useState<string | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [onClose]);

  useEffect(() => {
    if (renaming) {
      renameRef.current?.focus();
      renameRef.current?.select();
    }
  }, [renaming]);

  const addType = () => {
    const result = addCustomType(newType);
    if ('error' in result) {
      setTypeError(result.error);
      return;
    }
    setTypeError(null);
    setNewType('');
    setEditingFields(result.id);
  };

  const startRename = (id: string, name: string) => {
    setRenaming(id);
    setRenameDraft(name);
    setRenameError(null);
  };

  const commitRename = () => {
    if (!renaming) return;
    const error = renameCustomType(renaming, renameDraft);
    setRenameError(error);
    if (!error) setRenaming(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="dialog-backdrop absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="types-title"
        className="dialog-panel relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-black/60"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-400">
            <Boxes size={18} />
          </span>
          <div>
            <h2 id="types-title" className="text-sm font-semibold text-slate-100">
              Types
            </h2>
            <p className="text-xs text-slate-400">Primitives and reusable object types for element attributes.</p>
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          {/* Primitives — a fixed built-in set, shown for reference only. */}
          <section>
            <h3 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">Primitives</h3>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {BUILTIN_PRIMITIVES.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-slate-700 bg-slate-950/40 px-2 py-0.5 font-mono text-xs text-slate-200"
                >
                  {name}
                </span>
              ))}
            </div>
          </section>

          {/* Custom object types */}
          <section>
            <h3 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">Object types</h3>
            {customTypes.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {customTypes.map((type) => {
                  const expanded = editingFields === type.id;
                  return (
                    <li key={type.id} className="rounded-md border border-slate-800 bg-slate-950/40 px-2.5 py-1.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          title={expanded ? 'Hide fields' : 'Edit fields'}
                          aria-label={expanded ? 'Hide fields' : 'Edit fields'}
                          className="rounded p-0.5 text-slate-400 hover:text-slate-100"
                          onClick={() => setEditingFields(expanded ? null : type.id)}
                        >
                          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        {renaming === type.id ? (
                          <input
                            ref={renameRef}
                            value={renameDraft}
                            className="w-44 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-100 outline-none focus:border-indigo-400"
                            onChange={(event) => setRenameDraft(event.target.value)}
                            onKeyDown={(event) => {
                              event.stopPropagation();
                              if (event.key === 'Enter') commitRename();
                              if (event.key === 'Escape') setRenaming(null);
                            }}
                            onBlur={commitRename}
                          />
                        ) : (
                          <button
                            type="button"
                            className="text-sm font-medium text-slate-100 hover:text-white"
                            onClick={() => setEditingFields(expanded ? null : type.id)}
                          >
                            {type.name}
                            <span className="ml-1.5 text-xs font-normal text-slate-500">
                              {type.attributes.length} field{type.attributes.length === 1 ? '' : 's'}
                            </span>
                          </button>
                        )}
                        <span className="ml-auto flex items-center gap-0.5">
                          {renaming === type.id ? (
                            <button
                              type="button"
                              title="Apply rename"
                              aria-label="Apply rename"
                              className={ICON_BUTTON}
                              onMouseDown={commitRename}
                            >
                              <Check size={13} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              title={`Rename ${type.name}`}
                              aria-label={`Rename ${type.name}`}
                              className={ICON_BUTTON}
                              onClick={() => startRename(type.id, type.name)}
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            title={`Delete ${type.name}`}
                            aria-label={`Delete ${type.name}`}
                            className={ICON_BUTTON}
                            onClick={() => {
                              if (editingFields === type.id) setEditingFields(null);
                              removeCustomType(type.id);
                            }}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      </div>
                      {renaming === type.id && renameError && <p className="mt-1 text-xs text-red-400">{renameError}</p>}
                      {expanded && (
                        <div className="mt-2 border-t border-slate-800 pt-2">
                          <AttributeEditor
                            value={type.attributes}
                            onChange={(attrs) => updateCustomTypeAttributes(type.id, attrs)}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 rounded-md border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-500">
                No object types yet — add one below or create one while picking an attribute type.
              </p>
            )}
            <div className="mt-2 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <input
                  value={newType}
                  placeholder="New object type, e.g. LineItem"
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400"
                  onChange={(event) => {
                    setNewType(event.target.value);
                    setTypeError(null);
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === 'Enter') addType();
                  }}
                />
                {typeError && <p className="mt-1 text-xs text-red-400">{typeError}</p>}
              </div>
              <button
                type="button"
                className="flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
                onClick={addType}
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </section>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
