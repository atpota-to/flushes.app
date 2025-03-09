import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Configure this route as dynamic to fix static generation issues  
export const dynamic = 'force-dynamic';

// Supabase client - using environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(request: NextRequest) {
  try {
    // If we have Supabase credentials, fetch stats
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // 1. Get total flush count
      const { count: totalCount, error: countError } = await supabase
        .from('flushing_records')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        throw new Error(`Failed to get total count: ${countError.message}`);
      }

      // 2. Get daily flush counts for the chart
      const { data: dailyData, error: dailyError } = await supabase
        .from('flushing_records')
        .select('created_at')
        .order('created_at', { ascending: true });
      
      if (dailyError) {
        throw new Error(`Failed to get daily data: ${dailyError.message}`);
      }
      
      // Create a map of date -> count
      const dailyCounts = new Map<string, number>();
      
      // Process each entry to get daily counts
      dailyData?.forEach(entry => {
        const date = new Date(entry.created_at);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        if (dailyCounts.has(dateKey)) {
          dailyCounts.set(dateKey, (dailyCounts.get(dateKey) || 0) + 1);
        } else {
          dailyCounts.set(dateKey, 1);
        }
      });
      
      // Convert to array sorted by date
      const chartData = Array.from(dailyCounts.entries())
        .map(([date, count]): {date: string, count: number} => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      // Calculate flushes per day based on actual active days
      let flushesPerDay = 0;
      if (chartData.length > 0 && totalCount !== null) {
        // Use the number of days with at least one flush (which is the length of chartData)
        // This gives us the actual active days count
        const activeDaysCount = chartData.length;
        flushesPerDay = parseFloat(((totalCount || 0) / activeDaysCount).toFixed(1));
      }
      
      // 3. Get top flushers (leaderboard) - excluding test accounts
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('flushing_records')
        .select('did, handle')
        .order('created_at', { ascending: false });
      
      if (leaderboardError) {
        throw new Error(`Failed to get leaderboard data: ${leaderboardError.message}`);
      }
      
      // Count flushes by DID
      const didCounts = new Map<string, number>();
      
      // Special count for the plumber
      let plumberFlushCount = 0;
      
      // List of DIDs to exclude from leaderboard
      const excludedDids = [
        'did:plc:fouf3svmcxzn6bpiw3lgwz22', // plumber.flushing.im
        'did:plc:fnhrjbkwjiw6iyxxg2o3rljw'  // testing.dame.is
      ];
      
      // List of handles to exclude from leaderboard (as fallback)
      const excludedHandles = [
        'plumber.flushing.im',
        'testing.dame.is'
      ];
      
      leaderboardData?.forEach(entry => {
        // Check if this is the plumber or test account
        if (entry.did === 'did:plc:fouf3svmcxzn6bpiw3lgwz22' || entry.handle === 'plumber.flushing.im') {
          plumberFlushCount++;
        } 
        // Only count towards leaderboard if not an excluded account
        else if (!excludedDids.includes(entry.did) && 
                 !(entry.handle && excludedHandles.includes(entry.handle))) {
          didCounts.set(entry.did, (didCounts.get(entry.did) || 0) + 1);
        }
      });
      
      // Convert to array and sort by count
      const leaderboard = Array.from(didCounts.entries())
        .map(([did, count]): {did: string, count: number} => ({ did, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Get top 10
      
      // Return the data
      return NextResponse.json({
        totalCount,
        flushesPerDay,
        chartData: chartData.slice(-30), // Last 30 days
        leaderboard,
        plumberFlushCount
      });
    } else {
      // If no Supabase credentials, return mock data
      return NextResponse.json({
        totalCount: 42,
        flushesPerDay: 3.5,
        chartData: generateMockChartData(),
        leaderboard: generateMockLeaderboard(),
        plumberFlushCount: 15
      });
    }
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', message: error.message },
      { status: 500 }
    );
  }
}

// Generate mock chart data
function generateMockChartData() {
  const chartData = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    // Random count between 1 and 5
    const count = Math.floor(Math.random() * 5) + 1;
    
    chartData.push({ date: dateString, count });
  }
  
  return chartData;
}

// Generate mock leaderboard
function generateMockLeaderboard() {
  const mockDids = [
    'did:plc:mock1',
    'did:plc:mock2',
    'did:plc:mock3',
    'did:plc:mock4',
    'did:plc:mock5',
    'did:plc:mock6',
    'did:plc:mock7',
    'did:plc:mock8',
    'did:plc:mock9',
    'did:plc:mock10'
  ];
  
  return mockDids.map((did, index) => ({
    did,
    count: 10 - index
  }));
}