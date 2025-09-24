# Vercel Deployment Guide for milloin-server

## Overview
This guide explains how to deploy the milloin-server NestJS application to Vercel's serverless platform.

## Prerequisites
- Node.js 18+ installed locally
- A Vercel account (free tier available)
- Git repository for the project

## Deployment Configuration

### Files Created for Vercel:
- `vercel.json` - Minimal Vercel configuration with routing only (auto-detects Node.js)
- `api/index.ts` - Serverless function entry point
- Updated `package.json` with `vercel-build` script
- Modified `src/main.ts` for serverless compatibility

## Deployment Methods

### Option A: Vercel CLI (Recommended)

1. **Install Vercel CLI globally:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy from project root:**
   ```bash
   vercel
   ```

4. **Configuration prompts:**
   - Project name: `milloin-server`
   - Framework: `Other` (NestJS not auto-detected)
   - Build command: `npm run vercel-build`
   - Output directory: (leave empty)
   - Development command: `npm run start:dev`

5. **Production deployment:**
   ```bash
   vercel --prod
   ```

### Option B: GitHub Integration

1. **Push code to GitHub repository**

2. **Import project to Vercel:**
   - Go to [vercel.com](https://vercel.com) → Import Project
   - Connect GitHub and select your repository
   - Configure build settings:
     - **Framework Preset:** Other
     - **Build Command:** `npm run vercel-build`
     - **Output Directory:** (leave empty)
     - **Install Command:** `npm install`

3. **Auto-deployment:**
   - Every push to main branch triggers automatic deployment
   - Preview deployments for pull requests

## Environment Variables

If you need environment variables:

1. **In Vercel Dashboard:**
   - Go to Project Settings → Environment Variables
   - Add variables like:
     - `NODE_ENV=production`
     - Any API keys or configuration values

2. **In code:**
   - Variables are automatically available via `process.env`
   - No additional configuration needed

## API Endpoints After Deployment

Once deployed, your API will be available at:

- **Base URL:** `https://your-project-name.vercel.app`
- **Washing Machine API:** `https://your-project-name.vercel.app/washing-machine/forecast`
- **Swagger Documentation:** `https://your-project-name.vercel.app/api`
- **Health Check:** `https://your-project-name.vercel.app/`

## Custom Domain (Optional)

To use a custom domain:

1. **In Vercel Dashboard:**
   - Go to Project Settings → Domains
   - Add your custom domain
   - Configure DNS records as instructed

2. **Domain examples:**
   - `api.milloin.fi`
   - `milloin-api.yourdomain.com`

## Monitoring and Logs

1. **Function Logs:**
   - View in Vercel Dashboard → Functions tab
   - Real-time logs during development
   - Historical logs for debugging

2. **Analytics:**
   - Built-in analytics in Vercel Dashboard
   - Request metrics and performance data

3. **Error Tracking:**
   - Automatic error detection
   - Email notifications available

## Performance Optimization

The application is configured for optimal serverless performance:

- **Cold Start Optimization:** App instance reuse for multiple requests
- **Caching:** In-memory caching works within function lifecycle
- **CORS:** Properly configured for cross-origin requests
- **Build Size:** Minimal dependencies for fast deployments

## Final Working Configuration

After testing and iteration, the following configuration works successfully:

### Verified `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "api/index.ts"
    }
  ]
}
```

### Successful Deployment Results:
- **Production URL:** https://milloin-server.vercel.app
- **Status:** ✅ All endpoints working
- **API endpoint:** `/washing-machine/forecast` returns real Finnish electricity data
- **Documentation:** `/api` provides Swagger UI

## Troubleshooting

### Common Issues Encountered and Solutions:

1. **"Functions and builds cannot be used together" error:**
   - **Problem:** Having both `functions` and `builds` properties in vercel.json
   - **Solution:** Use only `builds` property with `@vercel/node` runtime

2. **"Function Runtimes must have a valid version" error:**
   - **Problem:** Using AWS Lambda syntax like `nodejs18.x`
   - **Solution:** Use `@vercel/node` runtime or omit runtime for auto-detection

3. **Output directory errors:**
   - **Problem:** Vercel looking for "public" directory
   - **Solution:** Proper serverless function setup with `api/index.ts` entry point

4. **Authentication protection on preview URLs:**
   - **Problem:** Some deployment URLs require auth
   - **Solution:** Use production URL or check project settings

5. **Build Failures:**
   - Ensure all dependencies are in `dependencies` (not `devDependencies`)
   - Check TypeScript compilation errors

6. **Function Timeouts:**
   - Vercel free tier has 10s timeout
   - Pro tier has 60s timeout
   - Optimize external API calls

7. **Memory Issues:**
   - Free tier: 1024MB memory limit
   - Monitor usage in Vercel Dashboard

### Debug Commands:

```bash
# Test build locally
npm run vercel-build

# Test production build
npm run build && npm run start:prod

# Check for TypeScript errors
npx tsc --noEmit
```

## Cost Considerations

- **Free Tier:** 100GB bandwidth, 100GB-hrs compute time
- **Hobby Plan:** $20/month for higher limits
- **Pro Plan:** Usage-based billing for production apps

## Security

- **HTTPS:** Automatic SSL certificates
- **Environment Variables:** Encrypted at rest
- **CORS:** Configured to accept all origins (modify in production if needed)

## Support

For deployment issues:
- Check Vercel documentation: https://vercel.com/docs
- Vercel community: https://github.com/vercel/vercel/discussions
- NestJS Vercel guide: https://docs.nestjs.com/faq/serverless