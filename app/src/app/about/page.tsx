import styles from './about.module.css';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>About Flushes</h1>
        <p className={styles.subtitle}>The world's 1st decentralized toilet. </p>
      </div>

      <div className={styles.section}>
        <h2>Our History</h2>
        <p>
          Flushes was created as part of an elaborate bit over the course of a single weekend, but it soon gained a tiny cult following who we now refer to as "flushers". To learn more about what inspired Flushes, read the <a href="https://dame.is/blog/creating-a-decentralized-bathroom-at-protocol" target="_blank" rel="noopener noreferrer">Creating a Decentralized Bathroom</a> blog post on @dame.is's blog.
        </p>
      </div>

      <div className={styles.section}>
        <h2>In the Press</h2>
        <p>
          Flushes was mentioned from the main stage at SXSW 2025 during Jay Graber's keynote.
        </p>
        <ul className={styles.pressList}>
          <li>
            <a href="https://mashable.com/article/bluesky-jay-graber-keynote-session-sxsw-2025" target="_blank" rel="noopener noreferrer">Mashable: Mentioned in Bluesky's SXSW 2025 keynote session</a>
          </li>
        </ul>
        <div className={styles.videoContainer}>
          <iframe 
            width="560" 
            height="315" 
            src="https://www.youtube.com/embed/jjRCoDDqkfk?si=-_lgmX4CC5eMz8wt&amp;controls=0" 
            title="YouTube video player" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            referrerPolicy="strict-origin-when-cross-origin" 
            allowFullScreen
          ></iframe>
        </div>
      </div>

      <div className={styles.section}>
        <h2>How It Works</h2>
        <p>
          Flushes uses the im.flushing.right.now lexicon, a custom record type
          on the AT Protocol. When you post a flush, you're creating a record with:
        </p>
        <ul className={styles.featureList}>
          <li>A descriptive text (always starting with "is...")</li>
          <li>A bathroom-related emoji</li>
          <li>A timestamp</li>
        </ul>
        <p>
          These records are stored in your ATProto personal data server (PDS) and are fully controlled by you.
          You can delete them at any time from your Bluesky account using tools like <a href="https://pdsls.dev" target="_blank" rel="noopener noreferrer">pdsls.dev</a>
        </p>
      </div>

      <div className={styles.section}>
        <h2>The Team</h2>
        <p>
          Flushes was created by <a href="https://bsky.app/profile/dame.is" target="_blank" rel="noopener noreferrer">Dame</a> as
          a fun side project exploring the possibilities of the AT Protocol and Bluesky.
        </p>
        <p>
          Our psuedonmyous bathroom technician is <a href="https://bsky.app/profile/plumber.flushes.app" target="_blank" rel="noopener noreferrer">@plumber.flushes.app</a>, 
          who's always ready to fix your plumbing problems.
        </p>
        <p>
          Flushes is now an experimental social network led by <a href="https://atpota.to/" target="_blank" rel="noopener noreferrer">atpotato</a>.
        </p>
      </div>

      <div className={styles.section}>
        <h2>Get Involved</h2>
        <p>
          Have ideas for improving Flushes? Want to report a bug?
          Reach out on <a href="https://bsky.app/profile/flushes.app" target="_blank" rel="noopener noreferrer">Bluesky</a>.
        </p>
        <div className={styles.actionLinks}>
          <Link href="/shortcut" className={styles.actionLink}>Get the Shortcut</Link>
          <Link href="/stats" className={styles.actionLink}>View Flush Stats</Link>
          <Link href="/" className={styles.actionLink}>Return to Feed</Link>
        </div>
      </div>
    </div>
  );
}