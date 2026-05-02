# A living document of my learnings building this personal website
- `*:` lets you style all children of a parent div. 
- The `grid` class defaults to a single col.
- Astro's frontmatter is for preparing the page and contains import statements, reading astro props, variables, helper functions, data/database/api fetch and server-side logic. JS in frontmatter does not end up on client side.
- Tailwind calls inner shadow as inset
- SVG filters are great for creating composite strokes and shadows around various divs
- `data-*` are plain HTML markers for adding semantic metadata to HTML elements that needn't be unique like id and needn't pollute class space.
- the content in frontmatter of Astro is executed at buildtime or on server if SSR, it is not shipped to the client.
- Border box means border lies outside the div, to have something inside, you need to use inset box shadow
- browser's default flex behaviour is flex: 0 1 auto;