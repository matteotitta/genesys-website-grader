import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const score = searchParams.get('score') || '0';
  const grade = searchParams.get('grade') || 'C';
  const url = searchParams.get('url') || 'example.com';

  // Extract domain name for display
  const domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

  // Grade colors matching the app
  const gradeColors: Record<string, string> = {
    'A': '#A4FF98', // green
    'B': '#7AFFFF', // teal
    'C': '#FFE566', // yellow
    'D': '#FF7733', // orange
    'F': '#f43f5e', // red
  };

  const gradeColor = gradeColors[grade] || gradeColors['C'];

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1E2347',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Background gradient effect */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            left: '-100px',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(147, 155, 237, 0.15) 0%, transparent 70%)',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          {/* Genesys branding */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#C8D1D3',
              fontSize: '24px',
            }}
          >
            <span>Genesys Website Grader</span>
          </div>

          {/* Domain being analyzed */}
          <div
            style={{
              color: '#939BED',
              fontSize: '32px',
              fontWeight: 500,
            }}
          >
            {domain}
          </div>

          {/* Score display */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                fontSize: '140px',
                fontWeight: 700,
                color: '#F7F7F7',
                lineHeight: 1,
              }}
            >
              {score}
            </div>
            <div
              style={{
                fontSize: '28px',
                color: '#C8D1D3',
              }}
            >
              out of 100
            </div>
          </div>

          {/* Grade badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 32px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: `2px solid ${gradeColor}`,
            }}
          >
            <span
              style={{
                fontSize: '36px',
                fontWeight: 600,
                color: gradeColor,
              }}
            >
              Grade {grade}
            </span>
          </div>

          {/* CTA */}
          <div
            style={{
              marginTop: '20px',
              color: '#C8D1D3',
              fontSize: '20px',
            }}
          >
            Get your free positioning report at website-grader.genesysgrowth.com
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
