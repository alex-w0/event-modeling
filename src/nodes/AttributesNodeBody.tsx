import type { Attribute } from '../types';
import { isTypeDeleted, typeLabel } from '../lib/schema';
import { useBoardTypes } from '../components/TypesContext';

/**
 * Read-only list of an element's typed attributes, one `name: Type` line each.
 * Custom object types are shown by name only (their full shape lives in the
 * type registry) so cards stay compact and rendering can't recurse. Object
 * refs resolve live via the registry, so renames/deletes reflect immediately.
 * Rows are <li> so the card's overflow-line counter measures them like before.
 */
export default function AttributesNodeBody({ attributes }: { attributes: Attribute[] }) {
  const { customTypes } = useBoardTypes();
  if (attributes.length === 0) return null;
  return (
    <ul className="mt-1.5 space-y-0.5 border-t border-black/15 pt-1.5 font-mono text-[10px] leading-tight opacity-80">
      {attributes.map((attr, index) => (
        <li key={index} className="break-words">
          {attr.name}
          <span className={isTypeDeleted(attr.type, customTypes) ? 'italic line-through opacity-50' : 'opacity-60'}>
            : {typeLabel(attr.type, customTypes)}
          </span>
        </li>
      ))}
    </ul>
  );
}
