import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const errorData = await request.json();
    
    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('🚨 Frontend Error:', errorData);
    }
    
    // In production, you would send this to your error monitoring service
    // Examples: Sentry, LogRocket, Bugsnag, etc.
    
    // For now, we'll just log it
    console.error('Frontend Error Report:', {
      message: errorData.message,
      stack: errorData.stack,
      timestamp: errorData.timestamp,
      url: errorData.url,
      userAgent: errorData.userAgent,
      errorId: errorData.errorId,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling error report:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

