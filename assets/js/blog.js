const preview = document.querySelector('[data-blog-preview]');
const list = document.querySelector('[data-blog-list]');
const article = document.querySelector('[data-blog-article]');
const filters = document.querySelector('[data-blog-filters]');
const tagSelect = document.querySelector('[data-blog-tag-filter]');

function displayTag(tag) {
  const name = tag.trim().replace(/\s+/g, ' ');
  if (name.includes('_') || /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(name)) {
    return name.replace(/[_-]+/g, ' ').replace(/(^| )([a-z])/g, (_, space, letter) => space + letter.toUpperCase());
  }
  return name;
}

function tagKey(tag) {
  return displayTag(tag).toLocaleLowerCase('en-US');
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  const tags = new Map();
  value.forEach(raw => {
    if (typeof raw !== 'string') return;
    const tag = displayTag(raw);
    if (tag && !tags.has(tagKey(tag))) tags.set(tagKey(tag), tag);
  });
  return [...tags.values()];
}

function tagLinks(tags) {
  const container = document.createElement('div');
  container.className = 'blog-tags';
  tags.forEach(tag => {
    const link = document.createElement('a');
    link.href = `blog.html?tag=${encodeURIComponent(tag)}`;
    link.textContent = tag;
    container.append(link);
  });
  return container;
}

function formattedDate(value) {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
  }).format(date);
}

function showMessage(container, message) {
  if (!container) return;
  container.replaceChildren();
  const paragraph = document.createElement('p');
  paragraph.className = 'blog-empty';
  paragraph.textContent = message;
  container.append(paragraph);
}

function renderList(container, posts, limit = posts.length) {
  if (!container) return;
  if (!posts.length) {
    showMessage(container, 'No posts yet.');
    return;
  }
  container.replaceChildren();
  posts.slice(0, limit).forEach(post => {
    const item = document.createElement('article');
    item.className = 'blog-post';
    const date = document.createElement('time');
    date.dateTime = post.date;
    date.textContent = formattedDate(post.date);
    const heading = document.createElement('h3');
    heading.textContent = post.title;
    const summary = document.createElement('p');
    summary.textContent = post.summary;
    const link = document.createElement('a');
    link.className = 'small-link';
    link.href = `blog.html?post=${encodeURIComponent(post.slug)}`;
    link.textContent = 'Read post';
    item.append(date, heading, summary);
    if (post.tags.length) item.append(tagLinks(post.tags));
    item.append(link);
    container.append(item);
  });
}

function renderFilters(posts) {
  if (!filters || !tagSelect || !list) return renderList(list, posts);
  const tags = new Map();
  posts.forEach(post => post.tags.forEach(tag => tags.set(tagKey(tag), tag)));
  filters.hidden = tags.size === 0;
  tagSelect.replaceChildren();
  const all = document.createElement('option');
  all.value = '';
  all.textContent = 'All posts';
  tagSelect.append(all);
  [...tags.entries()].sort((a, b) => a[1].localeCompare(b[1])).forEach(([key, tag]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = tag;
    tagSelect.append(option);
  });
  const requested = new URLSearchParams(location.search).get('tag');
  tagSelect.value = requested && tags.has(tagKey(requested.trim())) ? tagKey(requested.trim()) : '';
  const showSelected = () => renderList(list, tagSelect.value
    ? posts.filter(post => post.tags.some(tag => tagKey(tag) === tagSelect.value))
    : posts);
  tagSelect.addEventListener('change', () => {
    const url = new URL(location.href);
    if (tagSelect.value) url.searchParams.set('tag', tags.get(tagSelect.value));
    else url.searchParams.delete('tag');
    history.replaceState(null, '', url);
    showSelected();
  });
  showSelected();
}

function renderArticle(post) {
  if (!article) return;
  if (!post) {
    showMessage(list, 'Post not found.');
    return;
  }
  list.hidden = true;
  article.hidden = false;
  const back = document.createElement('a');
  back.className = 'small-link';
  back.href = 'blog.html';
  back.textContent = 'All posts';
  const date = document.createElement('time');
  date.dateTime = post.date;
  date.textContent = formattedDate(post.date);
  const heading = document.createElement('h1');
  heading.textContent = post.title;
  const summary = document.createElement('p');
  summary.className = 'blog-summary';
  summary.textContent = post.summary;
  const body = document.createElement('div');
  body.className = 'blog-body';
  body.textContent = post.body;
  const comments = document.createElement('section');
  comments.className = 'blog-comments';
  const commentsHeading = document.createElement('h2');
  commentsHeading.textContent = 'Replies';
  const commentsNote = document.createElement('p');
  commentsNote.textContent = 'Sign in with GitHub to reply.';
  comments.append(commentsHeading, commentsNote);
  article.replaceChildren(back, date, heading, summary);
  if (post.tags.length) article.append(tagLinks(post.tags));
  article.append(body, comments);
  document.title = `${post.title} | Shuaib Ahmed`;

  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) {
    const widget = document.createElement('script');
    widget.src = 'https://utteranc.es/client.js';
    widget.setAttribute('repo', 'faraz176/Shuaib_Ahmed_Portfolio_Comments');
    widget.setAttribute('issue-term', `portfolio-blog-${post.slug}`);
    widget.setAttribute('theme', 'github-dark');
    widget.crossOrigin = 'anonymous';
    widget.async = true;
    comments.append(widget);
  }
}

async function loadPosts() {
  try {
    const response = await fetch('data/posts.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const posts = (Array.isArray(data.posts) ? data.posts : [])
      .filter(post => post && typeof post.title === 'string' && typeof post.slug === 'string' && typeof post.date === 'string' && typeof post.summary === 'string' && typeof post.body === 'string')
      .map(post => ({ ...post, tags: normalizeTags(post.tags) }))
      .sort((a, b) => b.date.localeCompare(a.date));
    renderList(preview, posts, 3);
    const slug = new URLSearchParams(location.search).get('post');
    if (slug && article) renderArticle(posts.find(post => post.slug === slug));
    else renderFilters(posts);
  } catch (error) {
    showMessage(preview, 'Posts are unavailable right now.');
    showMessage(list, 'Posts are unavailable right now.');
    console.error('Could not load blog posts:', error);
  }
}

loadPosts();
