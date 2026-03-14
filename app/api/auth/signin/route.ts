import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/app/modules/User/services/UserService';

const userService = new UserService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('User signin attempt:', {
      email: body.email,
      timestamp: new Date().toISOString(),
      action: 'signin'
    });

    // Determine auth provider
    const authProvider = body.googleId ? 'GOOGLE' : 'EMAIL';

    if (!body.email) {
      return NextResponse.json({
        error: 'Email is required'
      }, { status: 400 });
    }

    if (authProvider === 'EMAIL' && !body.password) {
      return NextResponse.json({
        error: 'Password is required for email login'
      }, { status: 400 });
    }

    if (authProvider === 'GOOGLE' && !body.googleId) {
      return NextResponse.json({
        error: 'Google ID is required for Google login'
      }, { status: 400 });
    }

    const result = await userService.signin({
      email: body.email,
      password: body.password,
      googleId: body.googleId,
      authProvider,
    });

    return NextResponse.json({
      message: 'Login successful',
      user: result.user,
      token: result.token
    });
  } catch (error: any) {
    console.error('Signin error:', error);
    return NextResponse.json({
      error: error.message || 'Invalid credentials'
    }, { status: 401 });
  }
}
