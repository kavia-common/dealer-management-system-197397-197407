import React from "react";
import "./PagePlaceholder.css";

// PUBLIC_INTERFACE
export default function PagePlaceholder({ title, description }) {
  return (
    <section className="pageCard" aria-label={title}>
      <div className="pageCard__badge">Placeholder</div>
      <h2 className="pageCard__title">{title}</h2>
      <p className="pageCard__desc">{description}</p>
      <div className="pageCard__note">
        API integration will be wired in a later step.
      </div>
    </section>
  );
}
