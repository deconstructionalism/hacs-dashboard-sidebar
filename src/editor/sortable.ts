import Sortable from 'sortablejs';

/**
 * Makes a list container reorderable by dragging its rows, reporting the moved
 * indices to `onEnd`. Dragging is limited to the given handle selector so nested
 * lists (a category's items) do not also drag their parent, and so row controls
 * stay clickable. `draggable` limits which children are reorderable (and which
 * are counted for the reported indices), so non-row children like an inline add
 * control are ignored.
 */
export function makeSortable(
  el: HTMLElement,
  onEnd: (from: number | undefined, to: number | undefined) => void,
  handle = '.drag',
  draggable = '.pv-drag',
): void {
  Sortable.create(el, {
    animation: 150,
    handle,
    draggable,
    onEnd: (evt) => onEnd(evt.oldIndex, evt.newIndex),
  });
}
