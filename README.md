<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f0b91c9e-e3f0-4f9f-bef6-731b1ed6b8f1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Publish to GitHub Pages

The GitHub Actions workflow deploys the app whenever changes are pushed to `main`.
For the first deployment, set the repository's Pages source to **GitHub Actions** in **Settings → Pages**.
After setting the source, run **Deploy to GitHub Pages** from the **Actions** tab once.

The published site is available at https://craig-davis-r.github.io/church-cleaning-schedule/.
