import PlaceholderPanel from '../components/PlaceholderPanel';

export default function BannedUsersPage() {
  return (
    <PlaceholderPanel
      title="Banned users foundation"
      description="This screen is reserved for managing the same banned user records shared with the existing admin panel."
      bullets={[
        'Realtime banned list',
        'Add and remove blocked phone numbers',
        'Owner audit notes for manual moderation',
      ]}
    />
  );
}
