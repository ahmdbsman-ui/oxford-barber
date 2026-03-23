import PlaceholderPanel from '../components/PlaceholderPanel';

export default function GalleryPage() {
  return (
    <PlaceholderPanel
      title="Gallery management foundation"
      description="Gallery uploads and visibility controls will connect to the same Firestore collection and Firebase Storage bucket as the website admin."
      bullets={[
        'Image upload queue',
        'Visibility toggles',
        'Storage cleanup hooks',
      ]}
    />
  );
}
