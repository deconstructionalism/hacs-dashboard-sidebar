import Sortable from 'sortablejs';

/**
 * Makes a list container reorderable by dragging its rows, reporting the moved
 * indices to `onEnd`. Dragging is limited to the given handle selector so nested
 * lists (a category's items) do not also drag their parent, and so row controls
 * stay clickable.
 */
export function makeSortable(
  el: HTMLElement,
  onEnd: (from: number | undefined, to: number | undefined) => void,
  handle = '.drag',
): void {
  Sortable.create(el, {
    animation: 150,
    handle,
    onEnd: (evt) => onEnd(evt.oldIndex, evt.newIndex),
  });
}
