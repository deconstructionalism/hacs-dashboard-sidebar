import { expect, fixture, html } from '@open-wc/testing';

import type { DashboardSidebar } from '../dashboard-sidebar';
import type { DashboardSidebarConfig } from '../lib/types';
import type { DashboardSidebarEditor } from './sidebar-editor';
import './sidebar-editor';

/** A tap action reused across the fixtures. */
const TAP = { action: 'toggle' } as const;

/** A config with header, body (item + category), and a footer button. */
const cfg = (): DashboardSidebarConfig => ({
  header: [{ type: 'title', text: 'Home' }],
  body: [
    { type: 'item', title: 'A', tap_action: TAP },
    { type: 'category', title: 'Rooms', items: [{ title: 'Kitchen', tap_action: TAP }] },
  ],
  footer: { buttons: [{ icon: 'mdi:cog', tap_action: TAP }] },
});

/** Mounts the editor with a config and waits for its first render. */
async function mount(config: DashboardSidebarConfig): Promise<DashboardSidebarEditor> {
  const el = await fixture<DashboardSidebarEditor>(
    html`<dashboard-sidebar-editor></dashboard-sidebar-editor>`,
  );
  el.config = config;
  await el.updateComplete;
  return el;
}

/** Returns the editor's shadow root. */
function root(el: DashboardSidebarEditor): ShadowRoot {
  return el.shadowRoot as ShadowRoot;
}

/** The live preview sidebar element in the current tab, or null. */
function preview(el: DashboardSidebarEditor): DashboardSidebar | null {
  return root(el).querySelector('.pv-frame dashboard-sidebar');
}

/** Waits for both the editor and its preview sidebar to finish rendering. */
async function settle(el: DashboardSidebarEditor): Promise<void> {
  await el.updateComplete;
  await preview(el)?.updateComplete;
  await el.updateComplete;
}

/** Clicks the tab with the given label and settles the render. */
async function tab(el: DashboardSidebarEditor, label: string): Promise<void> {
  const btn = [...root(el).querySelectorAll('.tab')].find(
    (b) => b.textContent?.trim() === label,
  ) as HTMLButtonElement;
  btn.click();
  await settle(el);
}

/** Clicks the preview element with the given data-loc, then settles. */
async function clickLoc(el: DashboardSidebarEditor, loc: string): Promise<void> {
  const node = preview(el)?.shadowRoot?.querySelector(`[data-loc="${loc}"]`) as HTMLElement;
  node.click();
  await settle(el);
}

/** Count of a preview region's top-level rows. */
function regionCount(el: DashboardSidebarEditor, region: string): number {
  return preview(el)?.shadowRoot?.querySelector(`.region-${region}`)?.children.length ?? 0;
}

