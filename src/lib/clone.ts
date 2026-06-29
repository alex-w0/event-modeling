import type { XYPosition } from '@xyflow/react';
import type { BoardEdge, BoardNode } from '../types';
import { nextId } from './id';
import { cellOfChild, cellSlotPosition, findFreeCell } from './grid';

/** Offset between an original and its clone, matching the palette click-cascade step. */
export const CLONE_OFFSET: XYPosition = { x: 28, y: 28 };

/** Absolute flow-space position of a node (slices are never nested, so a child's is parent + relative). */
function absolutePosition(node: BoardNode, byId: Map<string, BoardNode>): XYPosition {
  if (!node.parentId) return node.position;
  const parent = byId.get(node.parentId);
  if (!parent) return node.position;
  return { x: parent.position.x + node.position.x, y: parent.position.y + node.position.y };
}

/**
 * Clones a selection of nodes (and the arrows between them) into new nodes/edges
 * with fresh ids. Used both by the per-node copy button (source === target === the
 * live board) and by keyboard paste (source is the in-app clipboard buffer).
 *
 * Behavior:
 *  - Slices bring all their children along, even children not individually selected.
 *  - A slice clone keeps its children's relative cell positions; the slice itself is
 *    offset by `CLONE_OFFSET * offsetSteps`.
 *  - A lone slotted element whose parent slice is NOT being cloned stays in that slice,
 *    snapping into its nearest free cell (or floats if the slice is full).
 *  - A floating element clone is offset by `CLONE_OFFSET * offsetSteps`.
 *  - Edges are recreated only when BOTH endpoints are in the clone set; arrows to
 *    elements outside the selection are dropped.
 *
 * `target` is the live board, consulted only for cell occupancy.
 */
export function cloneSelection(
  sourceIds: string[],
  source: BoardNode[],
  sourceEdges: BoardEdge[],
  target: BoardNode[],
  offsetSteps = 1,
): { nodes: BoardNode[]; edges: BoardEdge[] } {
  const sourceById = new Map(source.map((node) => [node.id, node]));
  const idSet = new Set(sourceIds);
  const clonedSlices = new Set(
    source.filter((node) => node.type === 'slice' && idSet.has(node.id)).map((node) => node.id),
  );

  // Clone set: explicitly selected nodes plus every child of a selected slice.
  const toClone = source.filter(
    (node) => idSet.has(node.id) || (node.parentId !== undefined && clonedSlices.has(node.parentId)),
  );
  if (toClone.length === 0) return { nodes: [], edges: [] };

  const remap = new Map<string, string>();
  for (const node of toClone) remap.set(node.id, nextId(node.type ?? 'node'));

  const dx = CLONE_OFFSET.x * offsetSteps;
  const dy = CLONE_OFFSET.y * offsetSteps;

  const clones: BoardNode[] = [];
  for (const node of toClone) {
    const clone: BoardNode = {
      ...node,
      id: remap.get(node.id)!,
      selected: true,
      data: structuredClone(node.data),
    };

    const parentCloned = node.parentId !== undefined && remap.has(node.parentId);
    if (parentCloned) {
      // Child of a cloned slice: ride along with the offset parent, same cell.
      clone.parentId = remap.get(node.parentId!);
      clone.extent = undefined;
    } else if (node.parentId !== undefined) {
      // Lone slotted element: keep it in its (uncloned) slice if that slice still exists.
      const slice = target.find((candidate) => candidate.id === node.parentId);
      const free = slice
        ? findFreeCell(
            [...target, ...clones],
            slice,
            cellOfChild(node),
            new Set(clones.map((created) => created.id)),
          )
        : null;
      if (slice && free) {
        clone.parentId = slice.id;
        clone.extent = undefined;
        clone.position = cellSlotPosition(free);
      } else {
        // Slice full or gone: detach and float, offset from the original's absolute spot.
        const absolute = absolutePosition(node, sourceById);
        clone.parentId = undefined;
        clone.extent = undefined;
        clone.position = { x: absolute.x + dx, y: absolute.y + dy };
      }
    } else {
      // Free-floating node (or a slice): offset from its current position.
      clone.position = { x: node.position.x + dx, y: node.position.y + dy };
    }

    clones.push(clone);
  }

  // Internal edges only: both endpoints must be part of the clone set.
  const edges: BoardEdge[] = [];
  for (const edge of sourceEdges) {
    const newSource = remap.get(edge.source);
    const newTarget = remap.get(edge.target);
    if (newSource === undefined || newTarget === undefined) continue;
    edges.push({ ...edge, id: nextId('edge'), source: newSource, target: newTarget, selected: false });
  }

  return { nodes: clones, edges };
}
