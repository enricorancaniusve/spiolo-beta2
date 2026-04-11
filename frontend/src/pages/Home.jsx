import React, { useEffect, useState, useRef } from 'react'
import { api } from '../api/client'
import ConfessionCard from '../components/ConfessionCard'

const CAT_DATA = [
  { id: null, name: 'Tutti', emoji: '🌐' },
  { id: 'love', name: 'Amore', emoji: '❤️' },
  { id: 'school', name: 'Scuola', emoji: '📚' },
  { id: 'secrets', name: 'Segreti', emoji: '🤫' },
  { id: 'funny', name: 'Buffi', emoji: '😂' },
  { id: 'drama', name: 'Drama', emoji: '🎭' }
]

const PAGE_SIZE = 10
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function getDeviceId() {
  try {
    let id = localStorage.getItem('spiolo_device_id')
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem('spiolo_device_id', id)
    }
    return id
  } catch { return 'dev_anonymous' }
}

const PeopleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

const SpioloSVG = ({ animate }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    viewBox="0 0 600 600"
    style={{
      width: '100%',
      height: 'auto',
      display: 'block',
      position: 'absolute',
      bottom: 0,
      left: 0,
    }}
  >
    <defs>
      <linearGradient id="Sfumatura_senza_nome" x1="300" y1="629.08" x2="300" y2="-.11" gradientTransform="translate(0 .11)" gradientUnits="userSpaceOnUse">
        <stop offset=".03" stopColor="#624d9b" stopOpacity=".8"/>
        <stop offset=".23" stopColor="#614c9a"/>
        <stop offset=".82" stopColor="#342256"/>
      </linearGradient>
      <style>{`
        @keyframes sguardo {
          0%   { transform: translateX(0px); }
          15%  { transform: translateX(6px); }
          30%  { transform: translateX(6px); }
          50%  { transform: translateX(-6px); }
          65%  { transform: translateX(-6px); }
          80%  { transform: translateX(0px); }
          100% { transform: translateX(0px); }
        }
        @keyframes sguardo-sfasato {
          0%   { transform: translateX(0px); }
          17%  { transform: translateX(6px); }
          32%  { transform: translateX(6px); }
          52%  { transform: translateX(-6px); }
          67%  { transform: translateX(-6px); }
          82%  { transform: translateX(0px); }
          100% { transform: translateX(0px); }
        }
        #pupilla-destra {
          animation: ${animate ? 'sguardo 4s ease-in-out 2s infinite' : 'none'};
          transform-origin: 328px 432px;
        }
        #pupilla-sinistra {
          animation: ${animate ? 'sguardo-sfasato 4s ease-in-out 2s infinite' : 'none'};
          transform-origin: 287px 432px;
        }
      `}</style>
    </defs>
    <g id="Livello_2">
      <rect width="600" height="629.19" fill="url(#Sfumatura_senza_nome)"/>
    </g>
    <g id="Livello_1-2">
      <g>
        <g id="uuid-d3fd4fbd-f4db-4ed0-b70e-d071c6f52083">
          <path d="M403.51,398.59c3.13-10.78,3.71-22.37,1.64-33.39-.69-3.7-1.56-7.11-3.15-10.47-3.09-6.53-11.97-4.02-17.13-1.71-11.24,5.05-21.33,11.91-30.39,20.29-6.22,5.75-11.33,12.16-15.75,19.35-2.44,3.97-4.19,8.13-6.1,12.49-7.77-2.8-15.18-4.36-22.58-4.6h-4.01c-7.4.25-14.8,1.81-22.58,4.6-1.91-4.36-3.65-8.52-6.1-12.49-4.42-7.2-9.53-13.6-15.75-19.35-9.05-8.38-19.15-15.25-30.39-20.29-5.16-2.32-14.03-4.82-17.13,1.71-1.59,3.36-2.46,6.77-3.16,10.47-6.54,35,13.29,71.78,49.97,77.37-.86-4.82-.5-9.21.39-13.79-3.8-2.05-6.31-5.43-6.86-9.62l2.17-.82c-2.12-4.03-3.56-8.32-2.48-13.14,3.4.67,6.36,2.35,9.21,4.34-3.8-20.54-18.39-40.04-35.35-51.1-3.02-1.97-6.23-2.93-9.8-3.81,6.02-3.34,16.48,3.72,21.02,7.37,16.77,13.51,28.81,34.69,29.51,56.84-3.61-2.77-6.56-5.45-10.35-7.73.72,4.3,3.16,7.09,5.79,10.44-1.36.46-2.58.22-4.31-.05.05,2.05,4.47,4.09,6.25,5.45.49.37-1.02,6.76-1.11,7.77-.19,2.1-.13,4.16.2,6.24.89,5.71,3.04,10.84,6.52,15.51,2.48,3.32,5.76,6.16,9.67,7.51,4.66,1.61,9.76.99,14.64.36,11.44-1.48,22.87-2.96,34.31-4.44,7.72-1,15.56-2.03,22.66-5.21,6.83-3.06,11.17-7.7,14.78-14.07,1.45-2.55,3.9-3.03,6.42-4.4,2.77-1.51,5.42-3.25,7.91-5.19,10.54-8.25,17.73-19.79,21.4-32.44h.02Z" fill="#010101"/>
          <g>
            <path d="M403.51,398.59c3.13-10.78,3.71-22.37,1.64-33.39-.69-3.7-1.56-7.11-3.15-10.47-3.09-6.53-11.97-4.02-17.13-1.71-11.24,5.05-21.33,11.91-30.39,20.29-6.22,5.75-11.33,12.16-15.75,19.35-2.44,3.97-4.19,8.13-6.1,12.49-7.77-2.8-15.18-4.36-22.58-4.6h-4.01c-7.4.25-14.8,1.81-22.58,4.6-1.91-4.36-3.65-8.52-6.1-12.49-4.42-7.2-9.53-13.6-15.75-19.35-9.05-8.38-19.15-15.25-30.39-20.29-5.16-2.32-14.03-4.82-17.13,1.71-1.59,3.36-2.46,6.77-3.16,10.47-6.54,35,13.29,71.78,49.97,77.37-.86-4.82-.5-9.21.39-13.79-3.8-2.05-6.31-5.43-6.86-9.62l2.17-.82c-2.12-4.03-3.56-8.32-2.48-13.14,3.4.67,6.36,2.35,9.21,4.34-3.8-20.54-18.39-40.04-35.35-51.1-3.02-1.97-6.23-2.93-9.8-3.81,6.02-3.34,16.48,3.72,21.02,7.37,16.77,13.51,28.81,34.69,29.51,56.84-3.61-2.77-6.56-5.45-10.35-7.73.72,4.3,3.16,7.09,5.79,10.44-1.36.46-2.58.22-4.31-.05.05,2.05,4.47,4.09,6.25,5.45.49.37-1.02,6.76-1.11,7.77-.19,2.1-.13,4.16.2,6.24.89,5.71,3.04,10.84,6.52,15.51,2.48,3.32,5.76,6.16,9.67,7.51,4.66,1.61,9.76.99,14.64.36,11.44-1.48,22.87-2.96,34.31-4.44,7.72-1,15.56-2.03,22.66-5.21,6.83-3.06,11.17-7.7,14.78-14.07,1.45-2.55,3.9-3.03,6.42-4.4,2.77-1.51,5.42-3.25,7.91-5.19,10.54-8.25,17.73-19.79,21.4-32.44h.02Z" fill="#b4b4b4"/>
            <path d="M394.64,350.55c3.08,0,5.88,1.06,7.36,4.18,1.59,3.36,2.45,6.77,3.15,10.47,2.07,11.03,1.49,22.61-1.64,33.39-3.67,12.65-10.86,24.19-21.4,32.44-2.49,1.95-5.13,3.69-7.91,5.19-2.52,1.37-4.97,1.85-6.42,4.4-3.61,6.37-7.95,11.01-14.78,14.07-7.1,3.18-14.95,4.21-22.66,5.21-11.44,1.48-22.87,2.96-34.31,4.44-2.58.33-5.22.66-7.82.66-2.33,0-4.63-.26-6.83-1.02-3.92-1.35-7.19-4.19-9.67-7.51-3.49-4.67-5.64-9.8-6.52-15.51-.32-2.08-.39-4.14-.2-6.24.09-1,1.6-7.4,1.11-7.77-1.79-1.36-6.2-3.41-6.25-5.45,1.03.16,1.87.3,2.67.3.56,0,1.09-.07,1.65-.26-2.62-3.35-5.07-6.13-5.79-10.44,3.79,2.27,6.74,4.96,10.35,7.73-.7-22.15-12.74-43.33-29.51-56.84-3.71-2.99-11.38-8.25-17.34-8.25-1.33,0-2.58.26-3.68.88,3.57.88,6.78,1.84,9.8,3.81,16.96,11.06,31.55,30.55,35.35,51.1-2.85-1.99-5.81-3.67-9.21-4.34-1.08,4.82.36,9.11,2.48,13.14l-2.17.82c.56,4.19,3.06,7.57,6.86,9.62-.89,4.57-1.25,8.96-.39,13.79-36.68-5.6-56.52-42.38-49.97-77.37.69-3.7,1.57-7.11,3.16-10.47,1.48-3.12,4.28-4.17,7.36-4.17,3.37,0,7.07,1.26,9.77,2.47,11.25,5.05,21.34,11.91,30.39,20.29,6.22,5.75,11.33,12.15,15.75,19.35,2.45,3.97,4.19,8.13,6.1,12.49,7.78-2.8,15.18-4.36,22.58-4.6h4.01c7.39.25,14.8,1.81,22.58,4.6,1.91-4.36,3.66-8.52,6.1-12.49,4.42-7.19,9.53-13.59,15.75-19.35,9.05-8.38,19.15-15.25,30.39-20.29,2.69-1.21,6.4-2.47,9.77-2.47Z" fill="#b4b4b4"/>
          </g>
        </g>
        <g id="Livello_1-2-2">
          <g>
            <path d="M397.89,354.4c-3.57.88-6.79,1.84-9.8,3.81-16.95,11.06-31.54,30.55-35.34,51.1,2.86-1.99,5.81-3.67,9.21-4.34,1.08,4.82-.37,9.11-2.48,13.14l2.17.82c-.56,4.18-3.06,7.56-6.86,9.62.87,4.52,1.24,8.85.41,13.6-1.79.78-3.51,1.66-5.18,2.63,1.95-7.69,1.19-9.63-.05-18.06,1.79-1.36,6.2-3.41,6.25-5.45-1.74.27-2.94.5-4.31.05,2.63-3.35,5.08-6.13,5.79-10.44-3.79,2.27-6.74,4.96-10.35,7.73.7-22.16,12.74-43.33,29.51-56.84,4.54-3.65,15-10.72,21.02-7.37Z" fill="#010101"/>
            <path d="M407.74,399.58c-4.67,16.48-14.47,30.12-28.43,38.59-1.4-.12-2.81-.18-4.23-.18-1.94,0-3.85.11-5.73.33,27.48-11.69,41.45-43.2,35.8-73.37-.69-3.7-1.56-7.11-3.15-10.47-3.09-6.53-11.97-4.02-17.13-1.71-11.24,5.05-21.33,11.91-30.39,20.29-6.22,5.75-11.33,12.16-15.75,19.35-2.44,3.97-4.19,8.13-6.1,12.49-7.77-2.8-15.18-4.36-22.58-4.6h-4.01c-7.4.25-14.8,1.81-22.58,4.6-1.91-4.36-3.65-8.52-6.1-12.49-4.42-7.2-9.53-13.6-15.75-19.35-9.05-8.38-19.15-15.25-30.39-20.29-5.16-2.32-14.03-4.82-17.13,1.71-1.59,3.36-2.46,6.77-3.16,10.47-6.54,35,13.29,71.78,49.97,77.37-.86-4.82-.5-9.21.39-13.79-3.8-2.05-6.31-5.43-6.86-9.62l2.17-.82c-2.12-4.03-3.56-8.32-2.48-13.14,3.4.67,6.36,2.35,9.21,4.34-3.8-20.54-18.39-40.04-35.35-51.1-3.02-1.97-6.23-2.93-9.8-3.81,6.02-3.34,16.48,3.72,21.02,7.37,16.77,13.51,28.81,34.69,29.51,56.84-3.61-2.77-6.56-5.45-10.35-7.73.72,4.3,3.16,7.09,5.79,10.44-1.36.46-2.58.22-4.31-.05.05,2.05,4.47,4.09,6.25,5.45-1.24,8.47-2,10.4,0,18.2-3.38-.74-6.89-1.12-10.49-1.12-1.95,0-3.89.11-5.78.33-20.96-6.82-35.46-23.34-41.48-44.56-2.8-9.86-3.63-19.74-2.4-29.95.65-5.4,1.62-10.48,3.52-15.47,2.14-5.63,7.16-8.8,13.23-8.19,8.81.88,18.4,6.3,25.84,11.15,9.29,6.07,17.7,13.03,24.76,21.61,4.92,5.98,9.98,13.69,12.83,20.87,6.52-2.11,13.2-3.29,19.92-3.5h4.01c6.72.21,13.41,1.39,19.92,3.5,2.86-7.18,7.91-14.89,12.83-20.87,7.06-8.58,15.47-15.55,24.77-21.61,7.43-4.85,17.03-10.27,25.84-11.15,6.07-.62,11.1,2.56,13.23,8.19,1.89,4.98,2.87,10.07,3.52,15.47,1.22,10.22.39,20.08-2.4,29.95Z" fill="#010101"/>
            <g>
              <path d="M344.8,437.03c2.32-6.88-.13-14.24-5.57-18.43-5.68-4.38-13.29-4.72-19.24-.82-7.02,4.61-9.58,13.16-6.34,20.86,3.89,9.27,13.88,14.62,23.73,12.27,2.26-.54,4.46-1.62,5.69-3.48-4.5,1.7-9.08,2.48-13.52.99,7.36-.33,13.12-5.01,15.27-11.39Z" fill="#010101"/>
              <path d="M295.38,417.31c-6.09-3.63-13.76-2.78-19.15,1.83-5.25,4.5-7.39,11.91-4.65,18.77,2.41,6.03,8.49,10.54,15.33,10.54-3.36.9-6.61.98-9.83.25,1.65.8,3.25,1.69,4.8,2.66,8.29.41,15.92-3.91,19.71-10.95,4.49-8.36,1.94-18.24-6.2-23.09Z" fill="#010101"/>
            </g>
          </g>
          <g>
            <g id="occhio-destro">
              <path d="M344.8,437.03c2.32-6.88-.13-14.24-5.57-18.43-5.68-4.38-13.29-4.72-19.24-.82-7.02,4.61-9.58,13.16-6.34,20.86,3.89,9.27,13.88,14.62,23.73,12.27,2.26-.54,4.46-1.62,5.69-3.48-4.5,1.7-9.08,2.48-13.52.99,7.36-.33,13.12-5.01,15.27-11.39ZM334.02,443.13c-4.4,1.9-8.96,1.38-12.6-1.39-4.28-3.26-5.95-8.82-4.22-13.94,1.61-4.77,6.12-8.46,11.53-8.56,7.85-.14,14.03,6.96,12.52,14.8-.84,4.4-3.85,7.63-7.24,9.09Z" fill="#010101"/>
              <circle cx="328.97" cy="431.98" r="13.89" fill="#ffe64f"/>
              <path id="pupilla-destra" d="M328.23,421.98c3.75,4.19,4.01,15.75-.07,19.82-3.61-6.15-3.55-13.51.07-19.82Z" fill="#010101"/>
            </g>
            <g id="occhio-sinistro">
              <path d="M295.38,417.31c-6.09-3.63-13.76-2.78-19.15,1.83-5.25,4.5-7.39,11.91-4.65,18.77,2.41,6.03,8.49,10.54,15.33,10.54-3.36.9-6.61.98-9.83.25,1.65.8,3.25,1.69,4.8,2.66,8.29.41,15.92-3.91,19.71-10.95,4.49-8.36,1.94-18.24-6.2-23.09ZM296.13,440.39c-5.64,5.91-15.04,4.8-19.36-1.7-4.36-6.56-1.81-15.47,5.67-18.54,5.43-2.22,11.5-.21,14.72,4.32,3.46,4.86,3.26,11.41-1.04,15.92Z" fill="#010101"/>
              <circle cx="286.95" cy="431.98" r="13.89" fill="#ffe64f"/>
              <path id="pupilla-sinistra" d="M287.69,441.74c-3.58-4.49-3.59-15.36.2-19.76,3.52,4.82,3.85,15.23-.2,19.76Z" fill="#010101"/>
            </g>
          </g>
        </g>
        <path d="M7.53,742.53c10.52-.03,21.04-.08,31.56-.16,10.56-.08,21.12-.19,31.68-.33,10.53-.14,21.07-.3,31.6-.49,10.59-.19,21.17-.41,31.75-.66,10.52-.25,21.05-.52,31.57-.82,10.54-.3,21.08-.63,31.61-.99,10.44-.35,20.89-.67,31.32-1.19,10.45-.52,20.91-.89,31.38-1.13,10.42-.24,20.84-.35,31.26-.37,10.48-.02,20.96.06,31.44.2,10.51.14,21.01.34,31.51.58,10.49.23,20.97.5,31.45.77,10.57.27,21.13.54,31.7.78,10.56.24,21.12.45,31.69.6,10.65.15,21.3.24,31.95.24s20.65-.25,30.97-.6c10.37-.35,20.73-.8,31.09-1.23,10.43-.43,20.87-.84,31.31-1.09,8.54-.2,17.08-.3,25.63-.22v-204.57c0-22.38-22.2-40.52-49.59-40.52-13.27,0-25.3,4.25-34.21,11.18-8.9-6.93-20.95-11.18-34.21-11.18-5.44,0-10.67.72-15.57,2.05-8.82-11.21-24.23-18.64-41.75-18.64h-.48c-3.14-18.61-21.75-33.18-44.88-34.78-1.4-.1-2.81-.15-4.23-.15-1.94,0-3.85.09-5.73.27-4.98.47-9.73,1.54-14.14,3.12-1.79.63-3.51,1.36-5.18,2.15-6.15,2.95-11.45,6.95-15.53,11.69-7.65-3.95-16.73-6.24-26.45-6.24-7.19,0-14.02,1.25-20.19,3.5-1.87-1.31-3.87-2.51-5.97-3.59-1.55-.79-3.14-1.51-4.8-2.17h-.01c-3.46-1.36-7.14-2.41-10.99-3.08-3.38-.6-6.89-.91-10.49-.91-1.95,0-3.89.09-5.78.27-21.8,2.07-39.3,15.69-43.06,33.19-6.01-2.12-12.63-3.29-19.59-3.29-18.71,0-35.01,8.47-43.45,20.97-6.74-2.8-14.36-4.38-22.44-4.38-22.5,0-41.51,12.24-47.57,29.02-7.13-3.25-15.35-5.1-24.1-5.1-27.4,0-61.99,11.24-61.91,33.62.23,67.36,12.74,136.38,12.9,193.68h6.95Z" fill="#2e6641" stroke="#1e1e1c" strokeMiterlimit="10" strokeWidth="3.97"/>
      </g>
    </g>
  </svg>
)

