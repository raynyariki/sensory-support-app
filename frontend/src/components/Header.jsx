import { Link } from "react-router-dom";

function Header() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="wordmark">
          Sensory Support
        </Link>
        <nav className="site-nav" aria-label="Main">
          <a href="/#how-it-works" className="site-nav__link">
            How it works
          </a>
          <Link to="/login" className="site-nav__link">
            Log in
          </Link>
          <Link to="/register" className="btn">
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default Header;