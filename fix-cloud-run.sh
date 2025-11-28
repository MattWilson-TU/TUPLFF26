#!/bin/bash

# Quick fix script for Cloud Run deployment
# This script will redeploy your app with the correct environment variables

echo "🔧 Fixing Cloud Run deployment..."

# Check if required environment variables are set
if [ -z "$NEXTAUTH_SECRET" ]; then
    echo "❌ NEXTAUTH_SECRET is not set. Generating one now..."
    export NEXTAUTH_SECRET=$(openssl rand -base64 32)
    echo "✅ Generated NEXTAUTH_SECRET: $NEXTAUTH_SECRET"
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL is not set. Please set it:"
    echo "export DATABASE_URL='postgresql://user:password@host:5432/db'"
    exit 1
fi

if [ -z "$PROJECT_ID" ]; then
    echo "❌ PROJECT_ID is not set. Please set it:"
    echo "export PROJECT_ID='your-gcp-project-id'"
    exit 1
fi

echo "🚀 Deploying to Cloud Run with fixed configuration..."

# Deploy to Cloud Run with correct environment variables
gcloud run deploy web-app \
  --image europe-west2-docker.pkg.dev/$PROJECT_ID/web-app-repo/web-app:latest \
  --region europe-west2 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production \
  --set-env-vars NEXTAUTH_URL=https://web-app-884572147716.europe-west2.run.app \
  --set-env-vars NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
  --set-env-vars DATABASE_URL="$DATABASE_URL" \
  --quiet

echo "✅ Deployment complete!"
echo "🌐 Your app should now be accessible at: https://web-app-884572147716.europe-west2.run.app"
echo ""
echo "📝 Next steps:"
echo "1. Set up your database migrations:"
echo "   docker run --rm -e DATABASE_URL=\"$DATABASE_URL\" \\"
echo "     europe-west2-docker.pkg.dev/$PROJECT_ID/web-app-repo/web-app:latest \\"
echo "     npx prisma migrate deploy"
echo ""
echo "2. Seed your database:"
echo "   docker run --rm -e DATABASE_URL=\"$DATABASE_URL\" \\"
echo "     europe-west2-docker.pkg.dev/$PROJECT_ID/web-app-repo/web-app:latest \\"
echo "     npx prisma db seed"
