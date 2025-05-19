
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './components/interview-prep/flashcard.css'
import { Toaster } from '@/components/ui/toaster.tsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Debug localStorage on startup
console.log("==== Initial localStorage state ====");
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    console.log("Total localStorage items:", window.localStorage.length);
    
    // Find STAR-related items
    const starItems = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && (key.includes('star_') || key.includes('STAR') || key.includes('saved_star'))) {
        starItems.push({
          key,
          value: window.localStorage.getItem(key)
        });
      }
    }
    
    console.log("Found STAR-related items:", starItems.length);
    starItems.forEach(item => {
      console.log(`Key: ${item.key}, Has Value: ${!!item.value}`);
    });
  } catch (e) {
    console.error("Error checking localStorage:", e);
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster />
    </QueryClientProvider>
  </React.StrictMode>,
)
