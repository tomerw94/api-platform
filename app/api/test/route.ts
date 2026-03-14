import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('🧪 Test endpoint called from:', request.headers.get('user-agent'));

  return NextResponse.json({
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    success: true
  });
}