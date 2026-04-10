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
	tokenKey: string;
	ownerId: ObjectId;
	createdAt: Date;
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
