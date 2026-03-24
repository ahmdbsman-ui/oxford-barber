import { useEffect, useState } from 'react';
import {
  addBannedUser,
  removeBannedUser,
  subscribeToBannedUsers,
} from '../services/adminData';

export default function BannedUsersPage() {
  const [bannedUsers, setBannedUsers] = useState([]);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToBannedUsers(setBannedUsers, (error) => {
      console.error('Admin app banned users subscription failed:', error);
      setMessage('Failed to load banned users.');
    });

    return () => unsubscribe();
  }, []);

  const handleAdd = async () => {
    if (!phone.trim()) {
      setMessage('Please enter a phone number.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      await addBannedUser({
        phone: phone.trim(),
        reason: reason.trim(),
      });
      setPhone('');
      setReason('');
      setMessage('Phone number banned successfully.');
    } catch (error) {
      console.error('Admin app add banned user failed:', error);
      setMessage('Failed to ban phone number.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id) => {
    try {
      await removeBannedUser(id);
      setMessage('Banned number removed.');
    } catch (error) {
      console.error('Admin app remove banned user failed:', error);
      setMessage('Failed to remove banned number.');
    }
  };

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-kicker">Banned Users</div>
        <h1>Blocked booking numbers</h1>
        <p className="panel-copy">
          This list is shared with the website booking flow, so updates here
          immediately affect who can book.
        </p>
      </section>

      <section className="panel form-panel">
        <div className="form-grid">
          <label className="form-field">
            <span>Phone Number</span>
            <input
              className="form-input"
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Enter phone number"
              type="text"
              value={phone}
            />
          </label>

          <label className="form-field">
            <span>Reason</span>
            <input
              className="form-input"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for ban"
              type="text"
              value={reason}
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
            {saving ? 'Saving...' : 'Ban Number'}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="entity-list">
          {bannedUsers.length === 0 ? (
            <div className="message">No banned numbers yet.</div>
          ) : (
            bannedUsers.map((item) => (
              <article className="entity-card" key={item.id}>
                <div className="entity-main">
                  <strong>{item.phone}</strong>
                  <span>{item.reason || 'No reason'}</span>
                </div>
                <button
                  className="ghost-button danger"
                  onClick={() => handleRemove(item.id)}
                  type="button"
                >
                  Remove Ban
                </button>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
