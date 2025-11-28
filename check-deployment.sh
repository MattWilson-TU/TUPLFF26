#!/bin/bash

echo "🔍 Checking Cloud Run deployment status..."

# Check if service exists and is running
echo "📋 Service Status:"
gcloud run services list --region europe-west2

echo ""
echo "🌐 Testing health endpoint:"
curl -s "https://web-app-884572147716.europe-west2.run.app/api/health" | jq . || echo "❌ Health check failed"

echo ""
echo "📊 Recent logs:"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=web-app AND resource.labels.location=europe-west2" --limit=10 --format="table(timestamp,severity,textPayload)"

echo ""
echo "🔧 Service configuration:"
gcloud run services describe web-app --region europe-west2 --format="value(spec.template.spec.template.spec.containers[0].env[].name,spec.template.spec.template.spec.containers[0].env[].value)"
