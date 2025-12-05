'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from './profile.module.css';
import { sanitizeText, containsBannedWords } from '@/lib/content-filter';
import { formatRelativeTime } from '@/lib/time-utils';
import { useAuth } from '@/lib/auth-context';
import EditFlushModal from '@/components/EditFlushModal';

// Define approved emojis list - keep in sync with API route
const APPROVED_EMOJIS = [
  '🚽', '🧻', '💩', '💨', '🚾', '🧼', '🪠', '🚻', '🩸', '💧', '💦', '😌', 
  '😣', '🤢', '🤮', '🥴', '😮‍💨', '😳', '😵', '🌾', '🍦', '📱', '📖', '💭',
  '1️⃣', '2️⃣', '🟡', '🟤'
];

// Types for feed entries
interface FlushingEntry {
  id: string;
  uri: string;
  cid: string;
  did: string;
  text: string;
  emoji: string;
  created_at: string;
}

// Interface for emoji statistics
interface EmojiStat {
  emoji: string;
  count: number;
}

export default function ProfilePage() {
  const params = useParams();
  const handle = params.handle as string;
  const { session, isAuthenticated } = useAuth();
  
  const [entries, setEntries] = useState<FlushingEntry[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [flushesPerDay, setFlushesPerDay] = useState<number>(0);
  const [chartData, setChartData] = useState<{date: string, count: number}[]>([]);
  const [emojiStats, setEmojiStats] = useState<EmojiStat[]>([]);
  const [wrapped2025Data, setWrapped2025Data] = useState<{
    totalFlushes: number;
    daysActive: number;
    topEmoji: string;
    topEmojiCount: number;
    mostFlushesInDay: number;
    activeStreak: number;
    mostActiveMonth: string;
    avgStatusLength: number;
    mostFrequentTime: string;
  } | null>(null);
  const [editingFlush, setEditingFlush] = useState<FlushingEntry | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  // Match Bluesky's API response format
  interface ProfileData {
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    banner?: string;
    followersCount?: number;
    followsCount?: number;
    postsCount?: number;
    indexedAt?: string;
    viewer?: any;
  }
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  useEffect(() => {
    // Fetch the user's statuses and profile data when the component mounts
    fetchUserStatuses();
    fetchProfileData();
  }, [handle]);
  
  // Function to fetch the user's profile data directly
  const fetchProfileData = async () => {
    try {
      setProfileLoading(true);
      setProfileError(null);
      
      // The handle could be either a DID or a regular handle
      // Bluesky API's getProfile endpoint accepts both
      const actor = handle;
      
      // Fetch profile data directly from Bluesky API
      const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`);
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setProfileData(profileData);
        console.log("Fetched profile data:", profileData);
      } else {
        const errorText = await profileResponse.text();
        console.warn(`Failed to fetch profile data: ${profileResponse.statusText}`, errorText);
        setProfileError(`Failed to fetch profile: ${profileResponse.status}`);
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      setProfileError(error.message || "Failed to fetch profile data");
    } finally {
      setProfileLoading(false);
    }
  };

  // Function to fetch the user's statuses
  const fetchUserStatuses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Step 1: Resolve handle to DID
      console.log(`Resolving handle ${handle} to DID...`);
      const resolveResponse = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
      
      if (!resolveResponse.ok) {
        throw new Error(`Failed to resolve handle: ${resolveResponse.statusText}`);
      }
      
      const resolveData = await resolveResponse.json();
      const did = resolveData.did;
      console.log(`Resolved handle ${handle} to DID: ${did}`);
      
      // Step 2: Get PDS endpoint from PLC directory
      console.log(`Getting PDS endpoint for DID ${did}...`);
      const plcResponse = await fetch(`https://plc.directory/${did}/data`);
      
      if (!plcResponse.ok) {
        throw new Error(`Failed to get PDS endpoint: ${plcResponse.statusText}`);
      }
      
      const plcData = await plcResponse.json();
      console.log('PLC directory data:', plcData);
      
      // Find the PDS service
      const pdsService = plcData.services?.atproto_pds;
      
      if (!pdsService?.endpoint) {
        throw new Error('No PDS service endpoint found');
      }
      
      // Extract the hostname from the PDS endpoint
      const serviceUrl = new URL(pdsService.endpoint);
      const servicePds = serviceUrl.hostname;
      const serviceEndpoint = `https://${servicePds}`;
      console.log(`Using PDS endpoint: ${serviceEndpoint}`);
      
      // Step 3: Fetch records from PDS
      let allRecords: any[] = [];
      let cursor: string | undefined;
      let hasMore = true;
      
      while (hasMore) {
        const listRecordsUrl = `${serviceEndpoint}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=im.flushing.right.now&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
        console.log(`Fetching records from: ${listRecordsUrl}`);
        
        const recordsResponse = await fetch(listRecordsUrl, {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!recordsResponse.ok) {
          throw new Error(`Failed to fetch records: ${recordsResponse.statusText}`);
        }
        
        const recordsData = await recordsResponse.json();
        console.log(`Fetched ${recordsData.records.length} records${cursor ? ' (next page)' : ''}`);
        
        // Add records to our collection
        allRecords = [...allRecords, ...recordsData.records];
        
        // Check if we have more pages
        cursor = recordsData.cursor;
        hasMore = !!cursor && recordsData.records.length === 100;
        
        if (hasMore) {
          console.log(`More records available, cursor: ${cursor}`);
        } else {
          console.log('No more records to fetch');
        }
      }
      
      console.log(`Total records fetched: ${allRecords.length}`);
      
      // Transform the records into our format
      const userEntries = allRecords
        .map((record: any) => {
          const text = record.value.text || '';
          if (containsBannedWords(text)) return null;
          
          return {
            id: record.uri,
            uri: record.uri,
            cid: record.cid,
            did: did,
            text: sanitizeText(text),
            emoji: record.value.emoji || '🚽',
            created_at: record.value.createdAt
          };
        })
        .filter((entry: FlushingEntry | null): entry is FlushingEntry => entry !== null);
      
      // Filter entries for 2025 for Wrapped stats
      const entries2025 = userEntries.filter((entry: FlushingEntry) => {
        const year = new Date(entry.created_at).getFullYear();
        return year === 2025;
      });
      
      // Calculate Wrapped 2025 statistics
      if (entries2025.length > 0) {
        // Days active in 2025
        const datesSet2025 = new Set<string>();
        const hourCounts = new Map<number, number>();
        const monthCounts = new Map<string, number>();
        const dayCounts = new Map<string, number>();
        const emojiCounts2025 = new Map<string, number>();
        let totalStatusLength = 0;
        
        entries2025.forEach((entry: FlushingEntry) => {
          const date = new Date(entry.created_at);
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const hour = date.getHours();
          
          datesSet2025.add(dateKey);
          
          // Track hour frequency
          hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
          
          // Track month frequency
          monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);
          
          // Track daily counts for max in a day
          dayCounts.set(dateKey, (dayCounts.get(dateKey) || 0) + 1);
          
          // Track emoji usage
          const emoji = entry.emoji?.trim() || '🚽';
          if (APPROVED_EMOJIS.includes(emoji)) {
            emojiCounts2025.set(emoji, (emojiCounts2025.get(emoji) || 0) + 1);
          } else {
            emojiCounts2025.set('🚽', (emojiCounts2025.get('🚽') || 0) + 1);
          }
          
          // Track status length
          if (entry.text) {
            totalStatusLength += entry.text.length;
          }
        });
        
        // Most frequent time of day
        let mostFrequentHour = 0;
        let maxHourCount = 0;
        hourCounts.forEach((count, hour) => {
          if (count > maxHourCount) {
            maxHourCount = count;
            mostFrequentHour = hour;
          }
        });
        
        const formatHour = (hour: number) => {
          const period = hour >= 12 ? 'pm' : 'am';
          const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
          return `${displayHour} ${period}`;
        };
        
        // Most active month
        let mostActiveMonth = '';
        let maxMonthCount = 0;
        monthCounts.forEach((count, month) => {
          if (count > maxMonthCount) {
            maxMonthCount = count;
            mostActiveMonth = month;
          }
        });
        
        const formatMonth = (monthKey: string) => {
          const [year, month] = monthKey.split('-');
          const date = new Date(parseInt(year), parseInt(month) - 1);
          return date.toLocaleDateString(undefined, { month: 'short' });
        };
        
        // Most flushes in a single day
        const mostFlushesInDay = Math.max(...Array.from(dayCounts.values()));
        
        // Calculate active streak (consecutive days)
        const sortedDates = Array.from(datesSet2025).sort();
        let currentStreak = 1;
        let maxStreak = 1;
        
        for (let i = 1; i < sortedDates.length; i++) {
          const prevDate = new Date(sortedDates[i - 1]);
          const currDate = new Date(sortedDates[i]);
          const diffTime = Math.abs(currDate.getTime() - prevDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
          } else {
            currentStreak = 1;
          }
        }
        
        // Top emoji
        let topEmoji = '🚽';
        let topEmojiCount = 0;
        emojiCounts2025.forEach((count, emoji) => {
          if (count > topEmojiCount) {
            topEmojiCount = count;
            topEmoji = emoji;
          }
        });
        
        // Average status length
        const avgStatusLength = entries2025.filter(e => e.text).length > 0 
          ? Math.round(totalStatusLength / entries2025.filter(e => e.text).length)
          : 0;
        
        setWrapped2025Data({
          totalFlushes: entries2025.length,
          daysActive: datesSet2025.size,
          topEmoji,
          topEmojiCount,
          mostFlushesInDay,
          activeStreak: maxStreak,
          mostActiveMonth: mostActiveMonth ? formatMonth(mostActiveMonth) : 'N/A',
          avgStatusLength,
          mostFrequentTime: formatHour(mostFrequentHour)
        });
      } else {
        setWrapped2025Data(null);
      }
      
      // Calculate emoji statistics
      const emojiCounts = new Map<string, number>();
      userEntries.forEach((entry: FlushingEntry) => {
        const emoji = entry.emoji?.trim() || '🚽';
        if (APPROVED_EMOJIS.includes(emoji)) {
          emojiCounts.set(emoji, (emojiCounts.get(emoji) || 0) + 1);
        } else {
          emojiCounts.set('🚽', (emojiCounts.get('🚽') || 0) + 1);
        }
      });
      
      const emojiStats = Array.from(emojiCounts.entries())
        .map(([emoji, count]): EmojiStat => ({ emoji, count }))
        .sort((a, b) => b.count - a.count);
      
      setEntries(userEntries);
      setTotalCount(userEntries.length);
      setEmojiStats(emojiStats);
      
      // Calculate statistics and chart data
      if (userEntries.length > 0) {
        // Calculate actual active days count (days with at least one flush)
        const dateSet = new Set<string>();
        userEntries.forEach((entry: FlushingEntry) => {
          const date = new Date(entry.created_at);
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          dateSet.add(dateKey);
        });
        
        // Calculate true average: total flushes divided by number of active days
        const activeDaysCount = Math.max(1, dateSet.size);
        const perDay = parseFloat((userEntries.length / activeDaysCount).toFixed(1));
        setFlushesPerDay(perDay);
        
        // Generate chart data (group by month) - filter for 2025 and later
        const chartDataMap = new Map<string, number>();
        
        // Filter entries to only include 2025 and later
        const entries2025Plus = userEntries.filter((entry: FlushingEntry) => {
          const year = new Date(entry.created_at).getFullYear();
          return year >= 2025;
        });
        
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
          chartDataMap.set(monthKey, 0);
          currentMonth.setMonth(currentMonth.getMonth() + 1);
        }
        
        // Group entries by month
        if (entries2025Plus.length > 0) {
          entries2025Plus.forEach((entry: FlushingEntry) => {
            const date = new Date(entry.created_at);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (chartDataMap.has(monthKey)) {
              chartDataMap.set(monthKey, chartDataMap.get(monthKey)! + 1);
            } else {
              chartDataMap.set(monthKey, 1);
            }
          });
        }
        
        // Convert map to array and sort by date
        const chartDataArray = Array.from(chartDataMap.entries())
          .map(([month, count]): {date: string, count: number} => ({ date: month, count }))
          .sort((a, b) => a.date.localeCompare(b.date));
        
        setChartData(chartDataArray);
      } else {
        setFlushesPerDay(0);
        setChartData([]);
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // Check if the current user owns this profile
  const isOwnProfile = () => {
    if (!session || !profileData) return false;
    return session.sub === profileData.did;
  };

  // Handle updating a flush
  const handleUpdateFlush = async (text: string, emoji: string) => {
    if (!session || !editingFlush) {
      setActionError('You must be logged in to update a flush');
      return;
    }

    try {
      setActionError(null);
      setActionSuccess(null);

      const { updateFlushRecord } = await import('@/lib/api-client');
      
      await updateFlushRecord(
        session,
        editingFlush.uri,
        text,
        emoji,
        editingFlush.created_at
      );

      setActionSuccess('Flush updated successfully!');
      
      // Update the local state
      setEntries(entries.map(entry => 
        entry.uri === editingFlush.uri 
          ? { ...entry, text, emoji }
          : entry
      ));

      // Clear success message after 3 seconds
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (error: any) {
      console.error('Error updating flush:', error);
      setActionError(error.message || 'Failed to update flush');
    }
  };

  // Handle deleting a flush
  const handleDeleteFlush = async () => {
    if (!session || !editingFlush) {
      setActionError('You must be logged in to delete a flush');
      return;
    }

    try {
      setActionError(null);
      setActionSuccess(null);

      const { deleteFlushRecord } = await import('@/lib/api-client');
      
      await deleteFlushRecord(session, editingFlush.uri);

      setActionSuccess('Flush deleted successfully!');
      
      // Remove from local state
      setEntries(entries.filter(entry => entry.uri !== editingFlush.uri));
      setTotalCount(totalCount - 1);

      // Clear success message after 3 seconds
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (error: any) {
      console.error('Error deleting flush:', error);
      setActionError(error.message || 'Failed to delete flush');
    }
  };

  return (
    <div className={styles.container}>
      
      {/* Action messages */}
      {actionError && (
        <div className={styles.actionError}>
          {actionError}
        </div>
      )}
      
      {actionSuccess && (
        <div className={styles.actionSuccess}>
          {actionSuccess}
        </div>
      )}

      {/* Edit Modal */}
      <EditFlushModal
        isOpen={editingFlush !== null}
        flushData={editingFlush ? {
          uri: editingFlush.uri,
          text: editingFlush.text,
          emoji: editingFlush.emoji,
          created_at: editingFlush.created_at
        } : null}
        onSave={handleUpdateFlush}
        onDelete={handleDeleteFlush}
        onClose={() => setEditingFlush(null)}
      />
      
      <div className={styles.profileHeader}>
        <div className={styles.profileInfo}>
          {profileLoading ? (
            <div className={styles.profileLoading}>
              <h2 className={`${styles.profileTitle} font-bold`}>{handle.startsWith('did:') ? 'Loading Profile...' : `@${handle}`}</h2>
              <div className={styles.smallLoader}></div>
            </div>
          ) : profileError ? (
            <div>
              <h2 className={`${styles.profileTitle} font-bold`}>{handle.startsWith('did:') ? 'Profile' : `@${handle}`}</h2>
              <p className={styles.smallError}>Unable to load profile details</p>
            </div>
          ) : (
            <>
              {profileData?.displayName ? (
                <>
                  <h2 className={`${styles.profileTitle} font-bold`}>{profileData.displayName}</h2>
                  <h3 className={`${styles.profileHandle} font-medium`}>@{profileData.handle}</h3>
                </>
              ) : (
                <h2 className={`${styles.profileTitle} font-bold`}>{handle.startsWith('did:') ? 'Profile' : `@${handle}`}</h2>
              )}
              
              {profileData?.description && (
                <p className={`${styles.description} font-regular`}>{profileData.description}</p>
              )}
            </>
          )}
          
          <a 
            href={profileData ? `https://bsky.app/profile/${profileData.handle}` : `https://bsky.app/profile/${handle}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className={styles.viewOnBluesky}
          >
            View account on Bluesky
          </a>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      
      {!loading && !error && (
        <section className={styles.statsSection}>
          <h2 className={styles.statsHeader}>Flushing Statistics</h2>
          <p className={styles.statDetails}>
            {totalCount} total {totalCount === 1 ? 'flush' : 'flushes'}
            {flushesPerDay > 0 && `, averaging ${flushesPerDay} ${flushesPerDay === 1 ? 'flush' : 'flushes'} per active day`}
          </p>
          
          {chartData.length > 0 ? (
            <>
              <div className={styles.chartContainer}>
                {chartData.map((dataPoint, index) => {
                  // Calculate height percentage (max of 100%)
                  const maxCount = Math.max(...chartData.map(d => d.count));
                  const heightPercent = dataPoint.count === 0 ? 0 : Math.min(100, (dataPoint.count / maxCount) * 100);
                  
                  return (
                    <div
                      key={index}
                      className={styles.chartBar}
                      style={{ height: `${heightPercent}%` }}
                      title={`${dataPoint.date}: ${dataPoint.count} flushes`}
                    />
                  );
                })}
              </div>
              
              <div className={styles.chartLegend}>
                <span className={styles.chartLegendItem}>
                  {chartData.length > 0 ? (() => {
                    const [year, month] = chartData[0].date.split('-');
                    const date = new Date(parseInt(year), parseInt(month) - 1);
                    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
                  })() : ''}
                </span>
                <span className={styles.chartLegendItem}>
                  {chartData.length > 0 ? (() => {
                    const [year, month] = chartData[chartData.length - 1].date.split('-');
                    const date = new Date(parseInt(year), parseInt(month) - 1);
                    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
                  })() : ''}
                </span>
              </div>
              
              <button 
                className={styles.shareStatsButton}
                onClick={() => {
                  // Open a new window to compose a post on Bluesky
                  // Use handle from profile data if available, otherwise use the URL parameter
                  const shareHandle = profileData?.handle || handle;
                  const statsText = `I've made ${totalCount} decentralized ${totalCount === 1 ? 'flush' : 'flushes'}${flushesPerDay > 0 ? ` (averaging ${flushesPerDay} per active day)` : ''} on @flushes.app. Flush with me here: https://flushes.app/profile/${shareHandle}`;
                  window.open(`https://bsky.app/intent/compose?text=${encodeURIComponent(statsText)}`, '_blank');
                }}
              >
                Share My Stats
              </button>
            </>
          ) : (
            <p className={styles.noDataMessage}>Not enough data to display activity chart</p>
          )}
          
          {/* Emoji Statistics Section */}
          {emojiStats.length > 0 && (
            <div className={styles.emojiStatsSection}>
              <h4 className={styles.emojiStatsHeader}>Favorite Emoji</h4>
              <div className={styles.emojiGrid}>
                {emojiStats.slice(0, 8).map((stat, index) => (
                  <div key={index} className={styles.emojiCard}>
                    <div className={styles.emojiDisplay}>{stat.emoji}</div>
                    <div className={styles.emojiCount}>{stat.count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Flushes Roll Up 2025 Section */}
      {!loading && !error && wrapped2025Data && (
        <section className={styles.wrappedSection}>
          <h2 className={styles.wrappedHeader}>Flushes Roll Up 2025</h2>
          <p className={styles.wrappedSubtitle}>The past year on the decentralized toilet</p>
          
          <div className={styles.wrappedGrid}>
            <div className={styles.wrappedCard}>
              <div className={styles.wrappedValue}>{wrapped2025Data.totalFlushes}</div>
              <div className={styles.wrappedLabel}>Total Flushes</div>
            </div>
            
            <div className={styles.wrappedCard}>
              <div className={styles.wrappedValue}>{wrapped2025Data.daysActive}</div>
              <div className={styles.wrappedLabel}>Days Active</div>
            </div>
            
            <div className={styles.wrappedCard}>
              <div className={styles.wrappedEmoji}>{wrapped2025Data.topEmoji}</div>
              <div className={styles.wrappedLabel}>Top Emoji</div>
            </div>
            
            <div className={styles.wrappedCard}>
              <div className={styles.wrappedValue}>{wrapped2025Data.mostFlushesInDay}</div>
              <div className={styles.wrappedLabel}>Most in a Day</div>
            </div>
            
            <div className={styles.wrappedCard}>
              <div className={styles.wrappedValue}>{wrapped2025Data.activeStreak} days</div>
              <div className={styles.wrappedLabel}>Longest Streak</div>
            </div>
            
            <div className={styles.wrappedCard}>
              <div className={styles.wrappedValue}>{wrapped2025Data.mostActiveMonth}</div>
              <div className={styles.wrappedLabel}>Top Month</div>
            </div>
            
            <div className={styles.wrappedCard}>
              <div className={styles.wrappedValue}>{wrapped2025Data.avgStatusLength}/59</div>
              <div className={styles.wrappedLabel}>Avg. Characters</div>
            </div>
            
            <div className={styles.wrappedCard}>
              <div className={styles.wrappedValue}>{wrapped2025Data.mostFrequentTime}</div>
              <div className={styles.wrappedLabel}>Peak Flush Hour</div>
            </div>
          </div>
          
          <button 
            className={styles.shareWrappedButton}
            onClick={() => {
              const shareHandle = profileData?.handle || handle;
              const wrappedText = `My @flushes.app Roll Up 2025:\n\n${wrapped2025Data.totalFlushes} total flushes\n${wrapped2025Data.daysActive} days active\nTop emoji: ${wrapped2025Data.topEmoji}\nMost in one day: ${wrapped2025Data.mostFlushesInDay}\nLongest streak: ${wrapped2025Data.activeStreak} days\nMost active month: ${wrapped2025Data.mostActiveMonth}\nAvg. characters: ${wrapped2025Data.avgStatusLength}\nPeak time: ${wrapped2025Data.mostFrequentTime}\n\nSee your stats at flushes.app! 🚽`;
              window.open(`https://bsky.app/intent/compose?text=${encodeURIComponent(wrappedText)}`, '_blank');
            }}
          >
            Share My Roll Up
          </button>
        </section>
      )}

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loader}></div>
          <p>Loading profile...</p>
        </div>
      ) : (
        <div className={styles.feedList}>
          {entries.length > 0 ? (
            entries.map((entry) => (
              <div 
                key={entry.id} 
                className={styles.feedItem}
              >
                <div className={styles.content}>
                  <div className={styles.contentLeft}>
                    <span className={styles.emoji}>{entry.emoji}</span>
                    <span className={styles.author}>@{handle}</span>
                    <span className={styles.text}>
                      {entry.text ? (
                        handle && handle.endsWith('.is') ? 
                          // For handles ending with .is, remove the "is" prefix if it exists
                          (sanitizeText(entry.text).toLowerCase().startsWith('is ') ? 
                            (entry.text.length > 63 ? `${sanitizeText(entry.text.substring(3, 63))}...` : sanitizeText(entry.text.substring(3))) : 
                            (entry.text.length > 60 ? `${sanitizeText(entry.text.substring(0, 60))}...` : sanitizeText(entry.text))
                          ) :
                          // For regular handles, display normal text
                          (entry.text.length > 60 ? `${sanitizeText(entry.text.substring(0, 60))}...` : sanitizeText(entry.text))
                      ) : (
                        handle && handle.endsWith('.is') ? 
                          'flushing' : 'is flushing'
                      )}
                    </span>
                  </div>
                  <div className={styles.contentRight}>
                    <span className={styles.timestamp}>
                      {formatRelativeTime(entry.created_at)}
                    </span>
                    {isOwnProfile() && isAuthenticated && (
                      <button
                        className={styles.editButton}
                        onClick={() => setEditingFlush(entry)}
                        aria-label="Edit flush"
                        title="Edit or delete this flush"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              <p>No statuses found for this user.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}