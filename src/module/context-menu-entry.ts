/**
 * @file ContextMenu entries that work on both v13 and v14.
 */

type EntryConfig = {
  label: string;
  icon: string;
  visible?: boolean | ((target: HTMLElement) => boolean);
  onClick: (target: HTMLElement) => unknown;
};

// Supports both v13 and v14 named keys. Remove the old ones once v13 support is dropped.
export const contextMenuEntry = ({ label, icon, visible, onClick }: EntryConfig) => ({
  label,
  name: label,
  icon,
  ...(visible === undefined ? {} : { visible, condition: visible }),
  onClick: (_event: Event, target: HTMLElement) => onClick(target),
  callback: (target: HTMLElement) => onClick(target),
});
