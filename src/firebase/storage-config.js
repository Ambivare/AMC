// Main app and media storage share the same Firebase project (avantelevators-dff70).
// Re-export the storage instance from config so gallery uploads use the same bucket.
export { storage as mediaStorage } from './config'
