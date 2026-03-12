    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
            body: ['"Inter"', 'system-ui', 'sans-serif']
          },
          colors: {
            base: '#0c1021',
            glass: 'rgba(255,255,255,0.06)',
            accent: '#7cf8d3',
            highlight: '#a8c5ff'
          },
          boxShadow: {
            glow: '0 10px 40px rgba(124, 248, 211, 0.25)',
            glass: '0 15px 80px rgba(0,0,0,0.35)'
          }
        }
      }
    }