describe('<dashboard-sidebar-editor>', () => {
  it('renders the four tabs', async () => {
    const el = await mount(cfg());
    const labels = [...root(el).querySelectorAll('.tab')].map((b) => b.textContent?.trim());
    expect(labels).to.deep.equal(['Settings', 'Header', 'Content', 'Footer']);
  });

  it('renders the region as a live sidebar preview', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    const sb = preview(el);
    expect(sb).to.exist;
    expect(sb?.preview).to.equal(true);
    // The body region renders its real rows with location markers.
    expect(sb?.shadowRoot?.querySelector('.region-body [data-loc="body:0"]')).to.exist;
    expect(sb?.shadowRoot?.querySelector('[data-loc="body:1"]')).to.exist;
  });

  it('shows a borderless empty state (no preview frame) for an empty region', async () => {
    const el = await mount({ ...cfg(), header: [] });
    await tab(el, 'Header');
    expect(root(el).querySelector('.pv-frame')).to.not.exist;
    expect(root(el).querySelector('.pv-toggle')).to.not.exist;
    expect(root(el).querySelector('.empty-state')).to.exist;
    expect(root(el).querySelector('.empty-msg')?.textContent).to.contain('Add your first');
  });

  it('edits sidebar settings (position via icon choice)', async () => {
    const el = await mount(cfg());
    await tab(el, 'Settings');
    (root(el).querySelectorAll('.settings .choice')[1] as HTMLButtonElement).click();
    await el.updateComplete;
    let saved: DashboardSidebarConfig | undefined;
    el.onSave = (c) => {
      saved = c;
    };
    (root(el).querySelector('footer .primary') as HTMLButtonElement).click();
    expect(saved?.position).to.equal('right');
  });

  it('adds a block below the selected element from its form', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    const before = regionCount(el, 'body');
    // Nothing is auto-selected, so pick an element to reveal its "Add Below".
    await clickLoc(el, 'body:0');
    (root(el).querySelector('.form .add') as HTMLButtonElement).click();
    await el.updateComplete;
    const divider = [...root(el).querySelectorAll('.add-menu-item')].find(
      (b) => b.textContent?.trim() === 'Divider',
    ) as HTMLButtonElement;
    divider.click();
    await settle(el);
    expect(regionCount(el, 'body')).to.equal(before + 1);
  });

  it('deletes the selected block from its form', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    const before = regionCount(el, 'body');
    await clickLoc(el, 'body:0');
    (root(el).querySelector('.form .danger') as HTMLButtonElement).click();
    await settle(el);
    expect(regionCount(el, 'body')).to.equal(before - 1);
  });

  it('selecting a preview element reveals its edit form', async () => {
    const el = await mount(cfg());
    await tab(el, 'Header');
    expect(root(el).querySelector('.form')).to.not.exist;
    await clickLoc(el, 'header:0');
    expect(root(el).querySelector('.form')).to.exist;
    expect(root(el).querySelector('.advanced')).to.exist;
  });

  it('reorders a region through a preview reorder event', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    let saved: DashboardSidebarConfig | undefined;
    el.onSave = (c) => {
      saved = c;
    };
    preview(el)?.dispatchEvent(
      new CustomEvent('dashboard-sidebar-preview-reorder', {
        detail: { from: 'body', to: 'body', oldIndex: 0, newIndex: 1 },
        bubbles: true,
        composed: true,
      }),
    );
    await settle(el);
    await tab(el, 'Settings');
    (root(el).querySelector('.settings input[type="checkbox"]') as HTMLInputElement).click();
    await el.updateComplete;
    (root(el).querySelector('footer .primary') as HTMLButtonElement).click();
    // The category that was second is now first.
    expect(saved?.body?.[0]?.type).to.equal('category');
  });

  it('moves the selected element with the header up/down tools', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    let saved: DashboardSidebarConfig | undefined;
    el.onSave = (c) => {
      saved = c;
    };
    await clickLoc(el, 'body:0');
    // At the top, so "up" is disabled and "down" is enabled.
    const up = root(el).querySelector('.form-tools [title="Move up"]') as HTMLButtonElement;
    const down = root(el).querySelector('.form-tools [title="Move down"]') as HTMLButtonElement;
    expect(up.disabled).to.equal(true);
    expect(down.disabled).to.equal(false);
    down.click();
    await settle(el);
    await tab(el, 'Settings');
    (root(el).querySelector('.settings input[type="checkbox"]') as HTMLInputElement).click();
    await el.updateComplete;
    (root(el).querySelector('footer .primary') as HTMLButtonElement).click();
    expect(saved?.body?.[0]?.type).to.equal('category');
  });

  it('opens the selected element overflow menu with the YAML toggle', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    await clickLoc(el, 'body:0');
    (root(el).querySelector('.form-tools [title="More"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const labels = [...root(el).querySelectorAll('.add-menu .add-menu-item')].map((b) =>
      b.textContent?.trim(),
    );
    expect(labels).to.include('Edit As YAML');
  });

  it('toggles an element between the UI form and a YAML editor', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    await clickLoc(el, 'body:0');
    const openMenu = (): void =>
      (root(el).querySelector('.form-tools [title="More"]') as HTMLButtonElement).click();
    const yamlItem = (): HTMLButtonElement | undefined =>
      [...root(el).querySelectorAll('.add-menu-item')].find((b) =>
        /Edit (As YAML|With UI)/.test(b.textContent ?? ''),
      ) as HTMLButtonElement | undefined;
    // Switch to YAML: the UI fields give way to a YAML/textarea editor.
    openMenu();
    await el.updateComplete;
    expect(yamlItem()?.textContent?.trim()).to.equal('Edit As YAML');
    yamlItem()!.click();
    await el.updateComplete;
    expect(root(el).querySelector('.form textarea, .form ha-yaml-editor')).to.exist;
    // The menu now offers switching back to the UI.
    openMenu();
    await el.updateComplete;
    expect(yamlItem()?.textContent?.trim()).to.equal('Edit With UI');
  });

  it('flags a schema-invalid element edited as YAML', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    await clickLoc(el, 'body:0');
    (root(el).querySelector('.form-tools [title="More"]') as HTMLButtonElement).click();
    await el.updateComplete;
    (
      [...root(el).querySelectorAll('.add-menu-item')].find((b) =>
        b.textContent?.includes('Edit As YAML'),
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const ta = root(el).querySelector('.form textarea') as HTMLTextAreaElement;
    // A title with no text is valid YAML but invalid per the schema.
    ta.value = '{"type":"title"}';
    ta.dispatchEvent(new Event('input'));
    await el.updateComplete;
    expect(root(el).querySelector('.form .field-error')?.textContent).to.contain('needs text');
  });

  it("surfaces a manual card's validation error from the card helpers", async () => {
    (window as unknown as { loadCardHelpers?: () => Promise<unknown> }).loadCardHelpers =
      async () => ({
        createCardElement: (c: { type?: string }) => {
          const node = document.createElement(c.type === 'bogus' ? 'hui-error-card' : 'div');
          if (c.type === 'bogus') {
            (node as unknown as { _config: { error: string } })._config = {
              error: 'No card type configured',
            };
          }
          return node;
        },
      });
    try {
      const el = await mount({ body: [{ type: 'card', card: { type: 'bogus' } }] });
      el.hass = {} as never;
      await tab(el, 'Content');
      await clickLoc(el, 'body:0');
      await new Promise((r) => setTimeout(r, 600));
      await el.updateComplete;
      expect(root(el).querySelector('.form .yaml-banner')?.textContent).to.contain(
        'No card type configured',
      );
    } finally {
      delete (window as unknown as { loadCardHelpers?: unknown }).loadCardHelpers;
    }
  });

  it('shows category items in the preview and offers add-item when selected', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    // The category renders its items inline, each with a location marker.
    expect(preview(el)?.shadowRoot?.querySelector('[data-loc="body:1.0"]')).to.exist;
    await clickLoc(el, 'body:1');
    const addItem = [...root(el).querySelectorAll('.form .add-btn')].some((b) =>
      b.textContent?.includes('Add Child Item'),
    );
    expect(addItem).to.equal(true);
  });

  it('expands/collapses a selected category through its overflow menu', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    await clickLoc(el, 'body:1'); // the "Rooms" category
    expect(preview(el)?.shadowRoot?.querySelector('[data-loc="body:1.0"]')).to.exist;
    (root(el).querySelector('.form-tools [title="More"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const collapse = [...root(el).querySelectorAll('.add-menu-item')].find((b) =>
      b.textContent?.includes('Collapse Category'),
    ) as HTMLButtonElement;
    expect(collapse).to.exist;
    collapse.click();
    await settle(el);
    // Collapsed in the preview: the category's item is hidden.
    expect(preview(el)?.shadowRoot?.querySelector('[data-loc="body:1.0"]')).to.not.exist;
  });

  it('offers a Button Row/Manual Card/Text picker and no tab menu for an empty footer', async () => {
    const el = await mount({ ...cfg(), footer: undefined });
    await tab(el, 'Footer');
    expect(root(el).querySelector('.empty-state')).to.exist;
    expect(root(el).querySelector('.tab-notes .tool')).to.not.exist;
    (root(el).querySelector('.empty-state .add') as HTMLButtonElement).click();
    await el.updateComplete;
    const labels = [...root(el).querySelectorAll('.add-menu-item')].map((b) =>
      b.textContent?.trim(),
    );
    expect(labels).to.include('Button Row');
    expect(labels).to.include('Manual Card');
    expect(labels).to.include('Text');
  });

  it('shows left/right move arrows for a selected footer button', async () => {
    const el = await mount({
      ...cfg(),
      footer: {
        buttons: [
          { icon: 'mdi:cog', tap_action: TAP },
          { icon: 'mdi:home', tap_action: TAP },
        ],
      },
    });
    await tab(el, 'Footer');
    await clickLoc(el, 'footer:btn:0');
    expect(root(el).querySelector('.form-tools [title="Move left"]')).to.exist;
    expect(root(el).querySelector('.form-tools [title="Move right"]')).to.exist;
    expect(root(el).querySelector('.form-tools [title="Move up"]')).to.not.exist;
  });

  it('re-disables Save after toggling a boolean setting off again', async () => {
    const el = await mount(cfg());
    await tab(el, 'Settings');
    const save = (): HTMLButtonElement =>
      root(el).querySelector('footer .primary') as HTMLButtonElement;
    const hide = (): HTMLInputElement =>
      [...root(el).querySelectorAll('.settings input[type="checkbox"]')][1] as HTMLInputElement;
    expect(save().disabled).to.equal(true);
    hide().click();
    await el.updateComplete;
    expect(save().disabled).to.equal(false);
    hide().click();
    await el.updateComplete;
    expect(save().disabled).to.equal(true);
  });

  it('switches the footer to markdown through the tab menu', async () => {
    const el = await mount(cfg());
    await tab(el, 'Footer');
    (root(el).querySelector('.tab-notes .tool') as HTMLButtonElement).click();
    await el.updateComplete;
    // Open the "Change to" submenu, then pick Text.
    (
      [...root(el).querySelectorAll('.add-menu-item')].find((b) =>
        b.textContent?.includes('Change to'),
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const toMarkdown = [...root(el).querySelectorAll('.add-menu-item.submenu-item')].find((b) =>
      b.textContent?.includes('Text'),
    ) as HTMLButtonElement;
    toMarkdown.click();
    await el.updateComplete;
    // The markdown editor falls back to a plain input/textarea outside HA.
    expect(root(el).querySelector('.editor .field')).to.exist;
  });

  it('seeds a starter button when changing to a button row', async () => {
    // Start from a text footer so "Change to > Button Row" is offered.
    const el = await mount({ ...cfg(), footer: { markdown: 'hi' } });
    await tab(el, 'Footer');
    let saved: DashboardSidebarConfig | undefined;
    el.onSave = (c) => {
      saved = c;
    };
    (root(el).querySelector('.tab-notes .tool') as HTMLButtonElement).click();
    await el.updateComplete;
    (
      [...root(el).querySelectorAll('.add-menu-item')].find((b) =>
        b.textContent?.includes('Change to'),
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    (
      [...root(el).querySelectorAll('.add-menu-item.submenu-item')].find((b) =>
        b.textContent?.includes('Button Row'),
      ) as HTMLButtonElement
    ).click();
    await settle(el);
    // The button's edit form shows, and saving yields one starter button.
    expect(root(el).querySelector('.form-title')?.textContent).to.contain('Button');
    await tab(el, 'Settings');
    (root(el).querySelector('.settings input[type="checkbox"]') as HTMLInputElement).click();
    await el.updateComplete;
    (root(el).querySelector('footer .primary') as HTMLButtonElement).click();
    expect(saved?.footer?.buttons?.length).to.equal(1);
    expect(saved?.footer?.markdown).to.equal(undefined);
  });

  it('toggles the footer between UI and YAML editing from the tab menu', async () => {
    const el = await mount(cfg());
    await tab(el, 'Footer');
    (root(el).querySelector('.tab-notes .tool') as HTMLButtonElement).click();
    await el.updateComplete;
    (
      [...root(el).querySelectorAll('.add-menu-item')].find(
        (b) => b.textContent?.trim() === 'Edit As YAML',
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    // The whole footer is now edited as YAML (textarea fallback outside HA).
    expect(root(el).querySelector('.editor.yaml-mode')).to.exist;
  });

  it('saves a valid config through onSave and closes', async () => {
    const el = await mount(cfg());
    let saved: DashboardSidebarConfig | undefined;
    let closed = false;
    el.onSave = (c) => {
      saved = c;
    };
    el.onClose = () => {
      closed = true;
    };
    // A change is required before Save is enabled.
    await tab(el, 'Settings');
    (root(el).querySelectorAll('.settings .choice')[1] as HTMLButtonElement).click();
    await el.updateComplete;
    (root(el).querySelector('footer .primary') as HTMLButtonElement).click();
    expect(saved?.body?.length).to.equal(2);
    expect(closed).to.equal(true);
  });

  it('surfaces errors and does not save an invalid config', async () => {
    const el = await mount({} as DashboardSidebarConfig);
    let saved = false;
    el.onSave = () => {
      saved = true;
    };
    // Make a change so Save is enabled, while the config stays invalid.
    await tab(el, 'Settings');
    (root(el).querySelector('.settings input[type="checkbox"]') as HTMLInputElement).click();
    await el.updateComplete;
    (root(el).querySelector('footer .primary') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(root(el).querySelector('.errors')).to.exist;
    expect(saved).to.equal(false);
  });

  it('disables Save until a change is made', async () => {
    const el = await mount(cfg());
    const save = (): HTMLButtonElement =>
      root(el).querySelector('footer .primary') as HTMLButtonElement;
    expect(save().disabled).to.equal(true);
    await tab(el, 'Settings');
    (root(el).querySelectorAll('.settings .choice')[1] as HTMLButtonElement).click();
    await el.updateComplete;
    expect(save().disabled).to.equal(false);
  });

  it('shows a field error on blur and disables Save', async () => {
    const el = await mount(cfg());
    await tab(el, 'Settings');
    const width = root(el).querySelector('.settings input[type="text"]') as HTMLInputElement;
    width.value = '0';
    width.dispatchEvent(new Event('input'));
    width.dispatchEvent(new Event('blur'));
    await el.updateComplete;
    expect(root(el).querySelector('.field-error')).to.exist;
    expect((root(el).querySelector('footer .primary') as HTMLButtonElement).disabled).to.equal(
      true,
    );
  });

  it('confirms before closing with unsaved changes', async () => {
    const el = await mount(cfg());
    let closed = false;
    el.onClose = () => {
      closed = true;
    };
    await tab(el, 'Settings');
    (root(el).querySelectorAll('.settings .choice')[1] as HTMLButtonElement).click();
    await el.updateComplete;
    (root(el).querySelector('footer button') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(root(el).querySelector('.confirm')).to.exist;
    expect(closed).to.equal(false);
    (root(el).querySelector('.danger-btn') as HTMLButtonElement).click();
    expect(closed).to.equal(true);
  });

  it('selects nothing on landing and shows the empty-state prompt', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    expect(root(el).querySelector('.form')).to.not.exist;
    expect(root(el).querySelector('.empty-state .empty-msg')?.textContent).to.contain(
      'Select an element',
    );
  });

  it("remembers each tab's selection when switching away and back", async () => {
    const el = await mount(cfg());
    await tab(el, 'Header');
    await clickLoc(el, 'header:0');
    expect(root(el).querySelector('.form')).to.exist;
    await tab(el, 'Content');
    expect(root(el).querySelector('.form')).to.not.exist;
    await tab(el, 'Header');
    expect(root(el).querySelector('.form')).to.exist;
  });

  it('collapsing clears the selection when the selected element is hidden', async () => {
    const el = await mount(cfg());
    await tab(el, 'Header');
    await clickLoc(el, 'header:0'); // the title, which is hidden when collapsed
    expect(root(el).querySelector('.form')).to.exist;
    (root(el).querySelector('.pv-toggle') as HTMLButtonElement).click();
    await settle(el);
    // No other visible header element, so the selection clears.
    expect(root(el).querySelector('.form')).to.not.exist;
    expect(root(el).querySelector('.empty-state')).to.exist;
  });

  it('keeps a selected sub-item selected when collapsing', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    await clickLoc(el, 'body:1.0'); // the "Kitchen" sub-item
    (root(el).querySelector('.pv-toggle') as HTMLButtonElement).click();
    await settle(el);
    // The child stays selected (reachable via the collapsed category popover),
    // rather than jumping selection to its parent category.
    expect(root(el).querySelector('.pv-frame.collapsed')).to.exist;
    expect(root(el).querySelector('.form-title')?.textContent).to.contain('Item');
  });

  it('selects a sub-item from the collapsed popover without expanding', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    (root(el).querySelector('.pv-toggle') as HTMLButtonElement).click(); // collapse
    await settle(el);
    expect(root(el).querySelector('.pv-frame.collapsed')).to.exist;
    preview(el)?.dispatchEvent(
      new CustomEvent('dashboard-sidebar-preview-select', {
        detail: { loc: 'body:1.0' },
        bubbles: true,
        composed: true,
      }),
    );
    await settle(el);
    // The item is selected in place; the preview stays collapsed.
    expect(root(el).querySelector('.pv-frame.collapsed')).to.exist;
    expect(root(el).querySelector('.form-title')?.textContent).to.contain('Item');
  });

  it('shows a Preview header and toggles the collapsed look', async () => {
    const el = await mount(cfg());
    await tab(el, 'Content');
    expect(root(el).querySelector('.preview-title')?.textContent?.trim()).to.equal('Preview');
    expect(root(el).querySelector('.pv-frame.collapsed')).to.not.exist;
    (root(el).querySelector('.pv-toggle') as HTMLButtonElement).click();
    await settle(el);
    expect(root(el).querySelector('.pv-frame.collapsed')).to.exist;
  });

  it('toggles the footer top divider bar through the tab menu', async () => {
    const el = await mount(cfg());
    await tab(el, 'Footer');
    let saved: DashboardSidebarConfig | undefined;
    el.onSave = (c) => {
      saved = c;
    };
    (root(el).querySelector('.tab-notes .tool') as HTMLButtonElement).click();
    await el.updateComplete;
    const hide = [...root(el).querySelectorAll('.add-menu-item')].find((b) =>
      b.textContent?.includes('Top Divider Bar'),
    ) as HTMLButtonElement;
    hide.click();
    await el.updateComplete;
    (root(el).querySelector('footer .primary') as HTMLButtonElement).click();
    expect(saved?.footer?.divider).to.equal(false);
  });
});
