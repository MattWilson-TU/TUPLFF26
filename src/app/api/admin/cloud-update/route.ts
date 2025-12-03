import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin can trigger cloud update
    if ((session.user as any).username !== 'Admin01') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get project ID and region from environment or metadata
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT
    const region = process.env.GOOGLE_CLOUD_REGION || 'europe-west1'
    const jobName = process.env.CLOUD_RUN_JOB_NAME || 'fpl-update-job'

    if (!projectId) {
      console.error('Missing GOOGLE_CLOUD_PROJECT environment variable')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Get access token from metadata server
    let accessToken: string
    try {
      const metadataUrl = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token'
      const metadataRes = await fetch(metadataUrl, {
        headers: {
          'Metadata-Flavor': 'Google',
        },
      })

      if (!metadataRes.ok) {
        throw new Error(`Failed to get metadata token: ${metadataRes.status}`)
      }

      const metadata = await metadataRes.json()
      accessToken = metadata.access_token
    } catch (error) {
      console.error('Error fetching access token:', error)
      return NextResponse.json({ error: 'Failed to authenticate with Google Cloud' }, { status: 500 })
    }

    // Trigger the Cloud Run Job execution
    const jobApiUrl = `https://${region}-run.googleapis.com/v2/projects/${projectId}/locations/${region}/jobs/${jobName}:run`
    
    try {
      const jobRes = await fetch(jobApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (!jobRes.ok) {
        const errorText = await jobRes.text()
        console.error(`Failed to trigger job: ${jobRes.status}`, errorText)
        return NextResponse.json({ 
          error: `Failed to trigger Cloud Run Job: ${jobRes.status}`,
          details: errorText 
        }, { status: jobRes.status })
      }

      const jobExecution = await jobRes.json()
      
      console.log('Cloud Run Job triggered successfully:', jobExecution.name)

      return NextResponse.json({
        success: true,
        message: 'Cloud update job triggered successfully',
        execution: {
          name: jobExecution.name,
          uid: jobExecution.uid,
        },
      })
    } catch (error: any) {
      console.error('Error triggering Cloud Run Job:', error)
      return NextResponse.json({ 
        error: 'Failed to trigger Cloud Run Job',
        details: error.message 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Error in cloud-update route:', error)
    return NextResponse.json({ error: 'Failed to trigger cloud update' }, { status: 500 })
  }
}

