/* eslint-disable */
// Firebase Messaging Service Worker — handles background push notifications.
// This file is served from /firebase-messaging-sw.js and registered by Firebase SDK automatically.

importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey:            'AIzaSyAvcfIgVWTB8c_s1-mP2w5jCHzEvvqaxIs',
  authDomain:        'avantelevators-dff70.firebaseapp.com',
  projectId:         'avantelevators-dff70',
  storageBucket:     'avantelevators-dff70.firebasestorage.app',
  messagingSenderId: '29570477853',
  appId:             '1:29570477853:web:0ec91c39c6fa19ad50bbf4',
})

const messaging = firebase.messaging()

// Background message handler — shows a system notification when the tab is not focused
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {}
  const data = payload.data || {}

  self.registration.showNotification(title || 'TAB Elevators', {
    body:             body || '',
    icon:             icon || '/favicon.png',
    badge:            '/favicon.png',
    data,
    requireInteraction: false,
    tag:              data.type || 'tab-elevators-notification',
  })
})

// Open or focus the app when a notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const existing = wins.find((w) => w.url.startsWith(self.location.origin))
      if (existing) return existing.focus()
      return clients.openWindow(self.location.origin)
    })
  )
})
