'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './stats.module.css';
import { formatRelativeTime } from '@/lib/time-utils';
import { useAuth } from '@/lib/auth-context';

interface StatsData {
  totalCount: number;
  flushesPerDay: number;
  chartData: { date: string; count: number }[];
  leaderboard: { did: string; count: number; handle?: string; supabaseCount?: number }[];
  plumberFlushCount: number;
  totalFlushers: number;
  monthlyActiveFlushers: number;
  dailyActiveFlushers: number;
  emojiStats: { emoji: string; count: number }[];
}

export default function StatsPage() {
  const { isAuthenticated, session, signOut } = useAuth();
  const handle = null; // Will be fetched when needed
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Function to handle logout
  const handleLogout = async () => {
    await signOut();
  };

  useEffect(() => {
    // Fetch stats data when the component mounts
    fetchStatsData();
  }, []);

  // Function to fetch stats data
  const fetchStatsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Add a timestamp to ensure we bypass any browser caching
      const timestamp = Date.now();
      const url = `/api/bluesky/stats?_t=${timestamp}`;
      
      console.log(`Fetching stats from ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Process leaderboard data - resolve handles when possible
      const leaderboardWithHandles = await Promise.all(
        data.leaderboard.map(async (item: { did: string; count: number }) => {
          // Try to resolve the DID to a handle
          try {
            const handleResponse = await fetch(`https://plc.directory/${item.did}/data`);
            if (handleResponse.ok) {
              const didDoc = await handleResponse.json();
              // Extract handle from alsoKnownAs
              const handleUrl = didDoc.alsoKnownAs?.[0];
              if (handleUrl && handleUrl.startsWith('at://')) {
                const handle = handleUrl.substring(5); // Remove 'at://'
                return { ...item, handle };
              }
            }
          } catch (e) {
            console.error(`Failed to resolve handle for DID ${item.did}`, e);
          }
          // Return original item if handle resolution fails
          return item;
        })
      );
      
      setStatsData({
        ...data,
        leaderboard: leaderboardWithHandles
      });
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      setError(err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.statsHeader}>
        <h2>Plumbing Stats 🪠</h2>
        <p className={styles.statsSubtitle}>
          Global statistics for the Flushes network
        </p>
      </div>

      <div className={styles.controls}>
        <button 
          onClick={() => fetchStatsData()} 
          className={styles.refreshButton}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh Stats'}
        </button>
        <Link href="/" className={styles.homeLink}>
          Back to Feed
        </Link>
      </div>

      {error && (
        <div className={styles.error}>
          Error: {error}
        </div>
      )}

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loader}></div>
          <p>Loading stats...</p>
        </div>
      ) : statsData ? (
        <div className={styles.statsContent}>
          {/* Overall Stats */}
          <section className={styles.overallStats}>
            <h2>Overall Flush Activity</h2>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{statsData.totalCount}</div>
                <div className={styles.statLabel}>Total flushes</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{statsData.flushesPerDay}</div>
                <div className={styles.statLabel}>Flushes per day</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{statsData.plumberFlushCount}</div>
                <div className={styles.statLabel}>Plumber test flushes</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{statsData.totalFlushers}</div>
                <div className={styles.statLabel}>Total flushers</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{statsData.monthlyActiveFlushers}</div>
                <div className={styles.statLabel}>Monthly active flushers</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{statsData.dailyActiveFlushers}</div>
                <div className={styles.statLabel}>Daily active flushers (avg)</div>
              </div>
            </div>
          </section>

          {/* Activity Chart */}
          <section className={styles.chartSection}>
            <h2>Monthly Activity</h2>
            {statsData.chartData.length > 0 ? (
              <>
                <div className={styles.chartContainer}>
                  {statsData.chartData.map((dataPoint, index) => {
                    // Calculate height percentage (max of 100%)
                    const maxCount = Math.max(...statsData.chartData.map(d => d.count));
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
                    {statsData.chartData.length > 0 ? (() => {
                      const [year, month] = statsData.chartData[0].date.split('-');
                      const date = new Date(parseInt(year), parseInt(month) - 1);
                      return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
                    })() : ''}
                  </span>
                  <span className={styles.chartLegendItem}>
                    {statsData.chartData.length > 0 ? (() => {
                      const [year, month] = statsData.chartData[statsData.chartData.length - 1].date.split('-');
                      const date = new Date(parseInt(year), parseInt(month) - 1);
                      return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
                    })() : ''}
                  </span>
                </div>
              </>
            ) : (
              <p className={styles.noDataMessage}>Not enough data to display activity chart</p>
            )}
          </section>

          {/* Leaderboard */}
          <section className={styles.leaderboardSection}>
            <h2>Top Flushers</h2>
            {statsData.leaderboard.length > 0 ? (
              <div className={styles.leaderboard}>
                <div className={styles.leaderboardHeader}>
                  <span className={styles.rank}>Rank</span>
                  <span className={styles.user}>User</span>
                  <span className={styles.count}>Flushes</span>
                </div>
                {statsData.leaderboard.map((item, index) => {
                  // Determine rank style class based on position
                  let rankClass = '';
                  if (index === 0) rankClass = styles.topRank;
                  else if (index === 1) rankClass = styles.secondRank;
                  else if (index === 2) rankClass = styles.thirdRank;
                  
                  return (
                    <div key={index} className={`${styles.leaderboardItem} ${rankClass}`}>
                      <span className={styles.rank}>#{index + 1}</span>
                      <span className={styles.user}>
                        {item.handle ? (
                          <Link href={`/profile/${item.handle}`} title={`@${item.handle}`}>
                            @{item.handle}
                          </Link>
                        ) : (
                          <span className={styles.unknownUser}>
                            {item.did.substring(0, 10)}...
                          </span>
                        )}
                      </span>
                      <span className={styles.count}>{item.count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.noDataMessage}>No leaderboard data available</p>
            )}
          </section>
          
          {/* Emoji Statistics */}
          <section className={styles.emojiSection}>
            <h2>Emoji Usage</h2>
            {statsData.emojiStats && statsData.emojiStats.length > 0 ? (
              <div className={styles.emojiGrid}>
                {statsData.emojiStats.map((emojiStat, index) => (
                  <div key={index} className={styles.emojiCard}>
                    <div className={styles.emoji}>{emojiStat.emoji}</div>
                    <div className={styles.emojiCount}>{emojiStat.count}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.noDataMessage}>No emoji data available</p>
            )}
          </section>
          
          <div className={styles.shareSection}>
            <button 
              className={styles.shareButton}
              onClick={() => {
                // Generate share text
                const statsText = `There have been ${statsData.totalCount} flushes by ${statsData.totalFlushers} unique users on @flushes.app! We have ${statsData.monthlyActiveFlushers} monthly active flushers and ${statsData.dailyActiveFlushers} daily active flushers on average. Check out the stats: https://flushes.app/stats`;
                window.open(`https://bsky.app/intent/compose?text=${encodeURIComponent(statsText)}`, '_blank');
              }}
            >
              Share These Stats
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>No stats data available</p>
        </div>
      )}
    </div>
  );
}