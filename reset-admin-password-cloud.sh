#!/bin/bash

# Script to reset Admin01 password using Cloud Run Job
# This runs the reset script in the GCP environment where it can access Cloud SQL

set -e

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${GCLOUD_PROJECT:-tuplff25-26}}"
REGION="europe-west1"
JOB_NAME="reset-admin-password-job"
IMAGE_NAME="europe-west1-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/web-app:latest"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL environment variable must be set"
  echo ""
  echo "For Cloud SQL, use:"
  echo "  export DATABASE_URL='postgresql://fpluser:Simple123@/fpl_auction?host=/cloudsql/tuplff25-26:europe-west2:fpl-auction-db'"
  exit 1
fi

echo "🔐 Creating Cloud Run Job to reset Admin01 password..."
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo ""

# Check if job already exists
if gcloud run jobs describe "${JOB_NAME}" --region="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "Job ${JOB_NAME} already exists. Updating..."
  
  gcloud run jobs update "${JOB_NAME}" \
    --image="${IMAGE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --command="sh" \
    --args="-c,cd /app && node reset-admin-password.js" \
    --memory="1Gi" \
    --cpu="1" \
    --max-retries=1 \
    --task-timeout=300 \
    --set-env-vars="NODE_ENV=production" \
    --set-env-vars="DATABASE_URL=${DATABASE_URL}" \
    --set-cloudsql-instances="tuplff25-26:europe-west2:fpl-auction-db" \
    --quiet
else
  echo "Creating new job ${JOB_NAME}..."
  
  gcloud run jobs create "${JOB_NAME}" \
    --image="${IMAGE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --command="sh" \
    --args="-c,cd /app && node reset-admin-password.js" \
    --memory="1Gi" \
    --cpu="1" \
    --max-retries=1 \
    --task-timeout=300 \
    --set-env-vars="NODE_ENV=production" \
    --set-env-vars="DATABASE_URL=${DATABASE_URL}" \
    --set-cloudsql-instances="tuplff25-26:europe-west2:fpl-auction-db" \
    --quiet
fi

echo ""
echo "🚀 Executing the job..."
gcloud run jobs execute "${JOB_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --wait

echo ""
echo "📋 Checking job logs..."
sleep 5
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=${JOB_NAME}" \
  --limit=20 \
  --project="${PROJECT_ID}" \
  --format="table(timestamp,textPayload)" \
  --freshness=5m

echo ""
echo "✅ Password reset job completed!"
echo ""
echo "You can now log in with:"
echo "  Username: Admin01"
echo "  Password: Password"

