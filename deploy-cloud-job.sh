#!/bin/bash

# Script to deploy the Cloud Run Job for FPL data updates
# This should be run after the web app has been deployed

set -e

# Configuration - adjust these as needed
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${GCLOUD_PROJECT}}"
REGION="${GOOGLE_CLOUD_REGION:-europe-west1}"
JOB_NAME="fpl-update-job"
SERVICE_NAME="web-app"
IMAGE_NAME="europe-west1-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/web-app:latest"

# Check if PROJECT_ID is set
if [ -z "$PROJECT_ID" ]; then
  echo "Error: GOOGLE_CLOUD_PROJECT or GCLOUD_PROJECT environment variable must be set"
  exit 1
fi

echo "Deploying Cloud Run Job: ${JOB_NAME}"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Image: ${IMAGE_NAME}"
echo ""

# Get the service account email for the web app
# Try to get it from the Cloud Run service, or use default compute service account
SERVICE_ACCOUNT=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(spec.template.spec.serviceAccountName)" 2>/dev/null || echo "")

if [ -z "$SERVICE_ACCOUNT" ]; then
  # If no service account is set, use the default compute service account
  PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")
  SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  echo "No service account found for ${SERVICE_NAME}, using default: ${SERVICE_ACCOUNT}"
else
  echo "Using service account from ${SERVICE_NAME}: ${SERVICE_ACCOUNT}"
fi

# Check if job already exists
if gcloud run jobs describe "${JOB_NAME}" --region="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "Job ${JOB_NAME} already exists. Updating..."
  
  # Update the existing job
  gcloud run jobs update "${JOB_NAME}" \
    --image="${IMAGE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --command="node" \
    --args="scripts/cloud-update-fpl.js" \
    --memory="2Gi" \
    --cpu="2" \
    --max-retries=1 \
    --task-timeout=3600 \
    --set-env-vars="NODE_ENV=production" \
    --set-env-vars="DATABASE_URL=${DATABASE_URL}" \
    --set-env-vars="NEXTAUTH_URL=${NEXTAUTH_URL:-https://app.tuplff.co.uk}" \
    --set-env-vars="NEXTAUTH_SECRET=${NEXTAUTH_SECRET}"
else
  echo "Creating new job ${JOB_NAME}..."
  
  # Create the job
  gcloud run jobs create "${JOB_NAME}" \
    --image="${IMAGE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --command="node" \
    --args="scripts/cloud-update-fpl.js" \
    --memory="2Gi" \
    --cpu="2" \
    --max-retries=1 \
    --task-timeout=3600 \
    --set-env-vars="NODE_ENV=production" \
    --set-env-vars="DATABASE_URL=${DATABASE_URL}" \
    --set-env-vars="NEXTAUTH_URL=${NEXTAUTH_URL:-https://app.tuplff.co.uk}" \
    --set-env-vars="NEXTAUTH_SECRET=${NEXTAUTH_SECRET}"
fi

echo ""
echo "Granting permissions to service account: ${SERVICE_ACCOUNT}..."

# Grant the web app service account permission to invoke the job
gcloud run jobs add-iam-policy-binding "${JOB_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/run.invoker"

echo ""
echo "✅ Cloud Run Job deployed successfully!"
echo ""
echo "Job name: ${JOB_NAME}"
echo "Region: ${REGION}"
echo "Service account with invoke permission: ${SERVICE_ACCOUNT}"
echo ""
echo "To manually trigger the job, run:"
echo "  gcloud run jobs execute ${JOB_NAME} --region=${REGION} --project=${PROJECT_ID}"
echo ""
echo "To view logs:"
echo "  gcloud logging read \"resource.type=cloud_run_job AND resource.labels.job_name=${JOB_NAME}\" --limit=50 --project=${PROJECT_ID}"

