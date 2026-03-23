import PlaceholderPanel from '../components/PlaceholderPanel';

export default function ReviewsPage() {
  return (
    <PlaceholderPanel
      title="Reviews management foundation"
      description="Review moderation will use the existing shared reviews collection so owner changes instantly flow back to the website."
      bullets={[
        'Review approval and visibility',
        'Delete moderation actions',
        'Later filters by rating and date',
      ]}
    />
  );
}
