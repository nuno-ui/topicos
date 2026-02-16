import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          Y
        </span>
      </div>
    ),
    { ...size }
  );
}
