import { useEffect, useState } from 'react';
import {
  addScheduledClosure,
  deleteScheduledClosure,
  saveSettings,
  subscribeToScheduledClosures,
  subscribeToSettings,
} from '../services/adminData';

function formatClosureDateRange(closure) {
  if (!closure?.startDate) return 'No date';
  if (!closure?.endDate || closure.startDate === closure.endDate) {
    return closure.startDate;
  }

  return `${closure.startDate} to ${closure.endDate}`;
}

function formatClosureTimeRange(closure) {
  if (closure?.isFullDay) return 'Full day';
  if (!closure?.startTime || !closure?.endTime) return 'Time not set';
  return `${closure.startTime} - ${closure.endTime}`;
}

const initialClosureForm = {
  startDate: '',
  endDate: '',
  isFullDay: true,
  startTime: '',
  endTime: '',
  reason: '',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    happyClients: '500+',
    rating: '5.0',
    experience: '8+',
    vacationMode: false,
  });
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [closures, setClosures] = useState([]);
  const [closuresMessage, setClosuresMessage] = useState('');
  const [closuresSaving, setClosuresSaving] = useState(false);
  const [closureForm, setClosureForm] = useState(initialClosureForm);

  useEffect(() => {
    const unsubscribeSettings = subscribeToSettings(
      (nextSettings) => {
        setSettings((current) => ({ ...current, ...nextSettings }));
      },
      (error) => {
        console.error('Admin app settings subscription failed:', error);
        setSettingsMessage('Failed to load settings.');
      }
    );

    const unsubscribeClosures = subscribeToScheduledClosures(
      setClosures,
      (error) => {
        console.error('Admin app closures subscription failed:', error);
        setClosuresMessage('Failed to load scheduled closures.');
      }
    );

    return () => {
      unsubscribeSettings();
      unsubscribeClosures();
    };
  }, []);

  const handleSaveSettings = async () => {
    try {
      setSettingsSaving(true);
      setSettingsMessage('');
      await saveSettings(settings);
      setSettingsMessage('Settings saved successfully.');
    } catch (error) {
      console.error('Admin app settings save failed:', error);
      setSettingsMessage('Failed to save settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleAddClosure = async () => {
    if (!closureForm.startDate || !closureForm.endDate) {
      setClosuresMessage('Please set both start and end dates.');
      return;
    }

    if (closureForm.endDate < closureForm.startDate) {
      setClosuresMessage('End date cannot be before start date.');
      return;
    }

    if (!closureForm.isFullDay) {
      if (!closureForm.startTime || !closureForm.endTime) {
        setClosuresMessage('Please set both start and end times.');
        return;
      }

      if (closureForm.endTime <= closureForm.startTime) {
        setClosuresMessage('End time must be after start time.');
        return;
      }
    }

    try {
      setClosuresSaving(true);
      setClosuresMessage('');

      await addScheduledClosure({
        startDate: closureForm.startDate,
        endDate: closureForm.endDate,
        isFullDay: closureForm.isFullDay,
        startTime: closureForm.isFullDay ? '' : closureForm.startTime,
        endTime: closureForm.isFullDay ? '' : closureForm.endTime,
        reason: closureForm.reason.trim(),
      });

      setClosureForm(initialClosureForm);
      setClosuresMessage('Scheduled closure saved successfully.');
    } catch (error) {
      console.error('Admin app add closure failed:', error);
      setClosuresMessage('Failed to save scheduled closure.');
    } finally {
      setClosuresSaving(false);
    }
  };

  const handleDeleteClosure = async (closureId) => {
    try {
      await deleteScheduledClosure(closureId);
      setClosuresMessage('Scheduled closure deleted.');
    } catch (error) {
      console.error('Admin app delete closure failed:', error);
      setClosuresMessage('Failed to delete scheduled closure.');
    }
  };

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-kicker">Settings</div>
        <h1>Business settings and closures</h1>
        <p className="panel-copy">
          These settings write to the same Firestore records as the website
          admin, so closure and availability changes affect customer booking
          immediately.
        </p>
      </section>

      <section className="panel form-panel">
        <div className="panel-kicker">Site Settings</div>
        <div className="form-grid">
          <label className="form-field">
            <span>Happy Clients</span>
            <input
              className="form-input"
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  happyClients: event.target.value,
                }))
              }
              type="text"
              value={settings.happyClients || ''}
            />
          </label>

          <label className="form-field">
            <span>Rating</span>
            <input
              className="form-input"
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  rating: event.target.value,
                }))
              }
              type="text"
              value={settings.rating || ''}
            />
          </label>

          <label className="form-field">
            <span>Years Experience</span>
            <input
              className="form-input"
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  experience: event.target.value,
                }))
              }
              type="text"
              value={settings.experience || ''}
            />
          </label>
        </div>

        <div className="setting-toggle-card">
          <div>
            <strong>Vacation Mode</strong>
            <p className="panel-copy">
              When enabled, customers cannot create booking requests.
            </p>
          </div>
          <button
            className={`status-toggle ${
              settings.vacationMode ? 'danger' : 'success'
            }`}
            onClick={() =>
              setSettings((current) => ({
                ...current,
                vacationMode: !current.vacationMode,
              }))
            }
            type="button"
          >
            {settings.vacationMode ? 'ON' : 'OFF'}
          </button>
        </div>

        {settingsMessage ? <div className="message">{settingsMessage}</div> : null}

        <div className="action-row">
          <button
            className="primary-button"
            disabled={settingsSaving}
            onClick={handleSaveSettings}
            type="button"
          >
            {settingsSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </section>

      <section className="panel form-panel">
        <div className="panel-kicker">Scheduled Closures</div>
        <p className="panel-copy">
          Add full-day, date-range, or partial-day closures using the same
          Firestore collection as the website admin.
        </p>

        <div className="form-grid">
          <label className="form-field">
            <span>Start Date</span>
            <input
              className="form-input"
              onChange={(event) =>
                setClosureForm((current) => ({
                  ...current,
                  startDate: event.target.value,
                }))
              }
              type="date"
              value={closureForm.startDate}
            />
          </label>

          <label className="form-field">
            <span>End Date</span>
            <input
              className="form-input"
              onChange={(event) =>
                setClosureForm((current) => ({
                  ...current,
                  endDate: event.target.value,
                }))
              }
              type="date"
              value={closureForm.endDate}
            />
          </label>

          <div className="form-field">
            <span>Closure Type</span>
            <button
              className={`status-toggle ${
                closureForm.isFullDay ? 'danger' : 'success'
              } full-width`}
              onClick={() =>
                setClosureForm((current) => ({
                  ...current,
                  isFullDay: !current.isFullDay,
                }))
              }
              type="button"
            >
              {closureForm.isFullDay ? 'Full-Day Closure' : 'Partial-Day Closure'}
            </button>
          </div>
        </div>

        {!closureForm.isFullDay ? (
          <div className="form-grid">
            <label className="form-field">
              <span>Start Time</span>
              <input
                className="form-input"
                onChange={(event) =>
                  setClosureForm((current) => ({
                    ...current,
                    startTime: event.target.value,
                  }))
                }
                type="time"
                value={closureForm.startTime}
              />
            </label>

            <label className="form-field">
              <span>End Time</span>
              <input
                className="form-input"
                onChange={(event) =>
                  setClosureForm((current) => ({
                    ...current,
                    endTime: event.target.value,
                  }))
                }
                type="time"
                value={closureForm.endTime}
              />
            </label>
          </div>
        ) : null}

        <label className="form-field">
          <span>Reason (optional)</span>
          <input
            className="form-input"
            onChange={(event) =>
              setClosureForm((current) => ({
                ...current,
                reason: event.target.value,
              }))
            }
            placeholder="Public holiday, maintenance, private event..."
            type="text"
            value={closureForm.reason}
          />
        </label>

        {closuresMessage ? <div className="message">{closuresMessage}</div> : null}

        <div className="action-row">
          <button
            className="primary-button"
            disabled={closuresSaving}
            onClick={handleAddClosure}
            type="button"
          >
            {closuresSaving ? 'Saving Closure...' : 'Add Closure'}
          </button>
        </div>

        <div className="entity-list">
          {closures.length === 0 ? (
            <div className="message">No scheduled closures saved yet.</div>
          ) : (
            closures.map((closure) => (
              <article className="entity-card" key={closure.id}>
                <div className="entity-main">
                  <strong>{formatClosureDateRange(closure)}</strong>
                  <span>{formatClosureTimeRange(closure)}</span>
                  <span>{closure.reason || 'No reason provided'}</span>
                </div>
                <button
                  className="ghost-button danger"
                  onClick={() => handleDeleteClosure(closure.id)}
                  type="button"
                >
                  Delete
                </button>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
