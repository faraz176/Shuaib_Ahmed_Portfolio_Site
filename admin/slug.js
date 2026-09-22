function slugFromTitle(title) {
  return (title || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/-$/g, '') || 'post';
}

CMS.registerEventListener({
  name: 'preSave',
  handler: ({ entry }) => {
    const data = entry.get('data');
    const posts = data.get('posts');
    if (!posts) return data;

    const used = new Set();
    posts.forEach(post => {
      const slug = post.get('slug');
      if (typeof slug === 'string' && slug.trim()) used.add(slug);
    });

    return data.set('posts', posts.map(post => {
      if (post.get('slug')) return post;
      const base = slugFromTitle(post.get('title'));
      let slug = base;
      let suffix = 2;
      while (used.has(slug)) slug = `${base}-${suffix++}`;
      used.add(slug);
      return post.set('slug', slug);
    }));
  },
});
