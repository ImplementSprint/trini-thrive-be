#!/usr/bin/env bash
# Deploy the Hopecard → Athena → PowerBI pipeline to AWS.
# Usage: ./deploy.sh <raw-bucket> <results-bucket> <lambda-artifact-bucket>
#
# Prerequisites:
#   - AWS CLI configured with sufficient IAM permissions
#   - Python 3.12 available locally for packaging
#   - Power BI credentials stored in Secrets Manager (see README)

set -euo pipefail

RAW_BUCKET="${1:?Usage: ./deploy.sh <raw-bucket> <results-bucket> <lambda-artifact-bucket>}"
RESULTS_BUCKET="${2:?}"
ARTIFACT_BUCKET="${3:?}"

STACK_NAME="hopecard-pipeline"
LAMBDA_ZIP="lambda.zip"
LAMBDA_KEY="hopecard-pipeline/${LAMBDA_ZIP}"
REGION="${AWS_DEFAULT_REGION:-ap-southeast-1}"

echo "── Packaging Lambda ──────────────────────────────────────────────────────"
cd lambda
pip install -r requirements.txt --target ./package --quiet
cp *.py ./package/
cd package
zip -r "../../${LAMBDA_ZIP}" . --quiet
cd ../..

echo "── Uploading Lambda zip to s3://${ARTIFACT_BUCKET}/${LAMBDA_KEY} ─────────"
aws s3 cp "${LAMBDA_ZIP}" "s3://${ARTIFACT_BUCKET}/${LAMBDA_KEY}" --region "${REGION}"
rm "${LAMBDA_ZIP}"

echo "── Deploying CloudFormation stack: ${STACK_NAME} ────────────────────────"
aws cloudformation deploy \
  --template-file infra/cloudformation.yaml \
  --stack-name "${STACK_NAME}" \
  --region "${REGION}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    RawBucket="${RAW_BUCKET}" \
    ResultsBucket="${RESULTS_BUCKET}" \
    LambdaCodeBucket="${ARTIFACT_BUCKET}" \
    LambdaCodeKey="${LAMBDA_KEY}" \
  --no-fail-on-empty-changeset

echo ""
echo "✅ Deployment complete."
echo ""
echo "── Next steps ────────────────────────────────────────────────────────────"
echo "1. Enable EventBridge notifications on s3://${RAW_BUCKET}:"
echo "   AWS Console → S3 → ${RAW_BUCKET} → Properties → Event notifications → EventBridge → On"
echo ""
echo "2. Store Power BI credentials in Secrets Manager:"
echo "   aws secretsmanager create-secret \\"
echo "     --name powerbi/refresh-credentials \\"
echo "     --region ${REGION} \\"
echo "     --secret-string '{"
echo "       \"tenant_id\":     \"<your-azure-tenant-id>\","
echo "       \"client_id\":     \"<your-app-registration-client-id>\","
echo "       \"client_secret\": \"<your-app-registration-client-secret>\","
echo "       \"dataset_id\":    \"<your-powerbi-dataset-id>\","
echo "       \"group_id\":      \"<your-powerbi-workspace-id>\""
echo "     }'"
echo ""
echo "3. Force a full refresh to validate the pipeline:"
echo "   aws lambda invoke \\"
echo "     --function-name hopecard-pipeline-refresh \\"
echo "     --region ${REGION} \\"
echo "     --payload '{\"Records\":[]}' \\"
echo "     --environment-variables '{\"FORCE_REFRESH_ALL\":\"true\"}' \\"
echo "     response.json && cat response.json"
