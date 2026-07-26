import Sortable from 'sortablejs';

/**
 * Makes a list container reorderable by dragging its rows, reporting the moved
 * indices to `onEnd`. Dragging is limited to each row's `.drag` handle so the
 * row's buttons stay clickable.
 */
export function makeSortable(
  el: HTMLElement,
  onEnd: (from: number | undefined, to: number | undefined) => void,
): void {
  Sortable.create(el, {
    animation: 150,
    handle: '.drag',
    onEnd: (evt) => onEnd(evt.oldIndex, evt.newIndex),
  });
}
