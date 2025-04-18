import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Configure this route as dynamic and disable caching 
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Supabase client - using environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Define approved emojis list - shared across the route
const APPROVED_EMOJIS = [
  '🚽', '🧻', '💩', '💨', '🚾', '🧼', '🪠', '🚻', '🩸', '💧', '💦', '😌', 
  '😣', '🤢', '🤮', '🥴', '😮‍💨', '😳', '😵', '🌾', '🍦', '📱', '📖', '💭',
  '1️⃣', '2️⃣', '🟡', '🟤'
];

export async function GET(request: NextRequest) {
  try {
    // Define the plumber's DID - this is the official plumber account DID
    const PLUMBER_DID = 'did:plc:fouf3svmcxzn6bpiw3lgwz22';
    
    // List of DIDs to exclude from leaderboard
    const excludedDids = [
      PLUMBER_DID, // plumber.flushes.app (formerly plumber.flushing.im)
      'did:plc:fnhrjbkwjiw6iyxxg2o3rljw'  // testing.dame.is
    ];
    
    // List of handles to exclude from leaderboard (as fallback)
    // Include both the old and new plumber handles for backward compatibility
    const excludedHandles = [
      'plumber.flushes.app',  // New plumber handle
      'plumber.flushing.im',  // Old plumber handle (for backward compatibility)
      'testing.dame.is'
    ];
    
    // Define a type for emoji statistics
    type EmojiStat = {
      emoji: string;
      count: number;
    };
    
    // Use the approved emojis list defined at the top of the file
    
    // If we have Supabase credentials, fetch stats
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // 1. Get total flush count - using multiple approaches for accuracy
      console.log('Fetching total flush count from database...');
      
      let totalCount = null;
      
      // Method 1: Get the count using the most reliable count query
      try {
        console.log('Trying count method 1: standard count query');
        const { count, error: countError } = await supabase
          .from('flushing_records')
          .select('*', { count: 'exact', head: true });
        
        if (countError) {
          throw countError;
        }
        
        if (count !== null) {
          console.log(`Method 1 returned count: ${count}`);
          totalCount = count;
        }
      } catch (err) {
        console.error('Count method 1 failed:', err);
      }
      
      // Method 2: Get the maximum ID as a sanity check
      try {
        console.log('Trying count method 2: getting highest ID');
        const { data: maxIdData, error: maxIdError } = await supabase
          .from('flushing_records')
          .select('id')
          .order('id', { ascending: false })
          .limit(1);
        
        if (!maxIdError && maxIdData && maxIdData.length > 0) {
          const highestId = Number(maxIdData[0].id);
          console.log(`Highest ID in database: ${highestId}`);
          
          // If highest ID is significantly higher than our count, something might be wrong
          if (totalCount !== null && highestId > totalCount * 1.2) {
            console.warn(`Warning: Highest ID (${highestId}) is much higher than count (${totalCount})`);
          }
        }
      } catch (err) {
        console.error('Count method 2 failed:', err);
      }
      
      // Method 3: Get count by fetching all IDs and counting them
      try {
        console.log('Trying count method 3: fetching and counting all IDs');
        const { data: allIds, error: idsError } = await supabase
          .from('flushing_records')
          .select('id');
        
        if (!idsError && allIds) {
          const countFromIds = allIds.length;
          console.log(`Method 3 returned count: ${countFromIds}`);
          
          // If our first method didn't work or returned a lower count, use this one
          if (totalCount === null || countFromIds > totalCount) {
            console.log(`Updating count from ${totalCount} to ${countFromIds} from method 3`);
            totalCount = countFromIds;
          }
        }
      } catch (err) {
        console.error('Count method 3 failed:', err);
      }
      
      // Final check: Ensure we have a valid count, or default to 0
      if (totalCount === null) {
        console.warn('All count methods failed, defaulting to 0');
        totalCount = 0;
      }
      
      console.log(`Final total count: ${totalCount}`);
      

      // 2. Get daily flush counts for the chart and emoji data
      const { data: dailyData, error: dailyError } = await supabase
        .from('flushing_records')
        .select('created_at, did, handle, emoji')
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
      
      // Calculate Monthly Active Flushers (MAFs)
      // This is the number of unique DIDs that have posted at least once in the past 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Filter records to get only those from the last 30 days
      const recentRecords = dailyData?.filter(entry => 
        new Date(entry.created_at) >= thirtyDaysAgo
      );
      
      // Get unique DIDs from recent records - excluding test accounts and plumber
      const recentUniqueDids = new Set<string>();
      recentRecords?.forEach(entry => {
        // Only count if not an excluded account
        const isExcludedDid = entry.did && excludedDids.includes(entry.did);
        const isExcludedHandle = entry.handle && typeof entry.handle === 'string' && excludedHandles.includes(entry.handle);
        
        if (entry.did && !isExcludedDid && !isExcludedHandle) {
          recentUniqueDids.add(entry.did);
        }
      });
      
      let monthlyActiveFlushers = recentUniqueDids.size;
      console.log(`Monthly Active Flushers (last 30 days): ${monthlyActiveFlushers}`);
      
      // Calculate Daily Active Flushers (DAFs)
      // This is the average number of unique users who post per day over the last 30 days
      const dailyActiveUserCounts = new Map<string, Set<string>>();
      
      // Group users by day - excluding test accounts and plumber
      recentRecords?.forEach(entry => {
        if (!entry.did) return; // Skip entries without a DID
        
        // Skip excluded accounts
        const isExcludedDid = excludedDids.includes(entry.did);
        const isExcludedHandle = entry.handle && typeof entry.handle === 'string' && excludedHandles.includes(entry.handle);
        
        if (isExcludedDid || isExcludedHandle) {
          return;
        }
        
        const date = new Date(entry.created_at);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        if (!dailyActiveUserCounts.has(dateKey)) {
          dailyActiveUserCounts.set(dateKey, new Set<string>());
        }
        
        dailyActiveUserCounts.get(dateKey)!.add(entry.did);
      });
      
      // Calculate average daily active users
      let dailyActiveFlushers = 0;
      if (dailyActiveUserCounts.size > 0) {
        const totalDailyActiveUsers = Array.from(dailyActiveUserCounts.values()).reduce(
          (total, users) => total + users.size, 0
        );
        dailyActiveFlushers = parseFloat((totalDailyActiveUsers / dailyActiveUserCounts.size).toFixed(1));
      }
      console.log(`Daily Active Flushers (average over last 30 days): ${dailyActiveFlushers}`);
      
      // Sanity check: daily active flushers (average) should not exceed monthly active flushers
      if (dailyActiveFlushers > monthlyActiveFlushers) {
        console.error(`Warning: Daily active flushers avg (${dailyActiveFlushers}) exceeds monthly active flushers (${monthlyActiveFlushers}). This should not happen.`);
        // Cap daily active flushers at the monthly active flushers value
        dailyActiveFlushers = parseFloat(Math.min(monthlyActiveFlushers, dailyActiveFlushers).toFixed(1));
        console.log(`Correcting daily active flushers to ${dailyActiveFlushers}`);
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
      
      // Special count for the plumber account
      let plumberFlushCount = 0;
      
      leaderboardData?.forEach(entry => {
        // Check if this is the plumber account (by DID or either handle)
        if (entry.did === PLUMBER_DID || 
            entry.handle === 'plumber.flushes.app' ||
            entry.handle === 'plumber.flushing.im') {
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
      
      // Calculate total unique flushers (count of unique DIDs)
      const totalFlushers = didCounts.size;
      console.log(`Total unique flushers: ${totalFlushers}`);
      
      // Sanity check: make sure monthly active flushers is not greater than total flushers
      if (monthlyActiveFlushers > totalFlushers) {
        console.error(`Warning: Monthly active flushers (${monthlyActiveFlushers}) exceeds total flushers (${totalFlushers}). This should never happen.`);
        // If we somehow still have an inconsistency, cap the monthly active flushers
        const correctedMAF = Math.min(totalFlushers, monthlyActiveFlushers);
        console.log(`Correcting monthly active flushers from ${monthlyActiveFlushers} to ${correctedMAF}`);
        monthlyActiveFlushers = correctedMAF;
      }
      
      // 4. Collect emoji statistics
      console.log('Collecting emoji statistics...');
      const emojiCounts = new Map<string, number>();
      
      // Process all flush records to count emojis
      dailyData?.forEach(entry => {
        if (entry.emoji) {
          // Default to toilet emoji if empty
          const emoji = entry.emoji.trim() || '🚽';
          // Only count approved emojis
          if (APPROVED_EMOJIS.includes(emoji)) {
            emojiCounts.set(emoji, (emojiCounts.get(emoji) || 0) + 1);
          } else {
            // Count as default toilet emoji if not approved
            emojiCounts.set('🚽', (emojiCounts.get('🚽') || 0) + 1);
          }
        } else {
          // Count default toilet emoji if no emoji specified
          emojiCounts.set('🚽', (emojiCounts.get('🚽') || 0) + 1);
        }
      });
      
      // Convert to array and sort by count (most popular first)
      const emojiStats = Array.from(emojiCounts.entries())
        .map(([emoji, count]): EmojiStat => ({ emoji, count }))
        .sort((a, b) => b.count - a.count);
      
      console.log(`Collected stats for ${emojiStats.length} different emojis`);
      
      // Return the data
      return NextResponse.json({
        totalCount,
        flushesPerDay,
        chartData: chartData.slice(-30), // Last 30 days
        leaderboard,
        plumberFlushCount,
        totalFlushers,
        monthlyActiveFlushers,
        dailyActiveFlushers,
        emojiStats
      });
    } else {
      // If no Supabase credentials, return mock data
      return NextResponse.json({
        totalCount: 42,
        flushesPerDay: 3.5,
        chartData: generateMockChartData(),
        leaderboard: generateMockLeaderboard(),
        plumberFlushCount: 15,
        totalFlushers: 28,
        monthlyActiveFlushers: 18,
        dailyActiveFlushers: 5.2,
        emojiStats: generateMockEmojiStats()
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

// Generate mock emoji stats
function generateMockEmojiStats() {
  // Use the first 20 approved emojis for mock data
  const popularEmojis = APPROVED_EMOJIS.slice(0, 20);
  
  return popularEmojis.map((emoji, index) => {
    // Generate counts with descending values
    const count = Math.floor(Math.random() * 20) + (20 - index);
    return { emoji, count };
  }).sort((a, b) => b.count - a.count); // Sort by count in descending order
}