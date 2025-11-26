tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                slate: {
                    850: '#152033',
                    900: '#0f172a',
                    950: '#020617',
                },
                primary: {
                    500: '#6366f1', // Indigo
                    600: '#4f46e5',
                },
                accent: {
                    500: '#f59e0b', // Amber for decrypt
                    600: '#d97706',
                }
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(5px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                }
            }
        }
    }
};
