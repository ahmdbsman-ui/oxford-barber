import { useEffect, useState } from 'react';
import {
  addReview,
  deleteReview,
  subscribeToReviews,
  updateReviewVisibility,
} from '../services/adminData';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [rating, setRating] = useState('5');
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToReviews(setReviews, (error) => {
      console.error('Admin app reviews subscription failed:', error);
      setMessage('Failed to load reviews.');
    });

    return () => unsubscribe();
  }, []);

  const handleAdd = async () => {
    if (!customerName.trim() || !text.trim()) {
      setMessage('Please complete name and review text.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      await addReview({
        customerName: customerName.trim(),
        rating: Number(rating),
        text: text.trim(),
        isVisible: true,
      });
      setCustomerName('');
      setRating('5');
      setText('');
      setMessage('Review added successfully.');
    } catch (error) {
      console.error('Admin app add review failed:', error);
      setMessage('Failed to add review.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async (review) => {
    try {
      await updateReviewVisibility(review.id, !review.isVisible);
      setMessage('Review visibility updated.');
    } catch (error) {
      console.error('Admin app review visibility update failed:', error);
      setMessage('Failed to update review visibility.');
    }
  };

  const handleDelete = async (reviewId) => {
    try {
      await deleteReview(reviewId);
      setMessage('Review deleted.');
    } catch (error) {
      console.error('Admin app delete review failed:', error);
      setMessage('Failed to delete review.');
    }
  };

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-kicker">Reviews</div>
        <h1>Review moderation</h1>
        <p className="panel-copy">
          Reviews are shared live with the website, so visibility and delete
          actions here update the public site immediately.
        </p>
      </section>

      <section className="panel form-panel">
        <div className="form-grid">
          <label className="form-field">
            <span>Customer Name</span>
            <input
              className="form-input"
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Enter customer name"
              type="text"
              value={customerName}
            />
          </label>

          <label className="form-field">
            <span>Rating</span>
            <select
              className="form-input"
              onChange={(event) => setRating(event.target.value)}
              value={rating}
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} Star{value > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="form-field">
          <span>Review Text</span>
          <textarea
            className="form-input form-textarea"
            onChange={(event) => setText(event.target.value)}
            placeholder="Write the review"
            rows={4}
            value={text}
          />
        </label>

        {message ? <div className="message">{message}</div> : null}

        <div className="action-row">
          <button
            className="primary-button"
            disabled={saving}
            onClick={handleAdd}
            type="button"
          >
            {saving ? 'Saving...' : 'Add Review'}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="entity-list">
          {reviews.length === 0 ? (
            <div className="message">No reviews yet.</div>
          ) : (
            reviews.map((review) => (
              <article className="entity-card" key={review.id}>
                <div className="entity-main">
                  <strong>{review.customerName}</strong>
                  <span>{`Rating: ${Number(review.rating) || 0}/5`}</span>
                  <span>{review.isVisible ? 'Visible on website' : 'Hidden from website'}</span>
                  <span>{review.text}</span>
                </div>
                <div className="button-stack">
                  <button
                    className="ghost-button"
                    onClick={() => handleToggleVisibility(review)}
                    type="button"
                  >
                    {review.isVisible ? 'Hide' : 'Show'}
                  </button>
                  <button
                    className="ghost-button danger"
                    onClick={() => handleDelete(review.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
