# Shuaib Ahmed Network Portfolio

The portfolio is a static site. Serve this folder locally to preview it, or deploy it on Netlify with the repository connected to GitHub. The site directory in the repository is `Shuaib_Ahmed/Shuaib_Ahmed_Network_Portfolio`.

## Blog publishing setup

The public blog reads `data/posts.json`. The editor at `/admin/` uses Decap CMS and writes that file back to the GitHub repository. A Git-connected Netlify deployment is required for saved posts to appear automatically; a manual drag-and-drop deployment will not update when the editor commits a post.

For local editing at `http://127.0.0.1:4173/admin/`, run `$env:BIND_HOST='127.0.0.1'; npx --yes decap-server` in PowerShell from the Git repository root and keep the site preview server running. This binds the local proxy to your computer and edits the working tree without GitHub login; it does not publish. Commit and push the edited `data/posts.json` to publish local changes. Without the local proxy, the editor falls back to Netlify OAuth, which requires the setup below.

1. Connect `faraz176/Shuaib_Ahmed_Portfolio_Site` to the Netlify site, with the site directory above as the base directory and `.` as the publish directory. No build command is needed.
2. In GitHub, create an OAuth App for this site. Set its authorization callback URL to `https://api.netlify.com/auth/done`.
3. In Netlify, open **Project configuration > Security > OAuth**, install the GitHub provider, and enter the OAuth App client ID and secret there. Never put the secret in this repository.
4. Open `https://shuaibahmedportfolio.netlify.app/admin/` and sign in with a GitHub account that has push access to the repository.
5. Open **Writing > Blog posts**, add a post with a title, date, summary, optional comma-separated custom tags, and article text, then publish. The URL is generated automatically from the title when the post is first saved and remains stable if the title changes later. Posts display on the homepage and at `/blog.html` after Netlify deploys the commit.

Tags appear automatically in the **Filter by tag** menu on the full blog page. Enter readable names with spaces rather than URL-style slugs. Reuse the same tag name on multiple posts to group them; capitalization differences are treated as the same tag. Older posts without tags continue to appear under **All posts**.

Only enter content ready to be public. The blog data file is served with the static site.

Only the repository owner and GitHub collaborators with write access can edit posts. Keep write access limited to Shuaib's account if publishing must remain exclusive.

## Reader replies

Each blog post embeds [Utterances](https://utteranc.es/) replies backed by the separate public repository `faraz176/Shuaib_Ahmed_Portfolio_Comments`. The portfolio source repository remains private. Readers can reply using a GitHub account; they cannot edit blog posts. Replies can be moderated in the comments repository's Issues tab.

To activate the embedded reply form, install the [Utterances GitHub App](https://github.com/apps/utterances) for `faraz176/Shuaib_Ahmed_Portfolio_Comments` and grant it access to that repository. Its Issues feature is already enabled. Until installation is complete, the reply widget may show a setup error. No GitHub secret belongs in this site.

If the Netlify site's deploy settings differ from step 1, ensure its published root contains `index.html`, `admin/`, and `data/posts.json`. The editor configuration targets paths relative to the Git repository root.

## Site structure

- `index.html`: homepage, credentials, labs, TopoDrawer, field photo carousel, and recent blog posts
- `blog.html`: full blog list and article views
- `admin/`: authenticated blog editor configuration
- `data/posts.json`: authored post data
- `assets/docs/Shuaib_Ahmed_Resume.pdf`: sole resume, supplied September 21, 2026
- `assets/photos/`: curated gallery photos with EXIF metadata stripped
- `assets/video/preferred.mp4`: TopoDrawer walkthrough
- `labs/`: technical lab reports

## Photo privacy

The gallery was curated to exclude photos with potentially client-identifying interfaces, time-clock devices, serial labels, or other sensitive material. Review new photos before publishing them.
