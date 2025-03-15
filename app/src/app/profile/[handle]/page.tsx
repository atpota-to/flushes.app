'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from './profile.module.css';
import { sanitizeText } from '@/lib/content-filter';
import { formatRelativeTime } from '@/lib/time-utils';

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
      
      // Call our API endpoint to get the user's statuses
      // The endpoint parameter is named "handle" but it accepts both handles and DIDs
      const response = await fetch(`/api/bluesky/profile?handle=${encodeURIComponent(handle)}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.status}`);
      }
      
      const data = await response.json();
      const userEntries = data.entries || [];
      setEntries(userEntries);
      setTotalCount(data.count || 0);
      
      // We now fetch profile data separately
      
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
        
        // Generate chart data (group by day)
        const chartDataMap = new Map<string, number>();
        
        // Group entries by day
        userEntries.forEach((entry: FlushingEntry) => {
          const date = new Date(entry.created_at);
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          
          if (chartDataMap.has(dateKey)) {
            chartDataMap.set(dateKey, chartDataMap.get(dateKey)! + 1);
          } else {
            chartDataMap.set(dateKey, 1);
          }
        });
        
        // Convert map to array and sort by date
        const chartDataArray = Array.from(chartDataMap.entries())
          .map(([date, count]): {date: string, count: number} => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));
        
        // Limit to last 30 days for chart readability
        const limitedData = chartDataArray.slice(-30);
        setChartData(limitedData);
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
                  const heightPercent = Math.max(10, Math.min(100, (dataPoint.count / maxCount) * 100));
                  
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
                  {chartData.length > 0 ? new Date(chartData[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                </span>
                <span className={styles.chartLegendItem}>
                  {chartData.length > 0 ? new Date(chartData[chartData.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
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