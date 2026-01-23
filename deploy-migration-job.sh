#!/bin/bash

# Script to deploy the Cloud Run Job for running Prisma migrations
# This should be run after the web app image has been built and pushed

set -e

# Configuration - adjust these as needed
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${GCLOUD_PROJECT}}"
REGION="${GOOGLE_CLOUD_REGION:-europe-west1}"
JOB_NAME="db-migration-job"
SERVICE_NAME="web-app"
IMAGE_NAME="europe-west1-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/web-app:latest"

# Check if PROJECT_ID is set
if [ -z "$PROJECT_ID" ]; then
  echo "Error: GOOGLE_CLOUD_PROJECT or GCLOUD_PROJECT environment variable must be set"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL must be set"
  exit 1
fi

echo "Deploying Cloud Run migration Job: ${JOB_NAME}"
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

  gcloud run jobs update "${JOB_NAME}" \
    --image="${IMAGE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --command="prisma" \
    --args="migrate","deploy" \
    --memory="512Mi" \
    --cpu="1" \
    --max-retries=1 \
    --task-timeout=600 \
    --set-env-vars="NODE_ENV=production" \
    --set-env-vars="DATABASE_URL=${DATABASE_URL}" \
    --set-cloudsql-instances="tuplff25-26:europe-west2:fpl-auction-db"
else
  echo "Creating new job ${JOB_NAME}..."

  gcloud run jobs create "${JOB_NAME}" \
    --image="${IMAGE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --command="prisma" \
    --args="migrate","deploy" \
    --memory="512Mi" \
    --cpu="1" \
    --max-retries=1 \
    --task-timeout=600 \
    --set-env-vars="NODE_ENV=production" \
    --set-env-vars="DATABASE_URL=${DATABASE_URL}" \
    --set-cloudsql-instances="tuplff25-26:europe-west2:fpl-auction-db"
fi

echo ""
echo "Cloud Run migration job deployed: ${JOB_NAME}"
echo "To execute the job:"
echo "  gcloud run jobs execute ${JOB_NAME} --region=${REGION} --project=${PROJECT_ID}"

