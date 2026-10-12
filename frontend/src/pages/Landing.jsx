function Landing() {
  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div>
            <h1>A quieter way to understand the sounds around you.</h1>
            <p className="hero__lead">
              Sensory Support listens for the everyday sounds you choose, tells
              you what it heard, and lets you decide which ones matter to you.
            </p>
            <div className="hero__actions">
              <a className="btn" href="/register">
                Create an account
              </a>
              <a className="btn btn-secondary" href="/login">
                Log in
              </a>
            </div>
          </div>
          <figure className="photo photo--portrait">
            <img
              src="/images/hero.jpg"
              alt="Describe the hero photo here"
              width="800"
              height="1000"
            />
          </figure>
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="container">
          <h2>How it works</h2>
          <ol className="steps">
            <li>
              <span className="step__number" aria-hidden="true">
                1
              </span>
              <h3>Choose your sounds</h3>
              <p className="muted">
                Tell the app how relevant each sound is to you, from sirens to
                construction to music. You can change this at any time.
              </p>
            </li>
            <li>
              <span className="step__number" aria-hidden="true">
                2
              </span>
              <h3>Listen when you want to</h3>
              <p className="muted">
                Start monitoring and the app names the sound it hears, with a
                confidence level, and alerts you if it matters to you.
              </p>
            </li>
            <li>
              <span className="step__number" aria-hidden="true">
                3
              </span>
              <h3>Review your patterns</h3>
              <p className="muted">
                Add notes to what you hear and look back over time to see which
                sounds come up most often.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <figure className="photo photo--landscape">
            <img
              src="/images/community.jpg"
              alt="Describe the second photo here"
              width="1200"
              height="800"
            />
          </figure>
          <div>
            <h2>You stay in control</h2>
            <p>
              The microphone is only used while monitoring is switched on. The
              app keeps the result of each detection, not the recording.
            </p>
            <p>
              The confidence shown is the model's best estimate, not a
              certainty. You can delete your history, or your whole account, at
              any time.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

export default Landing;