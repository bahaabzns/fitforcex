import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const performanceData = await request.json();
    
    // Log performance data in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Performance Metrics:', performanceData);
    }
    
    // In production, you would send this to your monitoring service
    // Examples: Google Analytics, DataDog, New Relic, etc.
    
    // For now, we'll just log it
    console.log('Performance Report:', {
      FCP: performanceData.FCP,
      LCP: performanceData.LCP,
      FID: performanceData.FID,
      CLS: performanceData.CLS,
      TTFB: performanceData.TTFB,
      pageLoadTime: performanceData.pageLoadTime,
      timestamp: performanceData.timestamp,
      url: performanceData.url,
      userAgent: performanceData.userAgent,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling performance report:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

