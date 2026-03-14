import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/app/lib/auth';
import { gameQueue } from '@/app/modules/Game/queue';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'Authorization token required'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    // Check if already in queue
    if (gameQueue.isInQueue(payload.userId)) {
      return NextResponse.json({
        message: 'Already in queue',
        inQueue: true
      });
    }

    // Note: Actual WebSocket connection will be established separately
    // This endpoint just marks the user as ready to match
    return NextResponse.json({
      message: 'Joined queue',
      inQueue: true,
      websocketUrl: '/api/game/ws'
    });
  } catch (error: any) {
    console.error('Queue join error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to join queue'
    }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'Authorization token required'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    gameQueue.dequeue(payload.userId);

    return NextResponse.json({
      message: 'Left queue',
      success: true
    });
  } catch (error: any) {
    console.error('Queue leave error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to leave queue'
    }, { status: 401 });
  }
}
