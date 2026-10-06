// Importing these as values (not `import type`) is what runs their
// @Entity(...) class decorators, registering each model with EntityStore.
// Importing this barrel (rather than individual model files) is what
// guarantees that registration actually happens before the store needs it.
export { Workspace } from './workspace';
export { Device } from './device';
export { Key } from './key';
export { KeyAccess } from './key-access';
export { DeviceActivity } from './device-activity';
export { Hook } from './hook';

import type { Workspace } from './workspace';
import type { Device } from './device';
import type { Key } from './key';
import type { KeyAccess } from './key-access';
import type { DeviceActivity } from './device-activity';
import type { Hook } from './hook';

export interface ModelMap {
  workspace: Workspace;
  device: Device;
  key: Key;
  keyAccess: KeyAccess;
  deviceActivity: DeviceActivity;
  hook: Hook;
}
