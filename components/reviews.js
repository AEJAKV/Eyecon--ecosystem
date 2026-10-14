'use client';
import { useState } from 'react';
import { clinic, siteContent } from '@/lib/config';
import { featuredFirst } from '@/lib/reviews';
import { Stars } from './ui';

// Shared by the home page ("In their words") and the booking page, so the same rule applies everywhere. The reviews
// are Eyecon's real Google reviews (lib/config.js). The Google rating and review count are real when the clinic has
// supplied them; until then a sample appears in demo mode only, labelled "Sample rating", and nothing in live mode.
export const content = siteContent();
// The reviews in display order: the featured ones first.
export const orderedReviews = featuredFirst(content.reviews.items);

/* The Google rating as a round seal that links to the clinic’s reviews. Without a rating it only names the source.
   A sample rating carries a small "Sample rating" tag beside the seal. */
export function RatingSeal() {
  const { value, count, sample } = content.rating;
  const link = clinic.reviews ? { href: clinic.reviews, target: '_blank', rel: 'noopener noreferrer' } : null;
  if (!value) return (
    <div className="rating-seal empty">
      <span className="seal-title">Google reviews</span>
      {link && <a className="text-link" {...link}>Read on Google<span className="sr-only"> (opens in a new tab)</span></a>}
    </div>
  );
  const label = `${sample ? 'Sample rating for the design preview: ' : 'Rated '}${value.toFixed(1)} out of 5 on Google${count ? ` from ${count} reviews` : ''}`;
  const Seal = link ? 'a' : 'div';
  return (
    <div className="seal-wrap">
      <Seal className="rating-seal" {...link} aria-label={link ? label + '. Read the reviews on Google (opens in a new tab)' : label} role={link ? undefined : 'img'}>
        <span className="seal-arc" aria-hidden="true" />
        <strong>{value.toFixed(1)}</strong>
        <Stars value={value} size={14} />
        <span>{count ? <>{count} reviews<br />on Google</> : 'on Google'}</span>
      </Seal>
      {sample && <p className="sample-tag seal-tag" aria-hidden="true">Sample rating</p>}
    </div>
  );
}

/* A review card. The text is clamped to four lines; clicking the card shows all of it, and clicking again folds it.
   copy marks the duplicate cards of the scrolling belt, which are hidden from assistive technology: they expand on
   click too, but are not focusable. */
export function ReviewCard({ review, filler, copy = false }) {
  const [open, setOpen] = useState(false);
  const footer = <footer>
    <strong>{review.name}</strong>
    {review.service && <span className="service-pill">{review.service}</span>}
    <span className="review-source">{review.source}</span>
  </footer>;
  const stars = review.stars > 0 && <span className="review-stars"><Stars value={review.stars} size={14} /><span className="sr-only">{review.stars} out of 5 stars</span></span>;
  return (
    <li className={`review-card ${filler ? 'filler' : ''} ${open ? 'open' : ''}`} onClick={copy ? () => setOpen(o => !o) : undefined}>
      {stars}
      {copy
        ? <span className="review-text">{review.text}</span>
        : <button type="button" className="review-text" aria-expanded={open} onClick={() => setOpen(o => !o)}>{review.text}<span className="sr-only">{open ? ' (show less)' : ' (show all)'}</span></button>}
      {footer}
    </li>
  );
}

// The booking page's left column: the rating seal and three review cards, the featured ones first.
export function BookingReviews() {
  const reviews = orderedReviews.slice(0, 3);
  if (!reviews.length && !content.rating.value) return null;
  return <section className="booking-reviews" aria-labelledby="booking-reviews-title">
    <h2 id="booking-reviews-title" className="sr-only">Patient reviews</h2>
    <RatingSeal />
    {reviews.length > 0 && <ul className="booking-review-list">{reviews.map((r, i) => <ReviewCard key={i} review={r} />)}</ul>}
  </section>;
}
