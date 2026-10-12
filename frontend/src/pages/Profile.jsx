import { Link } from "react-router-dom";

function Profile() {
  return (
    <section className="page">
      <div className="container">
        <h1>Profile</h1>
        <p className="muted">Account details and settings are built in a later step.</p>
        <p>
          <Link to="/setup">Edit sound profile</Link>
        </p>
      </div>
    </section>
  );
}

export default Profile;