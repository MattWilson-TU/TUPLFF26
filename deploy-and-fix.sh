#!/bin/bash

echo "🚀 Deploying and fixing Cloud Run authentication issues..."

# Check if required environment variables are set
if [ -z "$PROJECT_ID" ]; then
    echo "❌ PROJECT_ID is not set. Please set it:"
    echo "export PROJECT_ID='tuplff25-26'"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL is not set. Please set it:"
    echo "export DATABASE_URL='postgresql://user:password@host:5432/db'"
    exit 1
fi

if [ -z "$NEXTAUTH_SECRET" ]; then
    echo "❌ NEXTAUTH_SECRET is not set. Generating one now..."
    export NEXTAUTH_SECRET=$(openssl rand -base64 32)
    echo "✅ Generated NEXTAUTH_SECRET: $NEXTAUTH_SECRET"
fi

echo "🔧 Building and pushing Docker image..."

# Build and push the image
docker buildx build --platform linux/amd64 \
  -t europe-west2-docker.pkg.dev/$PROJECT_ID/web-app-repo/web-app:latest \
  --push .

echo "🚀 Deploying to Cloud Run with enhanced configuration..."

# Deploy to Cloud Run with all required environment variables
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

echo "⏳ Waiting for deployment to complete..."
sleep 30

echo "🔍 Testing health endpoint..."
curl -s "https://web-app-884572147716.europe-west2.run.app/api/health" | jq .

echo "🗄️ Setting up database..."

# Run database migrations
echo "Running database migrations..."
docker run --rm -e DATABASE_URL="$DATABASE_URL" \
  europe-west2-docker.pkg.dev/$PROJECT_ID/web-app-repo/web-app:latest \
  npx prisma migrate deploy

# Create admin user
echo "Creating admin user..."
docker run --rm -e DATABASE_URL="$DATABASE_URL" \
  -v $(pwd):/app \
  -w /app \
  node:20-alpine \
  sh -c "npm install bcrypt @prisma/client && node create-admin.js"

echo "✅ Deployment complete!"
echo ""
echo "🌐 Your app is available at: https://web-app-884572147716.europe-west2.run.app"
echo ""
echo "🔑 Admin credentials:"
echo "Username: Admin01"
echo "Password: Password"
echo ""
echo "🔍 To check logs:"
echo "gcloud run logs tail web-app --region europe-west2"
echo ""
echo "🔍 To check health:"
echo "curl https://web-app-884572147716.europe-west2.run.app/api/health"
