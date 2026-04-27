import React from "react";

const DeleteAccount = () => {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Delete Your FrameMyEvent Account</h1>

        <p style={styles.text}>
          FrameMyEvent respects your privacy and gives you full control over your
          account and personal data. You can permanently delete your account at
          any time from within the app.
        </p>

        <h2 style={styles.heading}>How to Delete Your Account</h2>
        <p style={styles.text}>
          To delete your FrameMyEvent account, follow these steps:
        </p>

        <ul style={styles.list}>
          <li>
            Log in to the <strong>FrameMyEvent mobile app</strong>
          </li>
          <li>
            Go to <strong>Profile</strong>
          </li>
          <li>
            Scroll down to <strong>Account Deletion</strong> (Danger Zone)
          </li>
          <li>
            Expand the section and type <strong>DELETE</strong> to confirm
          </li>
          <li>
            Tap <strong>Delete Account</strong>
          </li>
        </ul>

        <h2 style={styles.heading}>What Data Is Deleted</h2>
        <ul style={styles.list}>
          <li>Profile information (name, email, phone number)</li>
          <li>Saved addresses and preferences</li>
          <li>Uploaded images, reviews, and ratings</li>
          <li>Authentication and login data</li>
        </ul>

        <h2 style={styles.heading}>Data Retention</h2>
        <p style={styles.text}>
          The following information may be retained for legal, regulatory, or
          accounting purposes:
        </p>
        <ul style={styles.list}>
          <li>Order history and invoices</li>
          <li>Payment and transaction records</li>
        </ul>

        <div style={styles.warning}>
          <strong>Important:</strong>
          <br />
          Account deletion is permanent and cannot be undone.
        </div>

        <div style={styles.contact}>
          <strong>Need help?</strong>
          <br />
          If you are unable to access the app, please contact us at{" "}
          <a href="mailto:support@framemyevent.com" style={styles.link}>
            support@framemyevent.com
          </a>
        </div>

        <footer style={styles.footer}>
          © {new Date().getFullYear()} FrameMyEvent. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

const styles = {
  page: {
    background: "#f8f9fb",
    minHeight: "100vh",
    padding: "32px 14px",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  container: {
    maxWidth: "820px",
    margin: "0 auto",
    background: "#fff",
    padding: "28px",
    borderRadius: "10px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
  },
  title: {
    color: "#d32f2f",
    marginBottom: "12px",
  },
  heading: {
    marginTop: "28px",
    color: "#333",
  },
  text: {
    lineHeight: "1.7",
    margin: "12px 0",
    fontSize: "15px",
  },
  list: {
    marginLeft: "20px",
    lineHeight: "1.8",
    fontSize: "15px",
  },
  warning: {
    marginTop: "24px",
    padding: "14px",
    background: "#fff3cd",
    borderLeft: "5px solid #ffca28",
    borderRadius: "6px",
    fontSize: "14px",
  },
  contact: {
    marginTop: "24px",
    padding: "14px",
    background: "#eef4ff",
    borderLeft: "5px solid #4f7cff",
    borderRadius: "6px",
    fontSize: "14px",
  },
  link: {
    color: "#4f7cff",
    textDecoration: "none",
  },
  footer: {
    marginTop: "36px",
    fontSize: "13px",
    color: "#666",
    textAlign: "center",
  },
};

export default DeleteAccount;