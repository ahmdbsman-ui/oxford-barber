import { useEffect, useState } from 'react';
import {
  addGalleryItem,
  deleteGalleryItem,
  subscribeToGalleryItems,
  updateGalleryVisibility,
} from '../services/adminData';

export default function GalleryPage() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToGalleryItems(setItems, (error) => {
      console.error('Admin app gallery subscription failed:', error);
      setMessage('Failed to load gallery items.');
    });

    return () => unsubscribe();
  }, []);

  const handleAdd = async () => {
    if (!file) {
      setMessage('Please choose an image to upload.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      await addGalleryItem({ file, title });
      setFile(null);
      setTitle('');
      setMessage('Gallery item added successfully.');
    } catch (error) {
      console.error('Admin app add gallery item failed:', error);
      setMessage('Failed to add gallery item.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async (item) => {
    try {
      await updateGalleryVisibility(item.id, !item.isVisible);
      setMessage('Gallery visibility updated.');
    } catch (error) {
      console.error('Admin app gallery visibility update failed:', error);
      setMessage('Failed to update gallery visibility.');
    }
  };

  const handleDelete = async (item) => {
    try {
      await deleteGalleryItem(item);
      setMessage('Gallery item deleted.');
    } catch (error) {
      console.error('Admin app delete gallery item failed:', error);
      setMessage('Failed to delete gallery item.');
    }
  };

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-kicker">Gallery</div>
        <h1>Gallery management</h1>
        <p className="panel-copy">
          Uploads and visibility changes use the same Firestore collection and
          Firebase Storage bucket as the website admin.
        </p>
      </section>

      <section className="panel form-panel">
        <div className="form-grid">
          <label className="form-field">
            <span>Image Title</span>
            <input
              className="form-input"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Gallery title"
              type="text"
              value={title}
            />
          </label>

          <label className="form-field">
            <span>Image File</span>
            <input
              className="form-input"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              type="file"
            />
          </label>
        </div>

        {message ? <div className="message">{message}</div> : null}

        <div className="action-row">
          <button
            className="primary-button"
            disabled={saving}
            onClick={handleAdd}
            type="button"
          >
            {saving ? 'Uploading...' : 'Add Gallery Item'}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="entity-list">
          {items.length === 0 ? (
            <div className="message">No gallery items yet.</div>
          ) : (
            items.map((item) => (
              <article className="entity-card" key={item.id}>
                <div className="entity-main">
                  <strong>{item.title || 'Oxford Barber'}</strong>
                  <span>{item.isVisible ? 'Visible on website' : 'Hidden from website'}</span>
                  {item.imageUrl ? (
                    <img
                      alt={item.title || 'Gallery item'}
                      className="entity-image"
                      src={item.imageUrl}
                    />
                  ) : null}
                </div>
                <div className="button-stack">
                  <button
                    className="ghost-button"
                    onClick={() => handleToggleVisibility(item)}
                    type="button"
                  >
                    {item.isVisible ? 'Hide' : 'Show'}
                  </button>
                  <button
                    className="ghost-button danger"
                    onClick={() => handleDelete(item)}
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
