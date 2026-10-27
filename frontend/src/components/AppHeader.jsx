import { Link, NavLink, useNavigate } from "react-router-dom";
import { api, clearToken } from "../api";

function AppHeader() {
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      // Tells the server to invalidate this login on every device.
      await api.post("/auth/logout");
    } catch {
      // Even if the server cannot be reached, sign out on this device.
    }
    clearToken();
    navigate("/");
  }

  return (
    <header className="site-header">
      <div className="container app-header__inner">
        <Link to="/dashboard" className="wordmark">
          Sensory Support
        </Link>

        <button
          type="button"
          className="btn btn-secondary btn-small app-header__logout"
          onClick={handleLogout}
        >
          Log out
        </button>

        <nav className="app-nav" aria-label="Main">
          <NavLink to="/dashboard">Home</NavLink>
          <NavLink to="/monitor">Monitor</NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/profile">Profile</NavLink>
        </nav>
      </div>
    </header>
  );
}

export default AppHeader;