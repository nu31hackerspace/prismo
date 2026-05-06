import type { ObjectId } from 'mongodb';

export interface UserSession {
	id: string;
	expiresAt: number;
}

export interface UserDocument {
	_id?: ObjectId;
	googleId: string;
	name: string;
	email: string;
	sessions: UserSession[];
	createdAt: Date;
}

export interface TrackingDocument {
	_id?: ObjectId;
	deviceUuid: string;
	event: string;
	context?: string | null;
	country?: string | null;
	payload?: unknown;
	createdAt: Date;
}

export interface DeviceDocument {
	_id?: ObjectId;
	name: string;
	deviceSlug: string;
	/** Signing key used to derive the MQTT password — never returned to the client. */
	tokenKey: string;
	ownerId: ObjectId;
	createdAt: Date;
	/** Set by the scan-listener on each heartbeat from the device. */
	lastSeenAt?: Date;
	mode?: 'door' | 'machine';
	/** Mode-specific runtime state. For machine mode: { isOn: boolean }. */
	modeParams?: { isOn?: boolean };
}

export interface WorkerJobDocument {
	_id?: ObjectId;
	status: 'pending' | 'processing' | 'completed' | 'failed';
	attemptCount: number;
	maxAttemptCount: number;
	ownerId: ObjectId;
	inputPayload: Record<string, string>;
	outputPayload?: { fileId?: string; error?: string };
	createdAt: Date;
	updatedAt: Date;
}

export type DeviceHistoryAction = 'scan' | 'trigger' | 'key_added' | 'key_removed' | 'sync';

export interface DeviceKeyDocument {
	_id?: ObjectId;
	deviceId: ObjectId;
	keyId: string;
	username: string;
	addedAt: Date;
}

export interface DeviceHistoryDocument {
	_id?: ObjectId;
	deviceId: ObjectId;
	deviceSlug: string;
	action: DeviceHistoryAction;
	keyId?: string;
	username?: string;
	allowed?: boolean;
	triggerAction?: 'success' | 'error' | 'on' | 'off';
	actorUserId?: ObjectId;
	createdAt: Date;
}
