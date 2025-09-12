import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const accessToken = process.env.INTERCOM_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Intercom access token not configured' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch('https://api.intercom.io/admins', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Intercom-Version': '2.14',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Intercom API error:', errorData);
      return NextResponse.json(
        { error: `Failed to fetch admins: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Return all admins - they all have basic article creation permissions
    // Frontend will cache this for the session
    const admins = data.admins || [];

    return NextResponse.json({
      admins: admins.map((admin: any) => ({
        id: admin.id,
        name: admin.name,
        email: admin.email,
      }))
    });

  } catch (error) {
    console.error('Error fetching Intercom admins:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admins' },
      { status: 500 }
    );
  }
}