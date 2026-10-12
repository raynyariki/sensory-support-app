function Landing() {
  return (
    <main className="container" style={{ paddingBlock: "var(--space-8)" }}>
      <h1>Sensory Support</h1>
      <p className="muted">Understand the sounds around you</p>

      <h2>Style check</h2>
      <p>
        This is body text at 18 pixels. It should feel comfortable to read, with
        generous line spacing.
      </p>

      <div className="field" style={{ maxWidth: "24rem" }}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" />
        <p className="field-error">Enter a valid email address</p>
      </div>

      <p style={{ display: "flex", gap: "var(--space-4)" }}>
        <a className="btn" href="#">Get started</a>
        <a className="btn btn-secondary" href="#">Log in</a>
      </p>
    </main>
  );
}

export default Landing;