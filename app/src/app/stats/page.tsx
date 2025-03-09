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
  leaderboard: { did: string; count: number; handle?: string }[];
}

export default function StatsPage() {
  const { isAuthenticated, handle, clearAuth } = useAuth();
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Function to handle logout
  const handleLogout = () => {
    clearAuth();
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
      
      const response = await fetch('/api/bluesky/stats', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
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
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>im.flushing 🧻</h1>
          <p className={styles.subtitle}>https://flushing.im 🚽</p>
          <p className={styles.description}>
            The world&apos;s first decentralized social media app for sharing when you&apos;re on the toilet. Connect with other bathroom enjoyers all over the world by posting &quot;flushes&quot;! Powered by the AT Protocol. Your status updates are saved to your PDS with the im.flushing lexicon.<br />
            <span className={styles.creditLine}>
              Made by <a href="https://bsky.app/profile/dame.is" target="_blank" rel="noopener noreferrer">@dame.is</a>. 
              Like the app? Consider contributing to <a href="https://ko-fi.com/dameis" target="_blank" rel="noopener noreferrer" className={styles.kofiLink}>my toilet paper fund</a>.
            </span>
          </p>
        </div>
        <div className={styles.headerActions}>
          {isAuthenticated ? (
            <>
              <Link href={`/profile/${handle}`} className={styles.userInfo}>@{handle}</Link>
              <button onClick={handleLogout} className={styles.logoutButton}>
                Logout
              </button>
            </>
          ) : (
            <Link href="/auth/login" className={styles.loginButton}>
              Login with Bluesky
            </Link>
          )}
        </div>
      </header>
      
      <div className={styles.statsHeader}>
        <h2>Plumbing Stats 🪠</h2>
        <p className={styles.statsSubtitle}>
          Global statistics for the im.flushing network
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
          Back to Dashboard
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
                <div className={styles.statLabel}>Total Flushes</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{statsData.flushesPerDay}</div>
                <div className={styles.statLabel}>Flushes Per Active Day</div>
              </div>
            </div>
          </section>

          {/* Activity Chart */}
          <section className={styles.chartSection}>
            <h2>Daily Activity</h2>
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
                    {statsData.chartData.length > 0 ? new Date(statsData.chartData[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                  </span>
                  <span className={styles.chartLegendItem}>
                    {statsData.chartData.length > 0 ? new Date(statsData.chartData[statsData.chartData.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
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
                {statsData.leaderboard.map((item, index) => (
                  <div key={index} className={`${styles.leaderboardItem} ${index === 0 ? styles.topRank : ''}`}>
                    <span className={styles.rank}>#{index + 1}</span>
                    <span className={styles.user}>
                      {item.handle ? (
                        <Link href={`/profile/${item.handle}`}>
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
                ))}
              </div>
            ) : (
              <p className={styles.noDataMessage}>No leaderboard data available</p>
            )}
          </section>
          
          <div className={styles.shareSection}>
            <button 
              className={styles.shareButton}
              onClick={() => {
                // Generate share text
                const statsText = `There have been ${statsData.totalCount} flushes on @flushing.im! That's averaging ${statsData.flushesPerDay} flushes per active day. Check out the stats and leaderboard: https://flushing.im/stats`;
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