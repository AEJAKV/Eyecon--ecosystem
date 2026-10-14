import { Header, Footer } from './ui';
import { shopUrl } from '@/lib/config';
import { withAffiliate } from '@/lib/affiliate';

/* The Shop Frames page: featured frames and the houses Eyecon carries. affiliate is the ?affiliate= value the page
   was opened with; every booking link built here goes through withAffiliate so the referral is kept. */

function ShopHeading() {
  return (
    <section className="shop-heading" aria-labelledby="shop-title">
      <div className="container">
        <p className="eyebrow">The boutique</p>
        <h1 id="shop-title">Frames</h1>
        <p className="shop-subline">Featured pieces and the houses we carry. Reserve any frame to try at your visit.</p>
      </div>
    </section>
  );
}

export default function Shop({ affiliate }) {
  return <>
    <Header bookingHref={withAffiliate('/booking', affiliate)} shopHref={withAffiliate(shopUrl, affiliate)} />
    <main id="main-content" className="shop">
      <ShopHeading />
    </main>
    <Footer />
  </>;
}
