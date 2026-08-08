import { css } from 'lit';

/** Styles for the editor modal (extracted from the component). */
export const editorStyles = css`
  :host {
    position: fixed;
    inset: 0;
    z-index: 100;
    /* Center via flexbox rather than a transform on the panel: a transformed
         ancestor would become the containing block for the preview's
         fixed-position popovers and tooltips, throwing off their placement. */
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--ha-font-family-body, sans-serif);
    color: var(--primary-text-color, #212121);

    /* A subtly distinct surface shared by the active tab and the content
         area, so the two read as one region against the modal background. */
    --dsb-surface: color-mix(in srgb, var(--primary-text-color, #212121) 6%, transparent);
  }

  /* No focus/selection outlines on the modal's own controls. */
  :focus,
  :focus-visible {
    outline: none;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / 45%);
  }

  .panel {
    position: relative;
    z-index: 1;
    width: min(820px, 94vw);
    height: 75vh;
    display: flex;
    flex-direction: column;
    /* Composite the (often translucent) card color over an opaque base so the
         dashboard never shows through the modal, plus the surface tint on top so
         the modal is the tinted colour and the tab/content area is the base. */
    background-color: var(--primary-background-color, #fff);
    background-image:
      linear-gradient(var(--dsb-surface), var(--dsb-surface)),
      linear-gradient(var(--card-background-color, #fff), var(--card-background-color, #fff));
    border-radius: 12px;
    box-shadow: 0 8px 40px rgb(0 0 0 / 40%);
    overflow: hidden;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 2px;
  }

  header h2 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 600;
  }

  .content {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 12px;
    /* Clip here; the columns inside scroll independently. */
    overflow: hidden;
    background-color: var(--primary-background-color, #fff);
    background-image: linear-gradient(
      var(--card-background-color, #fff),
      var(--card-background-color, #fff)
    );
  }

  .tabs {
    display: flex;
    gap: 4px;
    padding: 2px 12px 0;
    flex-wrap: wrap;
  }

  .tab {
    font: inherit;
    padding: 6px 12px;
    border: none;
    border-radius: 8px 8px 0 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
  }

  .tab.active {
    background-color: var(--primary-background-color, #fff);
    background-image: linear-gradient(
      var(--card-background-color, #fff),
      var(--card-background-color, #fff)
    );
    opacity: 1;
    font-weight: 600;
  }

  .settings {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }

  .icon-choice {
    display: flex;
    gap: 6px;
  }

  .choice {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 18px;
    border: 1px solid var(--divider-color, rgb(0 0 0 / 20%));
    border-radius: 8px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .choice ha-icon {
    --mdc-icon-size: 24px;
  }

  .choice-label {
    font-size: 0.75rem;
  }

  .choice.sel {
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
    border-color: transparent;
  }

  /* When open, space the fields inside the section like the top-level form.
       In browsers that wrap the content in ::details-content, the fields are
       inside that box, so it must carry the gap too (the details-level flex
       there only spaces the summary from the content box). */
  .advanced[open] {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* stylelint-disable-next-line selector-pseudo-element-no-unknown */
  .advanced[open]::details-content {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .advanced {
    margin-top: 4px;
  }

  .advanced summary {
    cursor: pointer;
    font-size: 0.8rem;
    opacity: 0.7;
  }

  .region {
    margin-bottom: 16px;
  }

  /* The editor fills the width; the preview shrinks to just the sidebar frame
       so it never reserves half the modal. Stacks on mobile via the media query
       below. */
  .split {
    display: flex;
    gap: 20px;
    align-items: stretch;
    flex: 1 1 auto;
    min-height: 0;
  }

  .editor,
  .preview {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* Shrink to the framed preview's own (capped) width. */
  .preview {
    flex: 0 0 auto;
  }

  /* Fill the space left of the preview. */
  .editor {
    flex: 1 1 auto;
    gap: 10px;
    /* Scrolls independently of the preview. Inset the content on the right so
         an overlay scrollbar (macOS "show when scrolling") sits clear of the
         form controls instead of over them, plus a thin styled bar. */
    overflow-y: auto;
    padding-right: 12px;
    scrollbar-width: thin;
    scrollbar-color: var(--divider-color, rgb(0 0 0 / 30%)) transparent;
  }

  .editor::-webkit-scrollbar {
    width: 6px;
  }

  .editor::-webkit-scrollbar-thumb {
    border-radius: 3px;
    background: var(--divider-color, rgb(0 0 0 / 30%));
  }

  .editor::-webkit-scrollbar-track {
    background: transparent;
  }

  /* Collapsed (non-mobile): the editor grows to fill and the preview shrinks
       to just what the icon strip needs, pinned to the modal's right edge. No
       flex-wrap, so it never drops below. */
  .split.pv-collapsed .editor {
    flex: 1 1 auto;
  }

  .split.pv-collapsed .preview {
    flex: 0 0 auto;
  }

  .split.pv-collapsed .preview-head {
    justify-content: flex-end;
    gap: 8px;
  }

  .preview-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
    /* Pin the Preview label + collapse toggle so they stay in view when the
         whole content scrolls as one (stacked layout). A no-op on wide layouts,
         where the preview column already sits above its own scroll frame. */
    position: sticky;
    top: 0;
    z-index: 2;
    background-color: var(--primary-background-color, #fff);
    background-image: linear-gradient(
      var(--card-background-color, #fff),
      var(--card-background-color, #fff)
    );
  }

  .preview-title {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.6;
  }

  .pv-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
  }

  .pv-toggle:hover {
    opacity: 1;
    background: var(--secondary-background-color, rgb(0 0 0 / 6%));
  }

  .pv-toggle ha-icon {
    --mdc-icon-size: 18px;
  }

  /* Expanded preview width: capped to the configured width and to a fraction
       under half the modal so it never dominates the side-by-side layout. The
       380px / 42vw caps must match PREVIEW_CAP_PX / PREVIEW_CAP_VW. */
  .pv-frame:not(.collapsed) {
    width: min(var(--pv-w, 100%), 380px, 42vw);
  }

  .pv-frame {
    box-sizing: border-box;
    /* A little vertical room so the first/last element's selection outline is
         not clipped by the scroll container's edge. */
    padding: 4px 0;
    /* Draw the frame edge with an inset outline, not a border, so it takes no
         layout width: the inner sidebar then gets the full configured width and
         the footer's button-overflow count matches live exactly. */
    outline: 1px solid var(--divider-color, rgb(0 0 0 / 15%));
    outline-offset: -1px;
    background: var(--card-background-color, #fff);
    /* Fill the preview height and scroll on its own, below the fixed heading. */
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    /* Hide the scrollbar so it reserves no width (which would shrink the
         content below the live width and change the footer overflow count);
         wheel/trackpad scrolling still works. */
    scrollbar-width: none;
  }

  .pv-frame::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  /* Collapsed preview: narrow to the icon-strip width, pinned to the right
       edge of the (content-sized) preview column. */
  .pv-frame.collapsed {
    width: 76px;
    align-self: flex-end;
  }

  /* Column frame used by the header/footer previews so the region can be
       pinned to one edge with a faded placeholder filling the rest. */
  .pv-frame.pv-col {
    display: flex;
    flex-direction: column;
  }

  /* Skeleton placeholder rows standing in for the content beside a pinned
       region, faded out toward the far edge. */
  .pv-ghost {
    flex: 1 1 auto;
    min-height: 48px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 10px 16px;
    overflow: hidden;
    pointer-events: none;
  }

  .pv-ghost.fade-up {
    justify-content: flex-end;
    mask-image: linear-gradient(to top, #000 15%, transparent 95%);
  }

  .pv-ghost.fade-down {
    justify-content: flex-start;
    mask-image: linear-gradient(to bottom, #000 15%, transparent 95%);
  }

  .ghost-row {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 10px;
  }

  .ghost-icon {
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: var(--divider-color, rgb(0 0 0 / 15%));
  }

  .ghost-bar {
    height: 12px;
    border-radius: 6px;
    background: var(--divider-color, rgb(0 0 0 / 15%));
  }

  /* Collapsed preview shows a single centered column of icons, so the ghost
       drops its text bars and centers the icon placeholders to match. */
  .split.pv-collapsed .ghost-bar {
    display: none;
  }

  .split.pv-collapsed .ghost-row {
    justify-content: center;
  }

  /* The region preview renders at its natural height instead of filling the
       frame, so a short region does not stretch. */
  .pv-frame dashboard-sidebar {
    display: block;
    height: auto;
  }

  /* The whole-sidebar (Settings) preview instead fills the flex-column frame,
       so its body flexes and the footer pins to the bottom, like live. This is
       set in the outer scope because host-targeting page rules win over the
       sidebar's own :host([preview][full]) rules. */
  .pv-frame.pv-col dashboard-sidebar[full] {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    height: auto;
  }

  @media (width < 640px) {
    /* Full-screen modal on mobile. */
    .panel {
      width: 100vw;
      height: 100vh;
      border-radius: 0;
    }

    /* Stacked: scroll the whole content as one instead of per-column. */
    .content {
      overflow-y: auto;
    }

    .split {
      flex-direction: column;
      flex: 0 0 auto;
    }

    .editor,
    .preview,
    .pv-frame {
      width: 100%;
      flex: 0 0 auto;
    }

    /* Stacked: the preview shows at its configured width but never wider than
         the modal, right-aligned in the preview column to match the collapsed
         view (which pins to the right). */
    .pv-frame:not(.collapsed) {
      width: min(var(--pv-w, 100%), 100%);
      align-self: flex-end;
    }

    .editor,
    .pv-frame {
      overflow: visible;
    }
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* The form header row: the element-setting label plus the move/overflow
       tools aligned to the right. Pinned to the top so it stays in view as the
       form scrolls (UI and YAML mode alike); the opaque backdrop matches
       .content so fields pass cleanly underneath. */
  .form-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    position: sticky;
    top: 0;
    z-index: 3;
    padding-bottom: 8px;
    background-color: var(--primary-background-color, #fff);
    background-image: linear-gradient(
      var(--card-background-color, #fff),
      var(--card-background-color, #fff)
    );
    border-bottom: 1px solid var(--divider-color, rgb(0 0 0 / 12%));
  }

  /* Matches the PREVIEW label so the two columns' headers read as a pair. */
  .form-title {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.6;
  }

  .form-tools {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 0 0 auto;
  }

  .tool {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .tool:hover:not([disabled]) {
    background: var(--secondary-background-color, rgb(0 0 0 / 8%));
  }

  .tool[disabled] {
    opacity: 0.3;
    cursor: default;
  }

  .tool ha-icon {
    --mdc-icon-size: 18px;
  }

  .menu-empty {
    margin: 0;
    padding: 8px 12px;
    opacity: 0.6;
    font-size: 0.85rem;
  }

  /* Borderless call-to-action shown instead of a preview when a region has no
       elements, so an empty area is not made to look as if it renders. */
  .empty-state {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 32px 16px;
    text-align: center;
  }

  .empty-msg {
    margin: 0;
    max-width: 32ch;
    opacity: 0.7;
  }

  .empty-icon {
    --mdc-icon-size: 40px;

    opacity: 0.35;
  }

  .danger {
    color: var(--error-color, #db4437);
  }

  .icon {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 6px;
    font: inherit;
  }

  .icon:hover:not([disabled]) {
    background: var(--divider-color, rgb(0 0 0 / 10%));
  }

  .icon[disabled] {
    opacity: 0.3;
    cursor: default;
  }

  .icon.danger:hover {
    color: var(--error-color, #db4437);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.85rem;
  }

  .field-inline {
    flex-direction: row;
    align-items: flex-start;
    gap: 8px;
  }

  .check-label {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .field-desc {
    font-size: 0.75rem;
    opacity: 0.6;
    line-height: 1.3;
  }

  .field-desc a {
    color: var(--primary-color, #03a9f4);
  }

  /* The card-mod install prompt shown when the integration is absent. */
  .card-mod-missing .field-desc {
    opacity: 0.8;
  }

  /* Collapsed reference of targetable CSS classes under the Card Mod field. */
  .class-ref-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }

  .class-ref-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
  }

  .class-ref-row code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.78rem;
    color: var(--primary-color, #03a9f4);
    white-space: nowrap;
  }

  .class-ref-row span {
    font-size: 0.78rem;
    opacity: 0.7;
  }

  /* A resolved entity/service replaces the input with a card: the id over its
       friendly name, and a clear button. Matches the inputs' bordered box. */
  .field-picked {
    display: flex;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
    width: 100%;
    /* Left/right padding matches the inputs (8px) so the text left-aligns with
         other fields and the clear button lines up with the select arrows. */
    padding: 8px;
    border: 1px solid var(--divider-color, rgb(0 0 0 / 20%));
    border-radius: 6px;
    background: var(--card-background-color, #fff);
  }

  .field-picked-text {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
  }

  .field-picked-id,
  .field-picked-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .field-picked-name {
    font-size: 0.8rem;
    color: var(--secondary-text-color, #666);
  }

  .field-picked-clear {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--primary-text-color, #000);
    font-size: 1rem;
    cursor: pointer;
  }

  .field-picked-clear:hover {
    background: var(--secondary-background-color, rgb(0 0 0 / 8%));
  }

  /* Non-blocking advisory (e.g. an out-of-range width): amber, not red. */
  .field-warn {
    font-size: 0.75rem;
    line-height: 1.3;
    color: var(--warning-color, #e8a33d);
  }

  /* Format field: the label row with an info disclosure that reveals the
       supported strftime tokens in a floating list. */
  .field-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .format-help {
    position: relative;
    display: inline-flex;
  }

  .format-help > summary {
    display: inline-flex;
    align-items: center;
    list-style: none;
    cursor: pointer;
    opacity: 0.6;
  }

  .format-help > summary::-webkit-details-marker {
    display: none;
  }

  .format-help[open] > summary,
  .format-help > summary:hover {
    opacity: 1;
  }

  .format-help ha-icon {
    --mdc-icon-size: 16px;
  }

  .format-help-pop {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: max-content;
    max-width: 18rem;
    max-height: 15rem;
    overflow-y: auto;
    padding: 8px 10px;
    border: 1px solid var(--divider-color, rgb(0 0 0 / 15%));
    border-radius: 8px;
    background-color: var(--primary-background-color, #fff);
    background-image: linear-gradient(
      var(--card-background-color, #fff),
      var(--card-background-color, #fff)
    );
    box-shadow: 0 4px 16px rgb(0 0 0 / 40%);
    font-size: 0.8rem;
    font-weight: 400;
  }

  .format-token {
    display: flex;
    gap: 10px;
  }

  .format-token code {
    flex: 0 0 auto;
    min-width: 2.4em;
    color: var(--primary-color, #03a9f4);
    font-family: var(--ha-font-family-code, monospace);
  }

  .format-token span {
    opacity: 0.85;
  }

  .color-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-row input[type='text'] {
    flex: 1;
    min-width: 0;
  }

  .color-swatch {
    width: 40px;
    height: 34px;
    flex: 0 0 auto;
    padding: 2px;
    border: 1px solid var(--divider-color, rgb(0 0 0 / 20%));
    border-radius: 6px;
    cursor: pointer;
  }

  .field input[type='text'],
  .field select,
  .field textarea {
    box-sizing: border-box;
    width: 100%;
    font: inherit;
    padding: 6px 8px;
    border: 1px solid var(--divider-color, rgb(0 0 0 / 20%));
    border-radius: 6px;
    background: var(--card-background-color, #fff);
    color: inherit;
  }

  /* Monospace variant for code-ish content (e.g. Service Data JSON). */
  .field textarea.mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    line-height: 1.4;
  }

  /* Grow to fit the content, with the rows attribute as the minimum. */
  .field textarea.autosize {
    /* stylelint-disable-next-line property-no-unknown */
    field-sizing: content;
    resize: none;
  }

  /* Match the select's height to the text inputs (native selects render
       shorter otherwise). */
  .field input[type='text'],
  .field select {
    height: 34px;
  }

  .field.invalid input[type='text'],
  .field.invalid textarea {
    border-color: var(--error-color, #db4437);
  }

  /* Clearly show a disabled control (e.g. Format while a custom format is set). */
  .field select:disabled,
  .field input:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: var(--divider-color, rgb(0 0 0 / 6%));
  }

  .field-inline input:disabled ~ .check-label {
    opacity: 0.4;
  }

  /* HA's code editor field: wrap it in the same bordered box as the other
       inputs. Keep overflow visible so the CodeMirror autocomplete popup is not
       clipped by the field box. */
  .code-field ha-code-editor {
    display: block;
    border: 1px solid var(--divider-color, rgb(0 0 0 / 20%));
    border-radius: 6px;
    --code-editor-background-color: var(--card-background-color, transparent);
    --code-mirror-max-height: 160px;
  }

  .code-field.invalid ha-code-editor {
    border-color: var(--error-color, #db4437);
  }

  /* In element YAML mode, the form fills the editor column and the YAML editor
       grows to take all the height left above the buttons. */
  .form.yaml-mode {
    flex: 1 1 auto;
    min-height: 0;
  }

  .yaml-fill {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .yaml-fill ha-yaml-editor {
    flex: 1 1 auto;
    min-height: 0;
    --code-mirror-max-height: 100%;
  }

  .yaml-fill textarea {
    flex: 1 1 auto;
    min-height: 0;
  }

  /* Invalid-YAML notice carried back to the UI form. */
  .yaml-banner {
    padding: 8px 10px;
    border: 1px solid var(--error-color, #db4437);
    border-radius: 6px;
    color: var(--error-color, #db4437);
    font-size: 0.8rem;
    background: color-mix(in srgb, var(--error-color, #db4437) 10%, transparent);
  }

  /* HA's YAML editor field (manual card): match the bordered input box. */
  .yaml-field ha-yaml-editor {
    display: block;
    border: 1px solid var(--divider-color, rgb(0 0 0 / 20%));
    border-radius: 6px;
    overflow: hidden;
    --code-editor-background-color: var(--card-background-color, transparent);
    --code-mirror-max-height: 220px;
  }

  .field-error {
    color: var(--error-color, #db4437);
    font-size: 0.75rem;
  }

  .hint {
    font-size: 0.8rem;
    opacity: 0.6;
    margin: 4px 0;
  }

  .tab-notes {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--divider-color, rgb(0 0 0 / 15%));
  }

  .tab-notes .tab-note {
    flex: 1 1 auto;
  }

  /* The options button must not tallen the notes row past its text, so the
       footer notes line up exactly with the other tabs: cap its box to the
       note's line height (0.95rem * 1.4) while keeping the icon centered. */
  .tab-notes .tool {
    height: calc(0.95rem * 1.4);
    margin-block: 0;
  }

  .tab-note {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.4;
    opacity: 0.85;
  }

  .editor-note {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 0 0 12px;
    padding: 10px 12px;
    border: 1px solid var(--divider-color, rgb(0 0 0 / 15%));
    border-left: 3px solid var(--info-color, #2196f3);
    border-radius: 8px;
    background: color-mix(in srgb, var(--info-color, #2196f3) 8%, transparent);
    font-size: 0.95rem;
    line-height: 1.4;
  }

  .editor-note ha-icon {
    --mdc-icon-size: 22px;

    flex: 0 0 auto;
    color: var(--info-color, #2196f3);
  }

  /* Dashed "dropzone" add trigger, used for empty-area call-to-actions. */
  .add {
    font: inherit;
    margin-top: 4px;
    padding: 6px 10px;
    border: 1px dashed var(--divider-color, rgb(0 0 0 / 25%));
    border-radius: 8px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  /* Solid (filled) form action buttons: add-after, add child, delete. */
  /* The form's bottom actions (Add / Delete) sit in one equal-width row. */
  .form-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .form-actions > * {
    flex: 1 1 0;
    min-width: 0;
    margin-top: 0;
    text-align: center;
  }

  .add-btn,
  .add.solid {
    font: inherit;
    margin-top: 4px;
    padding: 8px 12px;
    border: 1px solid transparent;
    border-radius: 8px;
    /* A tint of the text color reads as a solid button in both light and dark
         themes, unlike the near-invisible secondary background. */
    background: color-mix(in srgb, var(--primary-text-color, #000) 14%, transparent);
    color: inherit;
    cursor: pointer;
  }

  .add-btn:hover,
  .add.solid:hover {
    background: color-mix(in srgb, var(--primary-text-color, #000) 24%, transparent);
  }

  /* Delete is a solid red button. */
  .add-btn.danger {
    background: var(--error-color, #db4437);
    color: var(--text-primary-color, #fff);
  }

  .add-btn.danger:hover {
    background: color-mix(in srgb, var(--error-color, #db4437) 85%, #000);
  }

  .errors {
    margin: 0;
    padding: 8px 24px;
    color: var(--error-color, #db4437);
    font-size: 0.8rem;
    background: color-mix(in srgb, var(--error-color, #db4437) 10%, transparent);
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 10px 12px;
  }

  footer button {
    font: inherit;
    padding: 8px 16px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: color-mix(in srgb, var(--primary-text-color, #000) 14%, transparent);
    color: inherit;
    cursor: pointer;
  }

  footer button:not(.primary):hover {
    background: color-mix(in srgb, var(--primary-text-color, #000) 24%, transparent);
  }

  .primary {
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
    border-color: transparent;
  }

  .primary[disabled] {
    opacity: 0.45;
    cursor: default;
  }

  .confirm-scrim {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(0 0 0 / 45%);
    border-radius: 12px;
  }

  .confirm {
    max-width: 320px;
    margin: 16px;
    padding: 16px;
    border-radius: 12px;
    background-color: var(--primary-background-color, #fff);
    background-image: linear-gradient(
      var(--card-background-color, #fff),
      var(--card-background-color, #fff)
    );
    box-shadow: 0 8px 40px rgb(0 0 0 / 40%);
  }

  .confirm p {
    margin: 0 0 14px;
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .confirm-actions button {
    font: inherit;
    padding: 8px 14px;
    border: 1px solid var(--divider-color, rgb(0 0 0 / 20%));
    border-radius: 8px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .danger-btn {
    background: var(--error-color, #db4437);
    color: var(--text-primary-color, #fff);
    border-color: transparent;
  }

  /* Custom add-element type menu (fixed so it escapes the modal clipping). */
  .menu-scrim {
    position: fixed;
    inset: 0;
    z-index: 1;
  }

  .add-menu {
    position: fixed;
    z-index: 2;
    display: flex;
    flex-direction: column;
    width: max-content;
    min-width: 150px;
    max-width: calc(100vw - 16px);
    height: min-content;
    max-height: 60vh;
    overflow-y: auto;
    padding: 4px;
    border: 1px solid var(--divider-color, rgb(0 0 0 / 15%));
    border-radius: 8px;
    background-color: var(--primary-background-color, #fff);
    background-image: linear-gradient(
      var(--card-background-color, #fff),
      var(--card-background-color, #fff)
    );
    box-shadow: 0 4px 16px rgb(0 0 0 / 40%);
  }

  .add-menu-item {
    font: inherit;
    text-align: left;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .add-menu-item:hover {
    background: var(--secondary-background-color, rgb(0 0 0 / 8%));
  }

  /* A nested "Change to" choice, indented under its parent item. */
  .add-menu-item.submenu-item {
    padding-left: 26px;
    opacity: 0.85;
  }
`;
