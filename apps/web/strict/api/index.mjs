// Vercel entry point (ADR-014). Vercel serves web/ as static files; every other path is rewritten here by
// vercel.json, and runs through the same handler as the local server. No science lives here.
import { createHandler } from '../src/api/server.mjs';

export default createHandler();
