'use client';

import { useState, useEffect } from 'react';
import styles from './EditFlushModal.module.css';
import { containsBannedWords, sanitizeText, isAllowedEmoji } from '@/lib/content-filter';

interface EditFlushModalProps {
  isOpen: boolean;
  flushData: {
    uri: string;
    text: string;
    emoji: string;
    created_at: string;
  } | null;
  onSave: (text: string, emoji: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

// Define approved emojis list
const APPROVED_EMOJIS = [
  '🚽', '🧻', '💩', '💨', '🚾', '🧼', '🪠', '🚻', '🩸', '💧', '💦', '😌', 
  '😣', '🤢', '🤮', '🥴', '😮‍💨', '😳', '😵', '🌾', '🍦', '📱', '📖', '💭',
  '1️⃣', '2️⃣', '🟡', '🟤'
];

export default function EditFlushModal({ isOpen, flushData, onSave, onDelete, onClose }: EditFlushModalProps) {
  const [text, setText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🚽');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Update form when flushData changes
  useEffect(() => {
    if (flushData) {
      // Remove "is " prefix if it exists in the stored text
      let displayText = flushData.text || '';
      if (displayText.toLowerCase().startsWith('is ')) {
        displayText = displayText.substring(3);
      }
      setText(displayText);
      setSelectedEmoji(flushData.emoji || '🚽');
      setError(null);
      setShowDeleteConfirm(false);
    }
  }, [flushData]);

  if (!isOpen || !flushData) return null;

  const handleSave = async () => {
    setError(null);

    // Validate text
    if (containsBannedWords(text)) {
      setError('Uh oh, looks like you have a potty mouth. Try again with cleaner language please...');
      return;
    }

    // Check character limit (text + "is " = 56 + 3 = 59)
    if (text.length > 56) {
      setError('Your flush status is too long! Please keep it under 56 characters (59 total with "is").');
      return;
    }

    // Validate emoji
    if (!isAllowedEmoji(selectedEmoji)) {
      setError('Please select a valid emoji from the list.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Add "is " prefix when saving
      const fullText = text.trim() ? `is ${text.trim()}` : 'is flushing';
      await onSave(sanitizeText(fullText), selectedEmoji);
      onClose();
    } catch (err: any) {
      console.error('Error updating flush:', err);
      setError(err.message || 'Failed to update flush. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onDelete();
      onClose();
    } catch (err: any) {
      console.error('Error deleting flush:', err);
      setError(err.message || 'Failed to delete flush. Please try again.');
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Edit Your Flush</h2>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <div className={styles.formGroup}>
          <label htmlFor="flush-text">What's your status? (optional)</label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputPrefix}>is </span>
            <input
              id="flush-text"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="flushing"
              maxLength={56}
              disabled={isSubmitting}
              className={styles.inputWithPrefix}
            />
          </div>
          <div className={styles.charCount}>
            {text.length + 3}/59
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Select Emoji</label>
          <div className={styles.emojiGrid}>
            {APPROVED_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setSelectedEmoji(emoji)}
                className={`${styles.emojiButton} ${selectedEmoji === emoji ? styles.selected : ''}`}
                disabled={isSubmitting}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.modalActions}>
          {!showDeleteConfirm ? (
            <>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSubmitting}
                className={styles.deleteButton}
              >
                Delete Flush
              </button>
              <div className={styles.rightActions}>
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className={styles.saveButton}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </>
          ) : (
            <div className={styles.deleteConfirmation}>
              <p>Are you sure you want to delete this flush? This cannot be undone.</p>
              <div className={styles.confirmButtons}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isSubmitting}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className={styles.confirmDeleteButton}
                >
                  {isSubmitting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

