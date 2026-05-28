#!/bin/bash

# Deploy Cloud Run Job for daily WC2026 fixture sync from football-data.org

set -e

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${GCLOUD_PROJECT}}"
REGION="${GOOGLE_CLOUD_REGION:-europe-west1}"
JOB_NAME="wc2026-update-job"
SERVICE_NAME="web-app"
IMAGE_NAME="europe-west1-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/web-app:latest"
CLOUDSQL_INSTANCE="${CLOUDSQL_INSTANCE:-tuplff25-26:europe-west2:fpl-auction-db}"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: GOOGLE_CLOUD_PROJECT or GCLOUD_PROJECT environment variable must be set"
  exit 1
fi

if [ -z "$FOOTBALL_DATA_API_TOKEN" ]; then
  echo "Error: FOOTBALL_DATA_API_TOKEN environment variable must be set"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable must be set"
  exit 1
fi

echo "Deploying Cloud Run Job: ${JOB_NAME}"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Image: ${IMAGE_NAME}"
echo ""

SERVICE_ACCOUNT=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(spec.template.spec.serviceAccountName)" 2>/dev/null || echo "")

if [ -z "$SERVICE_ACCOUNT" ]; then
  PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")
  SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  echo "No service account found for ${SERVICE_NAME}, using default: ${SERVICE_ACCOUNT}"
else
  echo "Using service account from ${SERVICE_NAME}: ${SERVICE_ACCOUNT}"
fi

if gcloud run jobs describe "${JOB_NAME}" --region="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "Job ${JOB_NAME} already exists. Updating..."
  gcloud run jobs update "${JOB_NAME}" \
    --image="${IMAGE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --command="node" \
    --args="scripts/cloud-update-wc2026.js" \
    --memory="1Gi" \
    --cpu="1" \
    --max-retries=1 \
    --task-timeout=600 \
    --set-env-vars="NODE_ENV=production" \
    --set-env-vars="DATABASE_URL=${DATABASE_URL}" \
    --set-env-vars="FOOTBALL_DATA_API_TOKEN=${FOOTBALL_DATA_API_TOKEN}" \
    --set-cloudsql-instances="${CLOUDSQL_INSTANCE}"
else
  echo "Creating new job ${JOB_NAME}..."
  gcloud run jobs create "${JOB_NAME}" \
    --image="${IMAGE_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --command="node" \
    --args="scripts/cloud-update-wc2026.js" \
    --memory="1Gi" \
    --cpu="1" \
    --max-retries=1 \
    --task-timeout=600 \
    --set-env-vars="NODE_ENV=production" \
    --set-env-vars="DATABASE_URL=${DATABASE_URL}" \
    --set-env-vars="FOOTBALL_DATA_API_TOKEN=${FOOTBALL_DATA_API_TOKEN}" \
    --set-cloudsql-instances="${CLOUDSQL_INSTANCE}"
fi

echo ""
echo "Granting permissions to service account: ${SERVICE_ACCOUNT}..."

gcloud run jobs add-iam-policy-binding "${JOB_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/run.invoker"

echo ""
echo "✅ WC2026 Cloud Run Job deployed successfully!"
echo ""
echo "Job name: ${JOB_NAME}"
echo "Manual trigger:"
echo "  gcloud run jobs execute ${JOB_NAME} --region=${REGION} --project=${PROJECT_ID}"
echo ""
echo "Optional daily schedule (06:00 UTC):"
echo "  gcloud scheduler jobs create http wc2026-daily-sync \\"
echo "    --location=${REGION} \\"
echo "    --schedule='0 6 * * *' \\"
echo "    --uri=\"https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run\" \\"
echo "    --http-method=POST \\"
echo "    --oauth-service-account-email=${SERVICE_ACCOUNT}"
