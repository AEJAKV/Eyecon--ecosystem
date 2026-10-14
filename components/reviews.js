'use client';
import { clinic, siteContent } from '@/lib/config';
import { Stars } from './ui';

// Shared by the home page ("In their words") and the booking page, so the same rule applies everywhere: real reviews
// and rating when the clinic has supplied them; otherwise the labelled samples in demo mode only, and nothing live.
// Real content where it exists; sample content, labelled as such, in demo mode only (see siteContent in lib/config.js).
export const content = siteContent();

/* The Google rating as a round seal that links to the clinic’s reviews. Without a rating it only names the source. */
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
    <Seal className="rating-seal" {...link} aria-label={link ? label + '. Read the reviews on Google (opens in a new tab)' : label} role={link ? undefined : 'img'}>
      <span className="seal-arc" aria-hidden="true" />
      <strong>{value.toFixed(1)}</strong>
      <Stars value={value} size={14} />
      <span>{count ? <>{count} reviews<br />on Google</> : 'on Google'}</span>
    </Seal>
  );
}

export function ReviewCard({ review, filler }) {
  return (
    <li className={`review-card ${filler ? 'filler' : ''}`}>
      {review.stars > 0 && <span className="review-stars"><Stars value={review.stars} size={14} /><span className="sr-only">{review.stars} out of 5 stars</span></span>}
      <p>{review.text}</p>
      <footer>
        <strong>{review.name}</strong>
        {review.service && <span className="service-pill">{review.service}</span>}
        <span className="review-source">{review.source}</span>
      </footer>
    </li>
  );
}

// The booking page's left column: the rating seal and three review cards, labelled as samples when they are.
export function BookingReviews() {
  const reviews = content.reviews.items.slice(0, 3), sample = content.reviews.sample || content.rating.sample;
  if (!reviews.length && !content.rating.value) return null;
  return <section className="booking-reviews" aria-labelledby="booking-reviews-title">
    <h2 id="booking-reviews-title" className="sr-only">Patient reviews</h2>
    {sample && <p className="sample-tag">Sample reviews · design preview</p>}
    <RatingSeal />
    {reviews.length > 0 && <ul className="booking-review-list">{reviews.map((r, i) => <ReviewCard key={i} review={r} />)}</ul>}
  </section>;
}
