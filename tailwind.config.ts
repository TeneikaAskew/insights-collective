import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
				display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
				outfit: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
				lora: ['Lora', 'Georgia', 'serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				/* Soft Studio palette — the site-wide system; --ss-* vars live on :root. */
				ss: {
					lav: 'hsl(var(--ss-lav))',
					'lav-deep': 'hsl(var(--ss-lav-deep))',
					'lav-chip': 'hsl(var(--ss-lav-chip))',
					peach: 'hsl(var(--ss-peach))',
					'peach-deep': 'hsl(var(--ss-peach-deep))',
					'card-warm': 'hsl(var(--ss-card-warm))',
					track: 'hsl(var(--ss-track))',
					good: 'hsl(var(--ss-good))',
					'good-chip': 'hsl(var(--ss-good-chip))',
					warn: 'hsl(var(--ss-warn))',
					'warn-chip': 'hsl(var(--ss-warn-chip))',
					bad: 'hsl(var(--ss-bad))',
					'bad-chip': 'hsl(var(--ss-bad-chip))',
					teal: 'hsl(var(--ss-teal))',
					'teal-chip': 'hsl(var(--ss-teal-chip))',
				},
			sidebar: {
				DEFAULT: 'hsl(var(--sidebar-background))',
				foreground: 'hsl(var(--sidebar-foreground))',
				primary: 'hsl(var(--sidebar-primary))',
				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
				accent: 'hsl(var(--sidebar-accent))',
				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
				border: 'hsl(var(--sidebar-border))',
				ring: 'hsl(var(--sidebar-ring))'
			},
						},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'float': {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-10px)' }
				},
				'pulse-slow': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.7' }
				},
				'gradient-x': {
					'0%, 100%': {
						'background-size': '200% 200%',
						'background-position': 'left center'
					},
					'50%': {
						'background-size': '200% 200%',
						'background-position': 'right center'
					}
				},
				'count-up': {
					from: { content: '0' },
					to: { content: 'attr(data-value)' }
				},
				'slide-up': {
					from: { transform: 'translateY(20px)', opacity: '0' },
					to: { transform: 'translateY(0)', opacity: '1' }
				},
				'fade-in': {
					from: { opacity: '0' },
					to: { opacity: '1' }
				},
				'shimmer': {
					'0%': { backgroundPosition: '-1000px 0' },
					'100%': { backgroundPosition: '1000px 0' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'float': 'float 6s ease-in-out infinite',
				'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
				'gradient-x': 'gradient-x 15s ease infinite',
				'slide-up': 'slide-up 0.5s ease-out forwards',
				'fade-in': 'fade-in 0.5s ease-out forwards',
				'shimmer': 'shimmer 2s infinite linear'
			},
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
