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

// Function to fetch true count from Bluesky API for a specific DID
async function fetchTrueCountFromBluesky(did: string): Promise<number> {
  try {
    console.log(`Fetching true count for DID: ${did}`);
    
    // Step 1: Get PDS endpoint from PLC directory
    const plcResponse = await fetch(`https://plc.directory/${did}/data`);
    
    if (!plcResponse.ok) {
      console.warn(`Failed to get PLC data for ${did}: ${plcResponse.statusText}`);
      return 0;
    }
    
    const plcData = await plcResponse.json();
    const pdsService = plcData.services?.atproto_pds;
    
    if (!pdsService?.endpoint) {
      console.warn(`No PDS service endpoint found for ${did}`);
      return 0;
    }
    
    // Extract the hostname from the PDS endpoint
    const serviceUrl = new URL(pdsService.endpoint);
    const servicePds = serviceUrl.hostname;
    const serviceEndpoint = `https://${servicePds}`;
    
    console.log(`Using PDS endpoint for ${did}: ${serviceEndpoint}`);
    
    // Step 2: Fetch all records from PDS
    let allRecords: any[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 100; // Safety limit to prevent infinite loops
    
    while (hasMore && pageCount < maxPages) {
      const listRecordsUrl = `${serviceEndpoint}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=im.flushing.right.now&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      
      try {
        const recordsResponse = await fetch(listRecordsUrl, {
          headers: {
            'Accept': 'application/json'
          },
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(5000)
        });
        
        if (!recordsResponse.ok) {
          // If we get a 404, the collection might be empty
          if (recordsResponse.status === 404) {
            console.log(`Empty collection for ${did}`);
            break;
          }
          
          console.warn(`Failed to fetch records for ${did}: ${recordsResponse.statusText}`);
          break;
        }
        
        const recordsData = await recordsResponse.json();
        allRecords = [...allRecords, ...recordsData.records];
        
        cursor = recordsData.cursor;
        hasMore = !!cursor && recordsData.records.length === 100;
        pageCount++;
        
        console.log(`Fetched page ${pageCount} for ${did}: ${recordsData.records.length} records, total: ${allRecords.length}`);
        
      } catch (fetchError) {
        console.error(`Error fetching records for ${did}:`, fetchError);
        break;
      }
    }
    
    if (pageCount >= maxPages) {
      console.warn(`Reached maximum page limit for ${did}, may have incomplete data`);
    }
    
    console.log(`Total records fetched for ${did}: ${allRecords.length}`);
    return allRecords.length;
    
  } catch (error) {
    console.error(`Error fetching true count for ${did}:`, error);
    return 0;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Define the plumber's DID - this is the official plumber account DID
    const PLUMBER_DID = 'did:plc:fouf3svmcxzn6bpiw6iyxxg2o3rljw';
    
    // List of DIDs to exclude from leaderboard
    const excludedDids = [
      PLUMBER_DID, // plumber.flushes.app (formerly plumber.flushing.im)
      'did:plc:fouf3svmcxzn6bpiw3lgwz22'  // testing.dame.is
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
      

      // 2. Get daily flush counts for the chart and emoji data - PAGINATE to get all records
      console.log('Fetching ALL flushing records for chart data...');
      let allDailyData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        console.log(`Fetching daily data page: ${from} to ${from + pageSize - 1}`);
        
        const { data: pageData, error: pageError } = await supabase
          .from('flushing_records')
          .select('created_at, did, handle, emoji')
          .order('created_at', { ascending: true })
          .range(from, from + pageSize - 1);
        
        if (pageError) {
          throw new Error(`Failed to get daily data: ${pageError.message}`);
        }
        
        if (!pageData || pageData.length === 0) {
          hasMore = false;
        } else {
          allDailyData = [...allDailyData, ...pageData];
          hasMore = pageData.length === pageSize;
          from += pageSize;
        }
      }
      
      const dailyData = allDailyData;
      
      console.log(`Total records fetched: ${dailyData?.length || 0}`);
      if (dailyData && dailyData.length > 0) {
        console.log(`First record: ${JSON.stringify(dailyData[0])}`);
        console.log(`Last record: ${JSON.stringify(dailyData[dailyData.length - 1])}`);
        
        // Check how many records have DIDs
        const recordsWithDid = dailyData.filter(r => r.did);
        console.log(`Records with DID: ${recordsWithDid.length}`);
      }
      
      // Create a map of month -> count (filter for 2025+)
      const monthlyCounts = new Map<string, number>();
      
      // Filter data to only include 2025 and later
      const data2025Plus = dailyData?.filter(entry => {
        const year = new Date(entry.created_at).getFullYear();
        return year >= 2025;
      });
      
      console.log(`Filtered records for 2025+: ${data2025Plus?.length || 0}`);
      if (data2025Plus && data2025Plus.length > 0) {
        console.log(`First 2025+ record: ${JSON.stringify(data2025Plus[0])}`);
        console.log(`Last 2025+ record: ${JSON.stringify(data2025Plus[data2025Plus.length - 1])}`);
      }
      
      // Initialize all months from Jan 2025 to current month (or Dec 2025 if in future years)
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonthNum = now.getMonth(); // 0-11
      
      // Start from January 2025
      const startMonth = new Date(2025, 0, 1);
      
      // End at current month if we're in 2025, otherwise go to Dec 2025
      const endMonth = currentYear === 2025 
        ? new Date(currentYear, currentMonthNum, 1)
        : new Date(2025, 11, 1); // December 2025
      
      let currentMonth = new Date(startMonth);
      while (currentMonth <= endMonth) {
        const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
        monthlyCounts.set(monthKey, 0);
        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }
      
      // Process each entry to get monthly counts
      if (data2025Plus && data2025Plus.length > 0) {
        data2025Plus.forEach(entry => {
          const date = new Date(entry.created_at);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          // Debug logging for first few entries
          if (monthlyCounts.get(monthKey) === 0) {
            console.log(`First entry for ${monthKey}: ${entry.created_at}`);
          }
          
          if (monthlyCounts.has(monthKey)) {
            monthlyCounts.set(monthKey, (monthlyCounts.get(monthKey) || 0) + 1);
          } else {
            monthlyCounts.set(monthKey, 1);
          }
        });
      }
      
      console.log(`Monthly counts map:`, Object.fromEntries(monthlyCounts));
      // Convert to array sorted by date
      const chartData = Array.from(monthlyCounts.entries())
        .map(([date, count]): {date: string, count: number} => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      // Calculate flushes per day based on actual active days
      // Count actual days with flushes for the flushes per day calculation
      const dailyCountsForAvg = new Map<string, number>();
      dailyData?.forEach(entry => {
        const date = new Date(entry.created_at);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        if (dailyCountsForAvg.has(dateKey)) {
          dailyCountsForAvg.set(dateKey, (dailyCountsForAvg.get(dateKey) || 0) + 1);
        } else {
          dailyCountsForAvg.set(dateKey, 1);
        }
      });
      
      let flushesPerDay = 0;
      if (dailyCountsForAvg.size > 0 && totalCount !== null) {
        // Use the number of days with at least one flush
        const activeDaysCount = dailyCountsForAvg.size;
        flushesPerDay = parseFloat(((totalCount || 0) / activeDaysCount).toFixed(1));
      }
      
      // Calculate Monthly Active Flushers (MAFs)
      // This is the number of unique DIDs that have posted at least once in the past 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      console.log(`Calculating MAF/DAF for records after: ${thirtyDaysAgo.toISOString()}`);
      console.log(`Total records available: ${dailyData?.length || 0}`);
      
      // Filter records to get only those from the last 30 days
      const recentRecords = dailyData?.filter(entry => 
        new Date(entry.created_at) >= thirtyDaysAgo
      );
      
      console.log(`Recent records (last 30 days): ${recentRecords?.length || 0}`);
      
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
      console.log(`Unique DIDs in recent records: ${Array.from(recentUniqueDids).join(', ')}`);
      
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
      // Note: We need ALL records to get accurate counts, not just recent ones
      console.log('Fetching ALL flushing records for accurate leaderboard counts...');
      
      let allLeaderboardData: any[] = [];
      let from = 0;
      const pageSize = 1000; // Supabase's default limit
      let hasMore = true;
      
      while (hasMore) {
        console.log(`Fetching leaderboard page: ${from} to ${from + pageSize - 1}`);
        
        const { data: pageData, error: pageError } = await supabase
          .from('flushing_records')
          .select('did, handle')
          .range(from, from + pageSize - 1);
        
        if (pageError) {
          throw new Error(`Failed to get leaderboard data: ${pageError.message}`);
        }
        
        if (!pageData || pageData.length === 0) {
          hasMore = false;
        } else {
          allLeaderboardData = [...allLeaderboardData, ...pageData];
          hasMore = pageData.length === pageSize; // If we got a full page, there might be more
          from += pageSize;
        }
      }
      
      console.log(`Total leaderboard records fetched: ${allLeaderboardData.length}`);
      const leaderboardData = allLeaderboardData;
      
      // Count flushes by DID from Supabase (for ranking only)
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
      
      // Convert to array and sort by count to get top 15 DIDs (fetch extra in case some have 0)
      const top15Dids = Array.from(didCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([did]) => did);
      
      console.log(`Top 15 DIDs from Supabase ranking: ${top15Dids.join(', ')}`);
      
      // Now fetch true counts from Bluesky API for these top 15 DIDs
      console.log('Fetching true counts from Bluesky API for top 15 users...');
      const leaderboardWithTrueCounts = await Promise.all(
        top15Dids.map(async (did) => {
          const trueCount = await fetchTrueCountFromBluesky(did);
          const supabaseCount = didCounts.get(did) || 0;
          
          console.log(`DID ${did}: Supabase count = ${supabaseCount}, True count = ${trueCount}`);
          
          return {
            did,
            count: trueCount, // Use the true count from Bluesky API
            supabaseCount // Include for comparison/debugging
          };
        })
      );
      
      // Sort by true count (descending) in case the order changed, filter out 0s, and take top 10
      const leaderboard = leaderboardWithTrueCounts
        .filter(item => item.count > 0) // Only include users with at least 1 flush
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Take top 10 after filtering
      
      console.log(`Leaderboard after filtering (${leaderboard.length} users with flushes > 0)`);
      
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
        chartData, // Return all months
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

// Generate mock chart data (by month)
function generateMockChartData() {
  const chartData = [];
  const today = new Date();
  
  // Generate data for the last 12 months
  for (let i = 11; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    // Random count between 5 and 50
    const count = Math.floor(Math.random() * 46) + 5;
    
    chartData.push({ date: monthKey, count });
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