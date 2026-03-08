# Blog Architecture

## Content System: Markdoc

Use Markdoc (not MDX) for blog content. Markdoc provides:
- Custom tags for injecting components into content
- Clean separation between content and presentation
- File-based CMS (just `.mdoc` files in `src/content/notes/`)
- Future: connect to Obsidian for authoring

## Content Collection

```
src/content/
  notes/
    raspberry-pi-setup.mdoc
    indian-electrical-systems.mdoc
    on-being-an-adult.mdoc
    ...
  config.ts  # Defines 'notes' collection schema
```

### Frontmatter Schema
```yaml
---
title: "My goated Raspberry pi setup"
subtitle: "My self hosting journey on Blueberry, my cutie rpi 5"
date: 2026-03-01
draft: false
tags: ["tech", "self-hosting"]
---
```

## Blog Post Page Layout (from Paper frame D-0)

Three-column layout:
1. **Left sidebar**: Table of contents (sticky, scrolls with content)
2. **Center content**: Blog body (EB Garamond, ~18px)
3. **Right margin**: Sidenotes (small text, contextual annotations)

Background: `#e5e8d8` (warm olive/sage)

## Custom Markdoc Tags (planned)

```markdoc
{% callout type="warning" %}
This is important information.
{% /callout %}

{% sidenote %}
This appears in the right margin.
{% /sidenote %}

{% code-highlight lang="typescript" %}
const x = 1;
{% /code-highlight %}
```

## View Transitions

When clicking a note title on the homepage:
- `transition:name={`note-${slug}`}` on title element
- Morphs into blog post page heading
- Spring easing via `spring-easing` package -> CSS `linear()`
