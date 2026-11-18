import { siteSchema, homeSchema, shopSchema, brandSchema, postSchema } from '@/lib/schema';

// One <script type="application/ld+json"> per node, so each block carries its own @context and @type. The "<" is
// escaped so text from the data can never close the script tag. Server components only: no hooks.
const serialize = data => JSON.stringify(data).replace(/</g, '\u003c');
export function JsonLd({ nodes }) {
  return <>{nodes.map((n, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialize(n) }} />)}</>;
}
export const SiteSchema = () => <JsonLd nodes={siteSchema()} />;
export const HomeSchema = () => <JsonLd nodes={homeSchema()} />;
export const ShopSchema = () => <JsonLd nodes={shopSchema()} />;
export const BrandSchema = ({ brand }) => <JsonLd nodes={brandSchema(brand)} />;
export const PostSchema = ({ post }) => <JsonLd nodes={postSchema(post)} />;
