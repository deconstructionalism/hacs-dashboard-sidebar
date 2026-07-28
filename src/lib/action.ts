import { type HomeAssistant, fireEvent, navigate, toggleEntity } from 'custom-card-helpers';

/** The action-config fields this runner understands. */
export interface RunnableAction {
  /** The action kind: none/toggle/more-info/navigate/url/call-service. */
  action?: string;
  /** Dashboard path for a navigate action. */
  navigation_path?: string;
  /** Web address for a url action. */
  url_path?: string;
  /**
   * Target entity. For toggle/more-info it overrides the element entity; for
   * call-service it is the service target.
   */
  entity?: string;
  /** `domain.service` for a call-service action. */
  service?: string;
  /** Service data for a call-service action. */
  data?: Record<string, unknown>;
}

/**
 * Fires one action against Home Assistant with modern semantics: toggle and
 * more-info honor the action's own entity (falling back to the element's), and
 * call-service passes the modern `data` and `target`. `node` is the element the
 * more-info event is dispatched from.
 */
export function runAction(
  node: HTMLElement,
  hass: HomeAssistant,
  action: RunnableAction | undefined,
  elementEntity?: string,
): void {
  const kind = action?.action;
  if (!action || !kind || kind === 'none') {
    return;
  }
  switch (kind) {
    case 'toggle': {
      const entity = action.entity ?? elementEntity;
      // toggleEntity picks the right service per domain (lock/unlock,
      // open/close cover, else turn_on/off) rather than a plain toggle, which
      // does nothing for locks and covers.
      if (entity && hass.states[entity]) {
        void toggleEntity(hass, entity);
      }
      break;
    }
    case 'more-info': {
      const entity = action.entity ?? elementEntity;
      if (entity) {
        fireEvent(node, 'hass-more-info', { entityId: entity });
      }
      break;
    }
    case 'navigate':
      if (action.navigation_path) {
        navigate(node, action.navigation_path);
      }
      break;
    case 'url':
      if (action.url_path) {
        window.open(action.url_path);
      }
      break;
    case 'call-service': {
      if (!action.service) {
        break;
      }
      const [domain, service] = action.service.split('.', 2);
      const target = action.entity ? { entity_id: action.entity } : undefined;
      void hass.callService(domain, service, action.data, target);
      break;
    }
    default:
      break;
  }
}
