import type { Attribute, AttributeType, CustomType, ScalarType } from '../types';

/** A scalar survives if it's a non-empty primitive name or an object ref to any id (dangling refs are kept). */
function sanitizeScalar(value: unknown): ScalarType | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.kind === 'primitive' && typeof v.name === 'string' && v.name.trim().length > 0) {
    return { kind: 'primitive', name: v.name.trim() };
  }
  if (v.kind === 'object' && typeof v.ref === 'string' && v.ref.length > 0) {
    const scalar: ScalarType = { kind: 'object', ref: v.ref };
    if (typeof v.name === 'string' && v.name.length > 0) scalar.name = v.name;
    return scalar;
  }
  return null;
}

function sanitizeAttributeType(value: unknown): AttributeType | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.kind === 'array') {
    const of = sanitizeScalar(v.of);
    return of ? { kind: 'array', of } : null;
  }
  return sanitizeScalar(value);
}

/** Validates an attribute list, dropping rows without a name or a valid type. Object refs are kept even if dangling. */
export function sanitizeAttributes(value: unknown): Attribute[] {
  if (!Array.isArray(value)) return [];
  const result: Attribute[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const name = typeof e.name === 'string' ? e.name.trim() : '';
    const type = sanitizeAttributeType(e.type);
    if (name.length === 0 || !type) continue;
    result.push({ name, type });
  }
  return result;
}

/** Validates the board-level custom-type registry, dropping malformed/duplicate-id entries. */
export function sanitizeCustomTypes(value: unknown): CustomType[] {
  if (!Array.isArray(value)) return [];
  const result: CustomType[] = [];
  const seenIds = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== 'string' || e.id.length === 0 || seenIds.has(e.id)) continue;
    const name = typeof e.name === 'string' ? e.name.trim() : '';
    if (name.length === 0) continue;
    seenIds.add(e.id);
    result.push({ id: e.id, name, attributes: sanitizeAttributes(e.attributes) });
  }
  return result;
}

/**
 * A custom object type's display name. Prefers the live registry; falls back to
 * the cached snapshot name with a "(deleted)" marker so a deleted type still
 * shows what it was, mirroring GWT's deleted-reference rendering.
 */
function scalarLabel(type: ScalarType, types: CustomType[]): string {
  if (type.kind === 'primitive') return type.name;
  const live = types.find((t) => t.id === type.ref);
  if (live) return live.name;
  return type.name ? `${type.name} (deleted)` : '(deleted type)';
}

/** Human-readable label for an attribute type, e.g. `Uuid`, `LineItem`, `Money[]`, `LineItem (deleted)`. */
export function typeLabel(type: AttributeType, types: CustomType[]): string {
  return type.kind === 'array' ? `${scalarLabel(type.of, types)}[]` : scalarLabel(type, types);
}

/** Whether a type references a custom object type that no longer exists in the registry. */
export function isTypeDeleted(type: AttributeType, types: CustomType[]): boolean {
  const scalar = type.kind === 'array' ? type.of : type;
  return scalar.kind === 'object' && !types.some((t) => t.id === scalar.ref);
}

/**
 * Stamps `deletedName` onto every object ref pointing at `deletedId`, so the
 * reference keeps showing the type's name after its definition is removed.
 * Returns the original array unchanged when nothing matched (stable identity
 * avoids needless re-renders), mirroring the GWT delete-stamp behavior.
 */
export function stampDeletedType(attributes: Attribute[], deletedId: string, deletedName: string): Attribute[] {
  let changed = false;
  const stampScalar = (s: ScalarType): ScalarType => {
    if (s.kind === 'object' && s.ref === deletedId && s.name !== deletedName) {
      changed = true;
      return { ...s, name: deletedName };
    }
    return s;
  };
  const next = attributes.map((attr) => {
    if (attr.type.kind === 'array') {
      const of = stampScalar(attr.type.of);
      return of === attr.type.of ? attr : { ...attr, type: { kind: 'array' as const, of } };
    }
    const scalar = stampScalar(attr.type);
    return scalar === attr.type ? attr : { ...attr, type: scalar };
  });
  return changed ? next : attributes;
}
