'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from './profile.module.css';
import { sanitizeText, containsBannedWords } from '@/lib/content-filter';
import { formatRelativeTime } from '@/lib/time-utils';

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
  
  const [entries, setEntries] = useState<FlushingEntry[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [flushesPerDay, setFlushesPerDay] = useState<number>(0);
  const [chartData, setChartData] = useState<{date: string, count: number}[]>([]);
  const [emojiStats, setEmojiStats] = useState<EmojiStat[]>([]);
  const [wrappedStats, setWrappedStats] = useState<{
    mostFrequentHour: number | null;
    daysActive: number;
    totalFlushes: number;
    topEmoji: string;
    year: number;
    mostFlushesInDay: number;
    longestStreak: number;
  } | null>(null);
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
      
      // Calculate Wrapped stats (for current year)
      const currentYear = new Date().getFullYear();
      const yearEntries = userEntries.filter((entry: FlushingEntry) => {
        const entryDate = new Date(entry.created_at);
        return entryDate.getFullYear() === currentYear;
      });
      
      if (yearEntries.length > 0) {
        // Calculate most frequent hour
        const hourCounts = new Map<number, number>();
        yearEntries.forEach((entry: FlushingEntry) => {
          const date = new Date(entry.created_at);
          const hour = date.getHours();
          hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
        });
        
        let mostFrequentHour: number | null = null;
        let maxCount = 0;
        hourCounts.forEach((count, hour) => {
          if (count > maxCount) {
            maxCount = count;
            mostFrequentHour = hour;
          }
        });
        
        // Calculate days active for the year and most flushes in a single day
        const yearDateSet = new Set<string>();
        const dayFlushCounts = new Map<string, number>();
        yearEntries.forEach((entry: FlushingEntry) => {
          const date = new Date(entry.created_at);
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          yearDateSet.add(dateKey);
          dayFlushCounts.set(dateKey, (dayFlushCounts.get(dateKey) || 0) + 1);
        });
        
        // Find most flushes in a single day
        let mostFlushesInDay = 0;
        dayFlushCounts.forEach((count) => {
          if (count > mostFlushesInDay) {
            mostFlushesInDay = count;
          }
        });
        
        // Calculate longest streak (consecutive days with at least one flush)
        const sortedDates = Array.from(yearDateSet).sort();
        let longestStreak = 0;
        let currentStreak = 0;
        let previousDate: Date | null = null;
        
        sortedDates.forEach((dateKey) => {
          const currentDate = new Date(dateKey);
          currentDate.setHours(0, 0, 0, 0);
          
          if (previousDate === null) {
            currentStreak = 1;
          } else {
            const daysDiff = Math.floor((currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff === 1) {
              currentStreak++;
            } else {
              if (currentStreak > longestStreak) {
                longestStreak = currentStreak;
              }
              currentStreak = 1;
            }
          }
          previousDate = currentDate;
        });
        
        // Check if the last streak is the longest
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
        
        // Get top emoji for the year
        const yearEmojiCounts = new Map<string, number>();
        yearEntries.forEach((entry: FlushingEntry) => {
          const emoji = entry.emoji?.trim() || '🚽';
          const validEmoji = APPROVED_EMOJIS.includes(emoji) ? emoji : '🚽';
          yearEmojiCounts.set(validEmoji, (yearEmojiCounts.get(validEmoji) || 0) + 1);
        });
        
        let topEmoji = '🚽';
        let topEmojiCount = 0;
        yearEmojiCounts.forEach((count, emoji) => {
          if (count > topEmojiCount) {
            topEmojiCount = count;
            topEmoji = emoji;
          }
        });
        
        setWrappedStats({
          mostFrequentHour,
          daysActive: yearDateSet.size,
          totalFlushes: yearEntries.length,
          topEmoji,
          year: currentYear,
          mostFlushesInDay,
          longestStreak
        });
      } else {
        setWrappedStats(null);
      }
      
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
        
        // Generate chart data (group by month)
        const monthDataMap = new Map<string, number>();
        
        // Group entries by month
        userEntries.forEach((entry: FlushingEntry) => {
          const date = new Date(entry.created_at);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          monthDataMap.set(monthKey, (monthDataMap.get(monthKey) || 0) + 1);
        });
        
        // Find the range of months from first flush to current month
        if (userEntries.length > 0) {
          // Find the oldest and newest entries
          const sortedByDate = [...userEntries].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          const firstEntry = sortedByDate[0];
          const firstDate = new Date(firstEntry.created_at);
          const lastDate = new Date(); // Current date
          
          // Generate all months in the range
          const allMonths: {date: string, count: number}[] = [];
          const currentMonth = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
          const endMonth = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);
          
          while (currentMonth <= endMonth) {
            const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
            allMonths.push({
              date: monthKey,
              count: monthDataMap.get(monthKey) || 0
            });
            
            // Move to next month
            currentMonth.setMonth(currentMonth.getMonth() + 1);
          }
          
          setChartData(allMonths);
        } else {
          setChartData([]);
        }
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

  return (
    <div className={styles.container}>
      
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
      
      {/* Flushes Wrapped Section */}
      {!loading && !error && wrappedStats && (
        <section className={styles.wrappedSection}>
          <div className={styles.wrappedHeader}>
            <h2 className={styles.wrappedTitle}>{handle}'s {wrappedStats.year} Flushes Roll Up</h2>
            <p className={styles.wrappedSubtitle}>A year in review</p>
          </div>
          
          <div className={styles.wrappedCards}>
            <div className={styles.wrappedCard}>
              <div className={styles.wrappedCardValue}>{wrappedStats.totalFlushes.toLocaleString()}</div>
              <div className={styles.wrappedCardLabel}>Total Flushes</div>
            </div>
            
            <div className={styles.wrappedCard}>
              <div className={styles.wrappedCardValue}>{wrappedStats.daysActive}</div>
              <div className={styles.wrappedCardLabel}>Days Active</div>
            </div>
            
            {wrappedStats.mostFrequentHour !== null && (
              <div className={styles.wrappedCard}>
                <div className={styles.wrappedCardValue}>
                  {wrappedStats.mostFrequentHour === 0 ? '12' : wrappedStats.mostFrequentHour > 12 ? wrappedStats.mostFrequentHour - 12 : wrappedStats.mostFrequentHour}
                  {wrappedStats.mostFrequentHour >= 12 ? 'PM' : 'AM'}
                </div>
                <div className={styles.wrappedCardLabel}>Most Active Time</div>
              </div>
            )}
            
            <div className={styles.wrappedCard}>
              <div className={styles.wrappedCardValue}>{wrappedStats.topEmoji}</div>
              <div className={styles.wrappedCardLabel}>Top Emoji</div>
            </div>
            
            {wrappedStats.mostFlushesInDay > 0 && (
              <div className={styles.wrappedCard}>
                <div className={styles.wrappedCardValue}>{wrappedStats.mostFlushesInDay}</div>
                <div className={styles.wrappedCardLabel}>Most in One Day</div>
              </div>
            )}
            
            {wrappedStats.longestStreak > 0 && (
              <div className={styles.wrappedCard}>
                <div className={styles.wrappedCardValue}>{wrappedStats.longestStreak}</div>
                <div className={styles.wrappedCardLabel}>Day Streak</div>
              </div>
            )}
          </div>
        </section>
      )}
      
      {!loading && !error && (
        <section className={styles.statsSection}>
          <h3 className={styles.statsHeader}>Flushing Statistics</h3>
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
                  const heightPercent = maxCount > 0 
                    ? Math.max(10, Math.min(100, (dataPoint.count / maxCount) * 100))
                    : 0;
                  
                  return (
                    <div
                      key={index}
                      className={styles.chartBar}
                      style={{ height: `${heightPercent}%` }}
                      title={`${new Date(dataPoint.date + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}: ${dataPoint.count} flushes`}
                    />
                  );
                })}
              </div>
              
              <div className={styles.chartLegend}>
                <span className={styles.chartLegendItem}>
                  {chartData.length > 0 ? new Date(chartData[0].date + '-01').toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : ''}
                </span>
                <span className={styles.chartLegendItem}>
                  {chartData.length > 0 ? new Date(chartData[chartData.length - 1].date + '-01').toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : ''}
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
                  <span className={styles.timestamp}>
                    {formatRelativeTime(entry.created_at)}
                  </span>
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