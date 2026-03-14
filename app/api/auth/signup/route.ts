import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/app/modules/User/services/UserService';

const userService = new UserService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('User signup attempt:', {
      email: body.email,
      timestamp: new Date().toISOString(),
      action: 'signup'
    });

    // Determine auth provider
    const authProvider = body.googleId ? 'GOOGLE' : 'EMAIL';

    // Validate required fields
    if (!body.email) {
      return NextResponse.json({
        error: 'Email is required'
      }, { status: 400 });
    }

    if (authProvider === 'EMAIL' && !body.password) {
      return NextResponse.json({
        error: 'Password is required for email registration'
      }, { status: 400 });
    }

    if (authProvider === 'GOOGLE' && !body.googleId) {
      return NextResponse.json({
        error: 'Google ID is required for Google registration'
      }, { status: 400 });
    }

    const result = await userService.signup({
      email: body.email,
      password: body.password,
      googleId: body.googleId,
      authProvider,
      displayname: body.displayname,
    });

    return NextResponse.json({
      message: 'User created successfully',
      user: result.user,
      token: result.token
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: error.message?.includes('already exists') ? 409 : 500 });
  }
}
