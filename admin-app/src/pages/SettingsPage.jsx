import PlaceholderPanel from '../components/PlaceholderPanel';

export default function SettingsPage() {
  return (
    <PlaceholderPanel
      title="Settings foundation"
      description="Owner-only settings will live here, using the same site configuration documents already used by the website admin."
      bullets={[
        'Business profile and operating settings',
        'Admin access and notification preferences',
        'Future mobile-specific notification controls',
      ]}
    />
  );
}
