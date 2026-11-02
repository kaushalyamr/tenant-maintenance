// Dependency-free CORS: the API and the Next.js app run on different ports, so
// this is cross-origin even though it is same-site for cookies.
export function cors(allowedOrigin) {
  return (req, res, next) => {
    const origin = req.get('origin');
    if (origin && origin === allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      res.setHeader('Access-Control-Max-Age', '600');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  };
}
