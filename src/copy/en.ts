import type { Copy } from './ko';

/** English mirror of ko.ts. The `Copy` type rejects missing or extra keys. */
export const en: Copy = {
  app: {
    name: 'Jinjja?',
    tagline: 'Snap a store price tag and compare it with the same product online.',
  },
  home: {
    comingSoon: 'Price tag scanning is coming soon.',
    aboutLink: 'About',
  },
  commission: "This app doesn't earn commission from any seller right now.",
  version: 'v{version}',
  about: {
    title: 'About',
    back: 'Home',
    connection: 'Connection',
  },
  auth: {
    loading: 'Connecting.',
    notConnected: 'Not connected to the server.',
    signedIn: 'Connected with an anonymous ID.',
    userId: 'Anonymous ID: {id}',
    error: 'Anonymous sign-in failed. Refresh the page.',
    noUser: 'The server did not return an anonymous ID.',
    errorDetail: 'Error detail: {message}',
  },
};
