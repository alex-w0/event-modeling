import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Attribute, BoardEdge, BoardNode, CustomType } from '../types';
import { isAttributeKind } from '../types';
import { sanitizeCustomTypes, stampDeletedType } from '../lib/schema';
import { loadBoard } from '../lib/persistence';
import { nextId } from '../lib/id';
import TypesManager from './TypesManager';

interface TypesApi {
  /** Board-level registry of reusable custom object types. */
  customTypes: CustomType[];
  /** Mints a custom type and returns its id, or an error message if the name is invalid/taken. */
  addCustomType: (name: string) => { id: string } | { error: string };
  /** Returns an error message, or null on success. */
  renameCustomType: (id: string, newName: string) => string | null;
  updateCustomTypeAttributes: (id: string, attributes: Attribute[]) => void;
  /** Removes a custom type; references to it become dangling and render as "(deleted type)". */
  removeCustomType: (id: string) => void;
  /** Replaces the whole registry (import / clear board). */
  replaceSchema: (customTypes: CustomType[]) => void;
  openManager: () => void;
}

const TypesApiContext = createContext<TypesApi | null>(null);

export function useBoardTypes(): TypesApi {
  const api = useContext(TypesApiContext);
  if (!api) throw new Error('useBoardTypes must be used inside <TypesProvider>');
  return api;
}

/**
 * Owns the board's reusable custom object types, restored from the same
 * autosave entry as the nodes/edges/contexts, and hosts the management dialog.
 * Primitive value types are a fixed built-in set (see BUILTIN_PRIMITIVES), not
 * user-editable, so only object types live here. Deleting a custom type leaves
 * references dangling (resolved to a placeholder at render) rather than
 * rewriting every element, mirroring the GWT dangling-reference behavior.
 */
export function TypesProvider({ children }: { children: ReactNode }) {
  const persisted = useMemo(loadBoard, []);
  const [customTypes, setCustomTypes] = useState<CustomType[]>(() => persisted?.customTypes ?? []);
  const [managerOpen, setManagerOpen] = useState(false);
  const { setNodes } = useReactFlow<BoardNode, BoardEdge>();

  const customNameError = useCallback(
    (name: string, ignoreId?: string): string | null => {
      if (name.length === 0) return 'Name cannot be empty.';
      const lower = name.toLowerCase();
      if (customTypes.some((t) => t.id !== ignoreId && t.name.toLowerCase() === lower)) {
        return 'A type with this name already exists.';
      }
      return null;
    },
    [customTypes],
  );

  const addCustomType = useCallback(
    (raw: string): { id: string } | { error: string } => {
      const name = raw.trim();
      const error = customNameError(name);
      if (error) return { error };
      const id = nextId('type');
      setCustomTypes((list) => [...list, { id, name, attributes: [] }]);
      return { id };
    },
    [customNameError],
  );

  const renameCustomType = useCallback(
    (id: string, raw: string): string | null => {
      const name = raw.trim();
      const error = customNameError(name, id);
      if (error) return error;
      setCustomTypes((list) => list.map((t) => (t.id === id ? { ...t, name } : t)));
      return null;
    },
    [customNameError],
  );

  const updateCustomTypeAttributes = useCallback((id: string, attributes: Attribute[]) => {
    setCustomTypes((list) => list.map((t) => (t.id === id ? { ...t, attributes } : t)));
  }, []);

  // Deleting a type stamps its current name onto every reference (in element
  // attributes and in other custom types' fields) so dangling refs still show
  // what they pointed at, mirroring the board's GWT onNodesDelete behavior.
  const removeCustomType = useCallback(
    (id: string) => {
      const name = customTypes.find((t) => t.id === id)?.name ?? '';
      setCustomTypes((list) =>
        list
          .filter((t) => t.id !== id)
          .map((t) => {
            const attributes = stampDeletedType(t.attributes, id, name);
            return attributes === t.attributes ? t : { ...t, attributes };
          }),
      );
      setNodes((nds) =>
        nds.map((node) => {
          if (!isAttributeKind(node.type) || !node.data.attributes) return node;
          const attributes = stampDeletedType(node.data.attributes, id, name);
          return attributes === node.data.attributes ? node : { ...node, data: { ...node.data, attributes } };
        }),
      );
    },
    [customTypes, setNodes],
  );

  const replaceSchema = useCallback((nextCustomTypes: CustomType[]) => {
    setCustomTypes(sanitizeCustomTypes(nextCustomTypes));
  }, []);

  const openManager = useCallback(() => setManagerOpen(true), []);

  const api = useMemo<TypesApi>(
    () => ({
      customTypes,
      addCustomType,
      renameCustomType,
      updateCustomTypeAttributes,
      removeCustomType,
      replaceSchema,
      openManager,
    }),
    [customTypes, addCustomType, renameCustomType, updateCustomTypeAttributes, removeCustomType, replaceSchema, openManager],
  );

  return (
    <TypesApiContext.Provider value={api}>
      {children}
      {managerOpen && <TypesManager onClose={() => setManagerOpen(false)} />}
    </TypesApiContext.Provider>
  );
}