export default function Home({ showCompose, setShowCompose }) {
  const [confessions, setConfessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [category, setCategory] = useState(null)
  const [stats, setStats] = useState({ total: 0, today: 0 })
  const [online, setOnline] = useState(1)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [visible, setVisible] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const [idle, setIdle] = useState(false)
  const pingRef = useRef(null)
  const idleTimer = useRef(null)

  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const FULL_HEIGHT = vh
  const SMALL_HEIGHT = Math.round(vh * 0.25)
  const SCROLL_RANGE = FULL_HEIGHT - SMALL_HEIGHT
  const currentHeight = Math.max(SMALL_HEIGHT, FULL_HEIGHT - scrollY)
  const transitionProgress = Math.min(1, scrollY / SCROLL_RANGE)
  const isAnchored = scrollY >= SCROLL_RANGE
  const animatePupils = idle && !isAnchored

  useEffect(() => {
    function handleScroll() {
      setScrollY(window.scrollY)
      setIdle(false)
      clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => setIdle(true), 2000)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    idleTimer.current = setTimeout(() => setIdle(true), 2000)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(idleTimer.current)
    }
  }, [])

  async function ping() {
    try {
      const res = await fetch(`${BASE}/api/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: getDeviceId() }),
      })
      const data = await res.json()
      setOnline(data.online || 1)
    } catch {}
  }

  useEffect(() => {
    ping()
    pingRef.current = setInterval(ping, 30_000)
    return () => clearInterval(pingRef.current)
  }, [])

  useEffect(() => {
    let isMounted = true
    setVisible(false)
    async function fetchData() {
      setLoading(true); setPage(1); setHasMore(true)
      try {
        const params = { limit: PAGE_SIZE, page: 1 }
        if (category) params.category = category
        const data = await api.confessions.list(params)
        if (isMounted) {
          const list = data?.confessions || []
          setConfessions(list)
          setHasMore(list.length === PAGE_SIZE)
          setTimeout(() => setVisible(true), 50)
        }
        try {
          const s = await api.stats()
          if (isMounted && s) setStats({ total: s.confessions_posted || 0, today: s.today || 0 })
        } catch {}
      } catch (e) { console.error(e) }
      finally { if (isMounted) setLoading(false) }
    }
    fetchData()
    return () => { isMounted = false }
  }, [category])

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const params = { limit: PAGE_SIZE, page: nextPage }
      if (category) params.category = category
      const data = await api.confessions.list(params)
      const newList = data?.confessions || []
      setConfessions(prev => [...prev, ...newList])
      setPage(nextPage)
      setHasMore(newList.length === PAGE_SIZE)
    } catch (e) { console.error(e) }
    finally { setLoadingMore(false) }
  }

  const bigLogoOpacity = Math.max(0, 1 - transitionProgress * 2)
  const bigLogoSize = 3.2 - transitionProgress * 1.5

  return (
    <div className="home-container">

      {/* ── SPIOLO STICKY ────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 600,
        height: currentHeight,
        zIndex: 10,
        overflow: 'hidden',
        background: '#341d56',
        /* position:relative serve perché SpioloSVG usa position:absolute */
      }}>
        <SpioloSVG animate={animatePupils} />

        {/* Logo grande sopra la testa */}
        <div style={{
          position: 'absolute',
          top: '18%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: bigLogoOpacity,
          pointerEvents: 'none',
          zIndex: 2,
        }}>
          <span style={{
            fontFamily: 'Fraunces, serif',
            fontSize: `${bigLogoSize}rem`,
            color: '#fff',
            letterSpacing: '-0.5px',
            textShadow: '0 2px 24px rgba(0,0,0,0.5)',
          }}>
            Lo Spiolo
          </span>
        </div>

        {/* Sfumatura in basso */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '20%',
          background: 'linear-gradient(to bottom, transparent, rgba(46,102,64,0.7))',
          pointerEvents: 'none',
          zIndex: 2,
        }} />
      </div>

      {/* Spacer */}
      <div style={{ height: FULL_HEIGHT }} />

      {/* ── FEED ─────────────────────────────────────────────────────── */}
      <div className="bush-feed">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          borderBottom: '1px solid rgba(0,0,0,0.15)',
          background: 'rgba(0,0,0,0.15)',
          fontSize: '0.8rem',
          color: 'rgba(255,255,255,0.6)',
          flexWrap: 'wrap',
          gap: 6,
        }}>
          <span>Spiólate: <b style={{ color: '#f5d800' }}>{(stats.total || 0).toLocaleString('it-IT')}</b> · Oggi: <b style={{ color: '#f5d800' }}>{(stats.today || 0).toLocaleString('it-IT')}</b></span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <PeopleIcon />
            <span>Online: <b style={{ color: '#4ade80' }}>{online}</b></span>
          </div>
        </div>

        <div className="taxonomy-label">
          <div className="taxonomy-title">Spiolus paparazzus — Tassonomia del pettegolezzo</div>
          <p className="taxonomy-text">
            Lo spiolo fotografa le mucche che si tolgono il reggiseno, va a spiare i fidanzamenti dei gabbiani sulla spiaggia, guarda nei frigoriferi, apre la posta, fruga nella spazzatura, sbircia dalla serratura… e poi racconta, maligno, a un altro spiolo, nella catena infinita del pettegolezzo spiolico.
          </p>
        </div>

        <nav className="tabs-row">
          {CAT_DATA.map(cat => (
            <button
              key={String(cat.id)}
              className={`tab-btn ${category === cat.id ? 'active' : ''}`}
              onClick={() => setCategory(cat.id)}
            >
              <span className="tab-emoji">{cat.emoji}</span>
              <span className="tab-name">{cat.name}</span>
            </button>
          ))}
        </nav>

        <section className={`feed ${visible ? 'feed-visible' : ''}`} style={{ paddingBottom: 100 }}>
          {loading ? (
            <div className="feed-loading">Intercettando segreti…</div>
          ) : (
            <>
              {confessions.length === 0 && <div className="feed-empty">Nessun segreto qui.</div>}
              {confessions.map((c, i) => (
                <div key={c.id} className="card-fadein" style={{ animationDelay: `${Math.min(i, 5) * 60}ms` }}>
                  <ConfessionCard confession={c} />
                </div>
              ))}
              {hasMore && !loading && (
                <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
                  <button onClick={loadMore} disabled={loadingMore} className="load-more-btn">
                    {loadingMore ? 'Caricamento…' : 'Carica altri segreti'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
