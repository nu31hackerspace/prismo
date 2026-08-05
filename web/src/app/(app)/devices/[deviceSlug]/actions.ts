'use server';

import { getUser } from '@/lib/server/auth-utils';
import { 
  addKeyToDevice, 
  removeKeyFromDevice, 
  triggerDevice, 
  forceSyncDevice, 
  generateMqttCredentialsBySlug 
} from '@/lib/devices/server/device-service';
import { revalidatePath } from 'next/cache';
import { CmdTriggerAction } from 'mqtt-contract';

export async function addKeyAction(deviceSlug: string, formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  
  const keyId = formData.get('keyId') as string;
  const name = formData.get('name') as string;
  if (!keyId) throw new Error('keyId is required');
  
  await addKeyToDevice(deviceSlug, user.id, keyId, name || undefined);
  revalidatePath(`/devices/${deviceSlug}`);
}

export async function removeKeyAction(deviceSlug: string, formData: FormData) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  
  const keyId = formData.get('keyId') as string;
  if (!keyId) throw new Error('keyId is required');
  
  await removeKeyFromDevice(deviceSlug, user.id, keyId);
  revalidatePath(`/devices/${deviceSlug}`);
}

export async function triggerDeviceAction(deviceSlug: string, action: CmdTriggerAction) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  
  await triggerDevice(deviceSlug, user.id, action);
  revalidatePath(`/devices/${deviceSlug}`);
}

export async function syncKeysAction(deviceSlug: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  
  await forceSyncDevice(deviceSlug, user.id);
  revalidatePath(`/devices/${deviceSlug}`);
}

export async function createTokenAction(deviceSlug: string) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  
  const token = await generateMqttCredentialsBySlug(deviceSlug, user.id);
  revalidatePath(`/devices/${deviceSlug}`);
  return token;
}
