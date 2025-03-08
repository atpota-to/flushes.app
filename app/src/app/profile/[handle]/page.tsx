'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from './profile.module.css';
import { sanitizeText } from '@/lib/content-filter';

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
  const [error, setError] = useState<string | null>(null);
  const [flushesPerDay, setFlushesPerDay] = useState<number>(0);
  const [chartData, setChartData] = useState<{date: string, count: number}[]>([]);

  useEffect(() => {
    // Fetch the user's statuses when the component mounts
    fetchUserStatuses();
  }, [handle]);

  // Function to fetch the user's statuses
  const fetchUserStatuses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Call our API endpoint to get the user's statuses
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
      
      // Calculate statistics and chart data
      if (userEntries.length > 0) {
        // Calculate flushes per day
        const sortedEntries = [...userEntries].sort((a: FlushingEntry, b: FlushingEntry) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        if (sortedEntries.length > 1) {
          const firstDate = new Date(sortedEntries[0].created_at);
          const lastDate = new Date(sortedEntries[sortedEntries.length - 1].created_at);
          const daysDiff = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));
          const perDay = parseFloat((sortedEntries.length / daysDiff).toFixed(1));
          setFlushesPerDay(perDay);
        } else {
          setFlushesPerDay(1); // Just one flush on a single day
        }
        
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
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>im.flushing 🧻</h1>
          <p className={styles.subtitle}>https://flushing.im 🚽</p>
          <p className={styles.description}>
            The world&apos;s first decentralized social media app for sharing when you&apos;re on the toilet. Connect with other bathroom enjoyers all over the world by posting &quot;flushes&quot;! Powered by the AT Protocol. Your status updates are saved to your PDS with the im.flushing lexicon.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/" className={styles.backButton}>
            ← Back to Feed
          </Link>
        </div>
      </header>
      
      <div className={styles.profileHeader}>
        <div className={styles.profileInfo}>
          <h2 className={styles.profileTitle}>@{handle}</h2>
          <a 
            href={`https://bsky.app/profile/${handle}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className={styles.viewOnBluesky}
          >
            View on Bluesky
          </a>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      
      {!loading && !error && (
        <section className={styles.statsSection}>
          <h3 className={styles.statsHeader}>Flushing Statistics</h3>
          <p className={styles.statDetails}>
            {totalCount} total {totalCount === 1 ? 'flush' : 'flushes'}
            {flushesPerDay > 0 && `, ${flushesPerDay} ${flushesPerDay === 1 ? 'flush' : 'flushes'} per day`}
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
                  const statsText = `I've made ${totalCount} total ${totalCount === 1 ? 'flush' : 'flushes'}${flushesPerDay > 0 ? ` or ${flushesPerDay} ${flushesPerDay === 1 ? 'flush' : 'flushes'} per day` : ''} on im.flushing. Flush with me here: https://flushing.im/profile/${handle}`;
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
                    {new Date(entry.created_at).toLocaleString()}
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