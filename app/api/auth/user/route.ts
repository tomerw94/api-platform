import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/app/modules/User/services/UserService';

const userService = new UserService();

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'Authorization token required'
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return NextResponse.json({
        error: 'Invalid token'
      }, { status: 401 });
    }

    const userId = body.userId || decoded.userId;
    
    if (!userId) {
      return NextResponse.json({
        error: 'User ID is required'
      }, { status: 400 });
    }

    // Verify user owns this account
    if (decoded.userId !== userId) {
      return NextResponse.json({
        error: 'Unauthorized'
      }, { status: 403 });
    }

    console.log('User deletion attempt:', {
      userId,
      timestamp: new Date().toISOString(),
      action: 'deleteUser'
    });

    await userService.deleteUser(userId);

    return NextResponse.json({
      message: 'User deleted successfully',
      success: true
    });
  } catch (error: any) {
    console.error('User deletion error:', error);
    return NextResponse.json({
      message: error.message || 'User deletion failed',
      success: false
    }, { status: 500 });
  }
}
