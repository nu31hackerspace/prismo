import { NextResponse } from 'next/server';
import { usersCol } from '@/lib/server/db';

export async function GET() {
	try {
		await usersCol.findOne({}, { projection: { _id: 1 } });
		return NextResponse.json({ status: 'ok', database: 'connected', commit: process.env.COMMIT_SHA }, { status: 200 });
	} catch (error) {
		console.error('Healthcheck failed to connect to database:', error);
		return NextResponse.json(
			{ status: 'error', database: 'disconnected', commit: process.env.COMMIT_SHA },
			{ status: 500 }
		);
	}
}
