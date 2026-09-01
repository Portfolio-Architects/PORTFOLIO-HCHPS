import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Schedule } from '@/types';
import { generateIcsFeed } from '@/lib/calendar-utils';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'SCHEDULES.json');
    let schedules: Schedule[] = [];

    try {
      const fileData = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(fileData);
      if (Array.isArray(parsed)) {
        schedules = parsed;
      }
    } catch {
      schedules = [];
    }

    const icsContent = generateIcsFeed(schedules, 'VITAL 업무 스케줄');

    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="vital-schedules.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      }
    });
  } catch (error) {
    console.error('[Calendar ICS Feed Error]:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate ICS feed' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
