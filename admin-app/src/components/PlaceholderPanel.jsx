export default function PlaceholderPanel({ title, description, bullets }) {
  return (
    <section className="panel">
      <div className="panel-kicker">Foundation</div>
      <h2>{title}</h2>
      <p className="panel-copy">{description}</p>
      <ul className="placeholder-list">
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </section>
  );
}
