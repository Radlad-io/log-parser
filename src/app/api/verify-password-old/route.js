import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { password } = await request.json();
    const expectedPassword = process.env.UPLOAD_PASSWORD;

    if (!expectedPassword) {
      return NextResponse.json(
        { error: 'Password verification not configured' },
        { status: 503 }
      );
    }

    if (password === expectedPassword) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Invalid password' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
} 